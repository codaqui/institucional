import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import {
  WalletTransaction,
  WalletTxSource,
} from './entities/wallet-transaction.entity';
import { Member } from '../members/entities/member.entity';

/** Quantos SortCoins por real (pode virar config de banco no futuro) */
const SORT_COINS_PER_REAL = 1;  // 1 real = 1 SortCoin
const DEFAULT_COIN = 'sort_coin';

@Injectable()
export class ClubService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly dataSource: DataSource,
  ) {}

  /** Retorna ou cria a carteira de um membro */
  async getOrCreateWallet(memberId: string): Promise<Wallet> {
    const existing = await this.walletRepo.findOne({ where: { memberId } });
    if (existing) return existing;
    return this.walletRepo.save(
      this.walletRepo.create({ memberId, balances: {}, frozenTypes: [] }),
    );
  }

  /** Retorna a carteira existente ou lança NotFoundException */
  async getWallet(memberId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { memberId } });
    if (!wallet) throw new NotFoundException('Carteira não encontrada');
    return wallet;
  }

  async getPublicWalletByHandle(
    handle: string,
    limit = 10,
  ): Promise<{
    member: { id: string; githubHandle: string; name: string };
    wallet: Wallet | null;
    transactions: WalletTransaction[];
  }> {
    const normalizedHandle = handle.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedHandle)) {
      throw new BadRequestException('Handle inválido');
    }

    const member = await this.memberRepo
      .createQueryBuilder('member')
      .where('LOWER(member."githubHandle") = :handle', {
        handle: normalizedHandle.toLowerCase(),
      })
      .andWhere('member."isActive" = true')
      .select(['member.id', 'member.githubHandle', 'member.name'])
      .getOne();

    if (!member) {
      throw new NotFoundException('Membro não encontrado');
    }

    const wallet = await this.walletRepo.findOne({ where: { memberId: member.id } });
    if (!wallet) {
      return {
        member: {
          id: member.id,
          githubHandle: member.githubHandle,
          name: member.name,
        },
        wallet: null,
        transactions: [],
      };
    }

    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(50, Math.floor(limit)))
      : 10;
    const transactions = await this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });

    return {
      member: {
        id: member.id,
        githubHandle: member.githubHandle,
        name: member.name,
      },
      wallet,
      transactions,
    };
  }

  /** Histórico de transações paginado */
  async getTransactions(
    memberId: string,
    page = 1,
    limit = 20,
  ): Promise<WalletTransaction[]> {
    const wallet = await this.getWallet(memberId);
    return this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Credita SortCoins pela invoice Stripe (idempotente via referenceId).
   * Conversão: R$1 = SORT_COINS_PER_REAL moedas.
   */
  async creditFromInvoice(
    memberId: string,
    amountReais: number,
    referenceId: string,
    coinType = DEFAULT_COIN,
  ): Promise<WalletTransaction> {
    const coins = Math.floor(amountReais * SORT_COINS_PER_REAL);
    return this.credit(memberId, coins, WalletTxSource.STRIPE_INVOICE, referenceId, coinType);
  }

  /**
   * Débita coins para inscrição em sorteio.
   * Dentro de SELECT FOR UPDATE para evitar race condition.
   */
  async debitForRaffle(
    walletId: string,
    coins: number,
    referenceId: string,
    coinType = DEFAULT_COIN,
    manager?: EntityManager,
  ): Promise<WalletTransaction> {
    const run = async (em: EntityManager) => {
      const wallet = await em
        .getRepository(Wallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      const frozen = wallet.frozenTypes.includes(coinType);
      if (frozen)
        throw new BadRequestException(
          `Moeda ${coinType} está congelada nesta carteira`,
        );

      const balance = wallet.balances[coinType] ?? 0;
      if (balance < coins)
        throw new BadRequestException('Saldo insuficiente de SortCoins');

      wallet.balances = {
        ...wallet.balances,
        [coinType]: balance - coins,
      };
      await em.getRepository(Wallet).save(wallet);

      const tx = em.getRepository(WalletTransaction).create({
        walletId,
        coinType,
        amount: -coins,
        source: WalletTxSource.RAFFLE_ENTRY,
        referenceId,
        description: 'Inscrição em sorteio',
      });
      return em.getRepository(WalletTransaction).save(tx);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  /** Estorna coins ao cancelar sorteio */
  async refundFromRaffle(
    walletId: string,
    coins: number,
    raffleId: string,
    coinType = DEFAULT_COIN,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const wallet = await em
        .getRepository(Wallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      wallet.balances = {
        ...wallet.balances,
        [coinType]: (wallet.balances[coinType] ?? 0) + coins,
      };
      await em.getRepository(Wallet).save(wallet);

      const tx = em.getRepository(WalletTransaction).create({
        walletId,
        coinType,
        amount: coins,
        source: WalletTxSource.RAFFLE_REFUND,
        referenceId: `raffle-refund:${raffleId}:${walletId}`,
        description: 'Estorno por cancelamento de sorteio',
      });
      return em.getRepository(WalletTransaction).save(tx);
    });
  }

  /**
   * Ajuste manual (admin).
   * referenceId null → múltiplos ajustes manuais são permitidos (NULLs ≠ UNIQUE em PG).
   */
  async manualAdjust(
    memberId: string,
    amount: number,
    coinType = DEFAULT_COIN,
    description?: string,
  ): Promise<WalletTransaction> {
    if (amount === 0) throw new BadRequestException('Ajuste não pode ser zero');
    const wallet = await this.getOrCreateWallet(memberId);
    return this.applyBalance(wallet.id, amount, coinType, WalletTxSource.MANUAL_ADMIN, null, description);
  }

  /** Congela um tipo de moeda na carteira */
  async freezeCoin(memberId: string, coinType = DEFAULT_COIN): Promise<void> {
    const wallet = await this.getOrCreateWallet(memberId);
    if (!wallet.frozenTypes.includes(coinType)) {
      wallet.frozenTypes = [...wallet.frozenTypes, coinType];
      await this.walletRepo.save(wallet);
    }
  }

  /** Descongela um tipo de moeda na carteira */
  async unfreezeCoin(memberId: string, coinType = DEFAULT_COIN): Promise<void> {
    const wallet = await this.getOrCreateWallet(memberId);
    wallet.frozenTypes = wallet.frozenTypes.filter((t) => t !== coinType);
    await this.walletRepo.save(wallet);
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  /**
   * Credita SortCoins para um membro (distribuição pela empresa).
   * Referência única garante idempotência.
   */
  async creditDistribution(
    memberId: string,
    coins: number,
    referenceId: string,
    description: string,
    coinType = DEFAULT_COIN,
  ): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(memberId);
    return this.applyBalance(wallet.id, coins, coinType, WalletTxSource.COMPANY_DISTRIBUTION, referenceId, description);
  }

  private async credit(
    memberId: string,
    coins: number,
    source: WalletTxSource,
    referenceId: string,
    coinType = DEFAULT_COIN,
  ): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(memberId);
    return this.applyBalance(wallet.id, coins, coinType, source, referenceId);
  }

  private async applyBalance(
    walletId: string,
    amount: number,
    coinType: string,
    source: WalletTxSource,
    referenceId: string | null,
    description?: string,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const txRepo = em.getRepository(WalletTransaction);
      const txWhere: FindOptionsWhere<WalletTransaction> = {
        walletId,
        source,
        referenceId: referenceId ?? IsNull(),
        coinType,
      };
      if (referenceId) {
        const existing = await txRepo.findOne({ where: txWhere });
        if (existing) return existing;
      }

      let savedTx: WalletTransaction;
      try {
        savedTx = await txRepo.save(
          txRepo.create({
            walletId,
            coinType,
            amount,
            source,
            referenceId,
            description: description ?? null,
          }),
        );
      } catch (err: any) {
        if (err?.code === '23505') {
          const existing = await txRepo.findOne({ where: txWhere });
          if (existing) return existing;
        }
        throw new ConflictException('Transação duplicada ou erro de unicidade');
      }

      const wallet = await em
        .getRepository(Wallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      wallet.balances = {
        ...wallet.balances,
        [coinType]: (wallet.balances[coinType] ?? 0) + amount,
      };
      await em.getRepository(Wallet).save(wallet);
      return savedTx;
    });
  }

  /**
   * Histórico unificado de carteiras para o admin.
   * Retorna transações de membros e empresas numa lista única, ordenadas por data DESC.
   */
  async getAdminAllTransactions(
    type: 'all' | 'member' | 'company' = 'all',
    page = 1,
    limit = 50,
  ): Promise<{ data: unknown[]; total: number }> {
    const offset = (page - 1) * limit;

    const memberQ = `
      SELECT
        cwt.id,
        'member'          AS "ownerType",
        m."githubHandle"  AS "ownerHandle",
        m.name            AS "ownerName",
        m."avatarUrl"     AS "ownerAvatarUrl",
        cwt."coinType",
        cwt.amount,
        cwt.source::text  AS source,
        cwt."referenceId",
        cwt.description,
        cwt."createdAt"
      FROM club_wallet_transactions cwt
      JOIN club_wallets w   ON w.id = cwt."walletId"
      JOIN members m        ON m.id::text = w."memberId"::text
    `;

    const companyQ = `
      SELECT
        cwt.id,
        'company'         AS "ownerType",
        c.name            AS "ownerHandle",
        c.name            AS "ownerName",
        c."logoUrl"       AS "ownerAvatarUrl",
        cwt."coinType",
        cwt.amount,
        cwt.source::text  AS source,
        cwt."referenceId",
        cwt.description,
        cwt."createdAt"
      FROM company_wallet_transactions cwt
      JOIN company_wallets cw ON cw.id = cwt."walletId"
      JOIN companies c        ON c.id::text = cw."companyId"::text
    `;

    let unionSql: string;
    if (type === 'member') {
      unionSql = memberQ;
    } else if (type === 'company') {
      unionSql = companyQ;
    } else {
      unionSql = `(${memberQ}) UNION ALL (${companyQ})`;
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) AS combined`;
    const dataSql = `SELECT * FROM (${unionSql}) AS combined ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`;

    const [countResult, rows] = await Promise.all([
      this.dataSource.query(countSql),
      this.dataSource.query(dataSql, [limit, offset]),
    ]);

    return {
      data: rows,
      total: Number.parseInt(countResult[0]?.total ?? '0', 10),
    };
  }
}
