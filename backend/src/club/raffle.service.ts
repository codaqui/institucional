import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Raffle, RaffleStatus } from './entities/raffle.entity';
import { RaffleEntry, RaffleOwnerType } from './entities/raffle-entry.entity';
import { Wallet } from './entities/wallet.entity';
import { CompanyWallet } from '../companies/entities/company-wallet.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { Member } from '../members/entities/member.entity';
import { ClubService } from './club.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';

export interface WalletOwner {
  type: RaffleOwnerType;
  ownerId: string;
}

@Injectable()
export class RaffleService {
  private static readonly DRAW_ALGORITHM =
    'weighted-sha256-mod(totalCoins)';
  private static readonly ALGORITHM_CODE_URL =
    'https://github.com/codaqui/institucional/blob/develop/backend/src/club/raffle.service.ts';

  constructor(
    @InjectRepository(Raffle)
    private readonly raffleRepo: Repository<Raffle>,
    @InjectRepository(RaffleEntry)
    private readonly entryRepo: Repository<RaffleEntry>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(CompanyWallet)
    private readonly companyWalletRepo: Repository<CompanyWallet>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly clubService: ClubService,
    private readonly companiesService: CompaniesService,
    private readonly dataSource: DataSource,
  ) {}

  async listOpen(): Promise<Raffle[]> {
    return this.raffleRepo.find({
      where: { status: RaffleStatus.OPEN },
      order: { closesAt: 'ASC' },
    });
  }

  async listAll(): Promise<unknown[]> {
    const raffles = await this.raffleRepo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(raffles.map((raffle) => this.buildRaffleView(raffle)));
  }

  async listHistory(): Promise<unknown[]> {
    const raffles = await this.raffleRepo.find({
      where: [
        { status: RaffleStatus.DRAWN },
        { status: RaffleStatus.CANCELED },
        { status: RaffleStatus.CLOSED },
      ],
      order: { createdAt: 'DESC' },
    });
    return Promise.all(raffles.map((raffle) => this.buildRaffleView(raffle)));
  }

  async listMyEntries(
    memberId: string,
  ): Promise<Array<{ raffleId: string; coinsSpent: number }>> {
    const companies = await this.companyRepo.find({
      where: { responsibleMemberId: memberId },
      select: ['id'],
    });

    const ownerFilters: Array<{ ownerId: string; ownerType: RaffleOwnerType }> = [
      { ownerId: memberId, ownerType: RaffleOwnerType.MEMBER },
      ...companies.map((company) => ({
        ownerId: company.id,
        ownerType: RaffleOwnerType.COMPANY,
      })),
    ];

    const entries = await this.entryRepo.find({
      where: ownerFilters,
      select: ['raffleId', 'coinsSpent'],
    });

    const aggregate = new Map<string, number>();
    for (const entry of entries) {
      aggregate.set(
        entry.raffleId,
        (aggregate.get(entry.raffleId) ?? 0) + entry.coinsSpent,
      );
    }

    return Array.from(aggregate.entries()).map(([raffleId, coinsSpent]) => ({
      raffleId,
      coinsSpent,
    }));
  }

  async getRaffleStats(
    raffleId: string,
  ): Promise<{ participantCount: number; totalCoins: number }> {
    await this.findOne(raffleId);
    const entries = await this.entryRepo.find({
      where: { raffleId },
      select: ['coinsSpent'],
    });
    return {
      participantCount: entries.length,
      totalCoins: entries.reduce((sum, entry) => sum + entry.coinsSpent, 0),
    };
  }

  async findOne(id: string): Promise<Raffle> {
    const raffle = await this.raffleRepo.findOne({ where: { id } });
    if (!raffle) throw new NotFoundException('Sorteio não encontrado');
    return raffle;
  }

  async create(dto: CreateRaffleDto, createdByMemberId: string): Promise<Raffle> {
    const closesAt = new Date(dto.closesAt);
    if (closesAt <= new Date())
      throw new BadRequestException('closesAt deve ser no futuro');

    return this.raffleRepo.save(
      this.raffleRepo.create({
        title: dto.title,
        description: dto.description ?? null,
        costInCoins: dto.costInCoins,
        closesAt,
        createdByMemberId,
        status: RaffleStatus.OPEN,
      }),
    );
  }

  /**
   * Inscreve um membro ou empresa num sorteio.
   * Resolve o walletId conforme ownerType.
   * Débita SortCoins atomicamente.
   */
  async enterRaffle(
    raffleId: string,
    memberId: string,
    ownerType: RaffleOwnerType = RaffleOwnerType.MEMBER,
  ): Promise<RaffleEntry> {
    const raffle = await this.findOne(raffleId);

    if (raffle.status !== RaffleStatus.OPEN)
      throw new BadRequestException('Sorteio não está aberto para inscrições');
    if (new Date() > raffle.closesAt)
      throw new BadRequestException('Sorteio já encerrado');

    // resolve ownerId + walletId
    let ownerId: string;
    let walletId: string;

    if (ownerType === RaffleOwnerType.COMPANY) {
      const company = await this.companyRepo.findOne({
        where: { responsibleMemberId: memberId },
      });
      if (!company)
        throw new NotFoundException(
          'Empresa não encontrada para este responsável',
        );
      if (company.status !== CompanyStatus.ACTIVE)
        throw new BadRequestException('Empresa não está ativa');

      ownerId = company.id;
      const cWallet = await this.companiesService.getOrCreateWallet(company.id);
      walletId = cWallet.id;
    } else {
      ownerId = memberId;
      const wallet = await this.clubService.getOrCreateWallet(memberId);
      walletId = wallet.id;
    }

    return this.dataSource.transaction(async (em) => {
      const alreadyIn = await em
        .getRepository(RaffleEntry)
        .createQueryBuilder('entry')
        .setLock('pessimistic_write')
        .where('entry."raffleId" = :raffleId', { raffleId })
        .andWhere('entry."ownerId" = :ownerId', { ownerId })
        .andWhere('entry."ownerType" = :ownerType', { ownerType })
        .getOne();

      const raffleReferenceId = alreadyIn
        ? `raffle:${raffleId}:entry:${alreadyIn.id}:total:${alreadyIn.coinsSpent + raffle.costInCoins}`
        : `raffle:${raffleId}`;

      if (ownerType === RaffleOwnerType.COMPANY) {
        await this.companiesService.debitForRaffle(
          walletId,
          raffle.costInCoins,
          raffleReferenceId,
          undefined,
          em,
        );
      } else {
        await this.clubService.debitForRaffle(
          walletId,
          raffle.costInCoins,
          raffleReferenceId,
          undefined,
          em,
        );
      }

      if (alreadyIn) {
        alreadyIn.coinsSpent += raffle.costInCoins;
        return em.getRepository(RaffleEntry).save(alreadyIn);
      }

      return em.getRepository(RaffleEntry).save(
        em.getRepository(RaffleEntry).create({
          raffleId,
          ownerId,
          ownerType,
          coinsSpent: raffle.costInCoins,
        }),
      );
    });
  }

  /** Sorteia um vencedor aleatório (crypto.randomInt para auditabilidade) */
  async draw(raffleId: string): Promise<Raffle> {
    const raffle = await this.findOne(raffleId);

    if (raffle.status !== RaffleStatus.OPEN && raffle.status !== RaffleStatus.CLOSED)
      throw new BadRequestException('Sorteio não pode ser sorteado no status atual');

    const entries = await this.entryRepo.find({
      where: { raffleId },
      order: { enteredAt: 'ASC', id: 'ASC' },
    });
    if (entries.length === 0)
      throw new BadRequestException('Sem participantes para sortear');

    const totalCoins = entries.reduce((sum, entry) => sum + entry.coinsSpent, 0);
    if (totalCoins <= 0)
      throw new BadRequestException('Sorteio inválido: sem coins investidos');
    const drawSeed = randomBytes(16).toString('hex');
    const digest = createHash('sha256')
      .update(`${drawSeed}:${raffleId}:${totalCoins}`)
      .digest('hex');
    const randomCoin = Number(
      BigInt(`0x${digest}`) % BigInt(totalCoins),
    );
    let accumulated = 0;
    let winner = entries[0];
    for (const entry of entries) {
      accumulated += entry.coinsSpent;
      if (randomCoin < accumulated) {
        winner = entry;
        break;
      }
    }

    raffle.status = RaffleStatus.DRAWN;
    raffle.winnerId = winner.ownerId;
    raffle.winnerType = winner.ownerType;
    raffle.drawAt = new Date();
    raffle.drawSeed = drawSeed;
    raffle.drawAlgorithm = RaffleService.DRAW_ALGORITHM;

    return this.raffleRepo.save(raffle);
  }

  /**
   * Cancela sorteio e estorna todos os coins.
   * Estorno é best-effort: erros individuais são logados mas não travam o cancelamento.
   */
  async cancel(raffleId: string): Promise<Raffle> {
    const raffle = await this.findOne(raffleId);

    if (raffle.status === RaffleStatus.DRAWN || raffle.status === RaffleStatus.CANCELED)
      throw new BadRequestException('Sorteio não pode ser cancelado no status atual');

    const entries = await this.entryRepo.find({ where: { raffleId } });

    for (const entry of entries) {
      try {
        if (entry.ownerType === RaffleOwnerType.COMPANY) {
          const cWallet = await this.companyWalletRepo.findOne({
            where: { companyId: entry.ownerId },
          });
          if (cWallet) {
            await this.companiesService.refundFromRaffle(
              cWallet.id,
              entry.coinsSpent,
              raffleId,
            );
          }
        } else {
          const wallet = await this.walletRepo.findOne({
            where: { memberId: entry.ownerId },
          });
          if (wallet) {
            await this.clubService.refundFromRaffle(
              wallet.id,
              entry.coinsSpent,
              raffleId,
            );
          }
        }
      } catch (err) {
        console.error(
          `Erro ao estornar entry ${entry.id} no cancelamento do sorteio ${raffleId}:`,
          err,
        );
      }
    }

    raffle.status = RaffleStatus.CANCELED;
    return this.raffleRepo.save(raffle);
  }

  async listEntries(raffleId: string): Promise<Array<RaffleEntry & { ownerDisplay: string }>> {
    const entries = await this.entryRepo.find({
      where: { raffleId },
      order: { enteredAt: 'ASC' },
    });

    if (entries.length === 0) return [];

    const memberIds = entries
      .filter((entry) => entry.ownerType === RaffleOwnerType.MEMBER)
      .map((entry) => entry.ownerId);
    const companyIds = entries
      .filter((entry) => entry.ownerType === RaffleOwnerType.COMPANY)
      .map((entry) => entry.ownerId);

    const [members, companies] = await Promise.all([
      memberIds.length > 0
        ? this.memberRepo.find({
            where: memberIds.map((id) => ({ id })),
            select: ['id', 'githubHandle', 'name'],
          })
        : Promise.resolve([] as Member[]),
      companyIds.length > 0
        ? this.companyRepo.find({
            where: companyIds.map((id) => ({ id })),
            select: ['id', 'name'],
          })
        : Promise.resolve([] as Company[]),
    ]);

    const memberMap = new Map(
      members.map((member) => {
        const nameSuffix = member.name ? ` (${member.name})` : '';
        return [member.id, `@${member.githubHandle}${nameSuffix}`];
      }),
    );
    const companyMap = new Map(companies.map((company) => [company.id, company.name]));

    return entries.map((entry) => ({
      ...entry,
      ownerDisplay:
        entry.ownerType === RaffleOwnerType.MEMBER
          ? memberMap.get(entry.ownerId) ?? `Membro ${entry.ownerId}`
          : companyMap.get(entry.ownerId) ?? `Empresa ${entry.ownerId}`,
    }));
  }

  private async buildRaffleView(raffle: Raffle): Promise<{
    id: string;
    title: string;
    description: string | null;
    costInCoins: number;
    status: RaffleStatus;
    closesAt: Date;
    drawAt: Date | null;
    winnerId: string | null;
    winnerType: RaffleOwnerType | null;
    winnerDisplay: string | null;
    participantCount: number;
    totalCoinsGenerated: number;
    drawSeed: string | null;
    drawAlgorithm: string | null;
    algorithmCodeUrl: string;
  }> {
    const entries = await this.entryRepo.find({
      where: { raffleId: raffle.id },
      select: ['ownerId', 'ownerType', 'coinsSpent'],
    });
    const totalCoinsGenerated = entries.reduce(
      (sum, entry) => sum + entry.coinsSpent,
      0,
    );

    let winnerDisplay: string | null = null;
    if (raffle.winnerId && raffle.winnerType) {
      if (raffle.winnerType === RaffleOwnerType.MEMBER) {
        const member = await this.memberRepo.findOne({
          where: { id: raffle.winnerId },
          select: ['githubHandle', 'name'],
        });
        if (member) {
          const nameSuffix = member.name ? ` (${member.name})` : '';
          winnerDisplay = `@${member.githubHandle}${nameSuffix}`;
        } else {
          winnerDisplay = raffle.winnerId;
        }
      } else {
        const company = await this.companyRepo.findOne({
          where: { id: raffle.winnerId },
          select: ['name'],
        });
        winnerDisplay = company?.name ?? raffle.winnerId;
      }
    }

    return {
      id: raffle.id,
      title: raffle.title,
      description: raffle.description,
      costInCoins: raffle.costInCoins,
      status: raffle.status,
      closesAt: raffle.closesAt,
      drawAt: raffle.drawAt,
      winnerId: raffle.winnerId,
      winnerType: raffle.winnerType,
      winnerDisplay,
      participantCount: entries.length,
      totalCoinsGenerated,
      drawSeed: raffle.drawSeed,
      drawAlgorithm: raffle.drawAlgorithm,
      algorithmCodeUrl: RaffleService.ALGORITHM_CODE_URL,
    };
  }
}
