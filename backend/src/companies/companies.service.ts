import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import {
  CompanyWalletTransaction,
  CompanyWalletTxSource,
} from './entities/company-wallet-transaction.entity';
import { CompanyMember } from './entities/company-member.entity';
import { Member } from '../members/entities/member.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CoinDistributionItemDto } from './dto/distribute-coins.dto';
import { ClubService } from '../club/club.service';

/** Quantos SortCoins por real (mesmo valor do clube PF) */
const SORT_COINS_PER_REAL = 1; // 1 real = 1 SortCoin
const DEFAULT_COIN = 'sort_coin';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyWallet)
    private readonly walletRepo: Repository<CompanyWallet>,
    @InjectRepository(CompanyWalletTransaction)
    private readonly txRepo: Repository<CompanyWalletTransaction>,
    @InjectRepository(CompanyMember)
    private readonly memberRepo: Repository<CompanyMember>,
    @InjectRepository(Member)
    private readonly memberEntityRepo: Repository<Member>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ClubService))
    private readonly clubService: ClubService,
  ) {}

  private normalizePagination(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT): { page: number; limit: number; skip: number } {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGE;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async register(dto: CreateCompanyDto, responsibleMemberId: string): Promise<Company> {
    validateCnpj(dto.cnpj);

    const exists = await this.companyRepo.findOne({ where: { cnpj: dto.cnpj } });
    if (exists) throw new ConflictException('CNPJ já cadastrado');

    const alreadyResponsible = await this.companyRepo.findOne({
      where: { responsibleMemberId },
    });
    if (alreadyResponsible)
      throw new ConflictException('Este membro já é responsável por uma empresa');

    return this.companyRepo.save(
      this.companyRepo.create({
        cnpj: dto.cnpj,
        name: dto.name,
        logoUrl: dto.logoUrl ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        responsibleMemberId,
        status: CompanyStatus.PENDING,
      }),
    );
  }

  async update(
    companyId: string,
    dto: UpdateCompanyDto,
    requestingMemberId: string,
  ): Promise<Company> {
    const company = await this.findOwned(companyId, requestingMemberId);
    Object.assign(company, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
    });
    return this.companyRepo.save(company);
  }

  async findByMember(memberId: string): Promise<Company | null> {
    return this.companyRepo.findOne({ where: { responsibleMemberId: memberId } });
  }

  /** Retorna empresas onde o membro é colaborador (não responsável) */
  async findCollaborations(memberId: string): Promise<Company[]> {
    const member = await this.memberEntityRepo.findOne({ where: { id: memberId } });
    if (!member) return [];
    const memberships = await this.memberRepo
      .createQueryBuilder('membership')
      .where(
        'membership."memberId" = :memberId OR LOWER(LTRIM(membership."memberId", \'@\')) = :handle',
        {
          memberId,
          handle: member.githubHandle.toLowerCase(),
        },
      )
      .getMany();
    if (memberships.length === 0) return [];
    const ids = memberships.map((m) => m.companyId);
    return this.companyRepo.find({ where: { id: In(ids) } });
  }

  async findById(id: string): Promise<Company> {
    const c = await this.companyRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  async findPublicInfo(id: string): Promise<{
    id: string;
    name: string;
    cnpj: string | null;
    logoUrl: string | null;
    websiteUrl: string | null;
    responsibleGithubHandle: string | null;
  }> {
    const c = await this.companyRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Empresa não encontrada');

    let responsibleGithubHandle: string | null = null;
    if (c.responsibleMemberId) {
      const member = await this.memberEntityRepo.findOne({
        where: { id: c.responsibleMemberId },
      });
      responsibleGithubHandle = member?.githubHandle ?? null;
    }

    return {
      id: c.id,
      name: c.name,
      cnpj: c.cnpj ?? null,
      logoUrl: c.logoUrl ?? null,
      websiteUrl: c.websiteUrl ?? null,
      responsibleGithubHandle,
    };
  }

  async findPublicAffiliationByHandle(handle: string): Promise<{
    id: string;
    name: string;
    cnpj: string | null;
    logoUrl: string | null;
    websiteUrl: string | null;
    responsibleGithubHandle: string | null;
  } | null> {
    const normalizedHandle = handle.trim().toLowerCase();
    if (!normalizedHandle) return null;

    const member = await this.memberEntityRepo
      .createQueryBuilder('member')
      .where('LOWER(member."githubHandle") = :handle', { handle: normalizedHandle })
      .andWhere('member."isActive" = true')
      .getOne();
    if (!member) return null;

    const ownCompany = await this.companyRepo.findOne({
      where: {
        responsibleMemberId: member.id,
        status: CompanyStatus.ACTIVE,
      },
    });
    if (ownCompany) return this.findPublicInfo(ownCompany.id);

    const memberships = await this.memberRepo
      .createQueryBuilder('membership')
      .where('LOWER(LTRIM(membership."memberId", \'@\')) = :handle', { handle: normalizedHandle })
      .getMany();
    if (memberships.length === 0) return null;

    const companyIds = [...new Set(memberships.map((m) => m.companyId))];
    const company = await this.companyRepo.findOne({
      where: {
        id: In(companyIds),
        status: CompanyStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
    if (!company) return null;

    return this.findPublicInfo(company.id);
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findAllAdmin(): Promise<
    (
      Company & {
        responsibleGithubHandle: string | null;
        sortCoinBalance: number;
        totalSupportedReais: number;
        supportCount: number;
        monthsSupporting: number;
      }
    )[]
  > {
    const companies = await this.companyRepo.find({ order: { createdAt: 'DESC' } });
    const metrics = await this.loadSupportMetricsByCompanyIds(companies.map((c) => c.id));
    return Promise.all(
      companies.map(async (c) => {
        const [member, wallet] = await Promise.all([
          c.responsibleMemberId
            ? this.memberEntityRepo.findOne({ where: { id: c.responsibleMemberId } })
            : Promise.resolve(null),
          this.walletRepo.findOne({ where: { companyId: c.id } }),
        ]);
        const metric = metrics.get(c.id) ?? {
          totalSupportedReais: 0,
          supportCount: 0,
          monthsSupporting: 0,
        };
        return {
          ...c,
          responsibleGithubHandle: member?.githubHandle ?? null,
          sortCoinBalance: wallet?.balances?.[DEFAULT_COIN] ?? 0,
          totalSupportedReais: metric.totalSupportedReais,
          supportCount: metric.supportCount,
          monthsSupporting: metric.monthsSupporting,
        };
      }),
    );
  }

  async findAllAdminPaginated(
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    items: (
      Company & {
        responsibleGithubHandle: string | null;
        sortCoinBalance: number;
        totalSupportedReais: number;
        supportCount: number;
        monthsSupporting: number;
      }
    )[];
    total: number;
    page: number;
    limit: number;
  }> {
    const all = await this.findAllAdmin();
    const { page: safePage, limit: safeLimit, skip } = this.normalizePagination(page, limit);
    return {
      items: all.slice(skip, skip + safeLimit),
      total: all.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  async updateStatus(id: string, status: string): Promise<Company> {
    const company = await this.findById(id);
    company.status = status as CompanyStatus;
    company.showOnSponsorsPage = company.status === CompanyStatus.ACTIVE;
    return this.companyRepo.save(company);
  }

  async listSponsors(): Promise<Array<Company & { totalSupportedReais: number; supportCount: number; monthsSupporting: number }>> {
    const sponsors = await this.companyRepo.find({
      where: { status: CompanyStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    if (sponsors.length === 0) return [];

    const metricByCompany = await this.loadSupportMetricsByCompanyIds(
      sponsors.map((company) => company.id),
    );

    return sponsors.map((company) => {
      const metric = metricByCompany.get(company.id) ?? {
        totalSupportedReais: 0,
        supportCount: 0,
        monthsSupporting: 0,
      };
      return {
        ...company,
        totalSupportedReais: metric.totalSupportedReais,
        supportCount: metric.supportCount,
        monthsSupporting: metric.monthsSupporting,
      };
    });
  }

  async listSponsorsPaginated(
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    items: Array<Company & { totalSupportedReais: number; supportCount: number; monthsSupporting: number }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const all = await this.listSponsors();
    const { page: safePage, limit: safeLimit, skip } = this.normalizePagination(page, limit);
    return {
      items: all.slice(skip, skip + safeLimit),
      total: all.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * IDs de membros que pertencem ao CLUB Business (responsáveis + colaboradores)
   * em empresas ativas. Útil para badges públicas em /membros e /membros/perfil.
   */
  async listBusinessMemberIds(): Promise<string[]> {
    const activeCompanies = await this.companyRepo.find({
      where: { status: CompanyStatus.ACTIVE },
      select: ['id'],
    });
    if (activeCompanies.length === 0) return [];

    const members = await this.listBusinessMembersForCompanyIds(
      activeCompanies.map((company) => company.id),
    );
    return [...new Set(members.map((member) => member.memberId))];
  }

  /**
   * Resolve membros CLUB Business (responsáveis + colaboradores) para empresas específicas.
   * Usado pelo Stripe para retornar badges públicas alinhadas às assinaturas empresariais.
   */
  async listBusinessMembersForCompanyIds(companyIds: string[]): Promise<
    Array<{ memberId: string; role: 'owner' | 'collaborator' }>
  > {
    const uniqueCompanyIds = [...new Set(companyIds.filter(Boolean))];
    if (uniqueCompanyIds.length === 0) return [];

    const companies = await this.companyRepo.find({
      where: { id: In(uniqueCompanyIds) },
      select: ['id', 'responsibleMemberId'],
    });
    if (companies.length === 0) return [];

    const scopedCompanyIds = companies.map((company) => company.id);
    const ownerRows = companies
      .map((company) => company.responsibleMemberId)
      .filter(Boolean)
      .map((memberId) => ({ memberId, role: 'owner' as const }));

    const collaboratorLinks = await this.memberRepo.find({
      where: { companyId: In(scopedCompanyIds) },
      select: ['memberId'],
    });
    const collaboratorHandles = [...new Set(
      collaboratorLinks
        .map((link) => link.memberId)
        .map((memberId) => memberId.trim().replace(/^@/, '').toLowerCase())
        .filter(Boolean),
    )];

    const collaboratorMembers = collaboratorHandles.length
      ? await this.memberEntityRepo.find({
          where: {
            githubHandle: In(collaboratorHandles),
            isActive: true,
          },
          select: ['id'],
        })
      : [];
    const collaboratorRows = collaboratorMembers.map((member) => ({
      memberId: member.id,
      role: 'collaborator' as const,
    }));

    const byMemberId = new Map<string, { memberId: string; role: 'owner' | 'collaborator' }>();
    for (const row of [...ownerRows, ...collaboratorRows]) {
      const previous = byMemberId.get(row.memberId);
      if (!previous || previous.role !== 'owner') {
        byMemberId.set(row.memberId, row);
      }
    }

    return [...byMemberId.values()];
  }

  async getSupportSummary(companyId: string): Promise<{
    totalSupportedReais: number;
    supportCount: number;
    monthsSupporting: number;
  }> {
    const metrics = await this.loadSupportMetricsByCompanyIds([companyId]);
    return (
      metrics.get(companyId) ?? {
        totalSupportedReais: 0,
        supportCount: 0,
        monthsSupporting: 0,
      }
    );
  }

  // ── Stripe lifecycle ──────────────────────────────────────────────────────

  /** Chamado após criação de checkout session Stripe (salva customerId) */
  async setStripeCustomer(companyId: string, stripeCustomerId: string): Promise<void> {
    await this.companyRepo.update(companyId, { stripeCustomerId });
  }

  /** Salva o stripeSubscriptionId na empresa */
  async setStripeSubscription(companyId: string, stripeSubscriptionId: string): Promise<void> {
    await this.companyRepo.update(companyId, { stripeSubscriptionId });
  }

  /** Persiste o valor configurado da recorrência da empresa (centavos). */
  async setSubscriptionAmount(companyId: string, subscriptionAmountCents: number): Promise<void> {
    await this.companyRepo.update(companyId, { subscriptionAmountCents });
  }

  /**
   * Registra créditos de SortCoins em invoice paga de assinatura empresarial.
   * Não altera status da empresa (ativação é manual via admin).
   */
  async activateFromInvoice(
    stripeSubscriptionId: string,
    stripeCustomerId: string,
    amountReais: number,
    referenceId: string,
    companyId?: string,
  ): Promise<void> {
    let company = companyId
      ? await this.companyRepo.findOne({ where: { id: companyId } })
      : null;
    if (!company) {
      company = await this.companyRepo.findOne({
        where: { stripeSubscriptionId },
      });
    }
    if (!company) {
      company = await this.companyRepo.findOne({ where: { stripeCustomerId } });
    }
    if (!company) {
      console.warn(
        `Company não encontrada para invoice ${referenceId} (sub: ${stripeSubscriptionId})`,
      );
      return;
    }

    if (company.stripeSubscriptionId !== stripeSubscriptionId) {
      await this.companyRepo.update(company.id, { stripeSubscriptionId });
      company.stripeSubscriptionId = stripeSubscriptionId;
    }

    const amountCents = Math.round(amountReais * 100);
    if (amountCents > 0 && company.subscriptionAmountCents !== amountCents) {
      await this.companyRepo.update(company.id, {
        subscriptionAmountCents: amountCents,
      });
      company.subscriptionAmountCents = amountCents;
    }

    const coins = Math.floor(amountReais * SORT_COINS_PER_REAL);
    await this.creditCoins(company.id, coins, CompanyWalletTxSource.STRIPE_INVOICE, referenceId);
  }

  /** Suspende empresa ao cancelar assinatura */
  async suspendFromSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    const company = await this.companyRepo.findOne({
      where: { stripeSubscriptionId },
    });
    if (!company) return;

    await this.companyRepo.update(company.id, {
      status: CompanyStatus.SUSPENDED,
      stripeSubscriptionId: null,
      subscriptionAmountCents: 0,
    });
    await this.freezeWallet(company.id);
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async getOrCreateWallet(companyId: string): Promise<CompanyWallet> {
    const existing = await this.walletRepo.findOne({ where: { companyId } });
    if (existing) return existing;
    return this.walletRepo.save(
      this.walletRepo.create({ companyId, balances: {}, frozenTypes: [] }),
    );
  }

  async getWallet(companyId: string): Promise<CompanyWallet> {
    const wallet = await this.walletRepo.findOne({ where: { companyId } });
    if (!wallet) throw new NotFoundException('Carteira da empresa não encontrada');
    return wallet;
  }

  async getTransactions(
    companyId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{ items: CompanyWalletTransaction[]; total: number; page: number; limit: number }> {
    const wallet = await this.getWallet(companyId);
    const { page: safePage, limit: safeLimit, skip } = this.normalizePagination(page, limit);
    const [items, total] = await this.txRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip,
      take: safeLimit,
    });
    return { items, total, page: safePage, limit: safeLimit };
  }

  async debitForRaffle(
    walletId: string,
    coins: number,
    referenceId: string,
    coinType = DEFAULT_COIN,
    manager?: EntityManager,
  ): Promise<CompanyWalletTransaction> {
    const run = async (em: EntityManager) => {
      const wallet = await em
        .getRepository(CompanyWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      if (wallet.frozenTypes.includes(coinType))
        throw new BadRequestException(`Moeda ${coinType} está congelada`);

      const balance = wallet.balances[coinType] ?? 0;
      if (balance < coins) throw new BadRequestException('Saldo insuficiente');

      wallet.balances = { ...wallet.balances, [coinType]: balance - coins };
      await em.getRepository(CompanyWallet).save(wallet);

      const tx = em.getRepository(CompanyWalletTransaction).create({
        walletId,
        coinType,
        amount: -coins,
        source: CompanyWalletTxSource.RAFFLE_ENTRY,
        referenceId,
        description: 'Inscrição em sorteio',
      });
      return em.getRepository(CompanyWalletTransaction).save(tx);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  async refundFromRaffle(
    walletId: string,
    coins: number,
    raffleId: string,
    coinType = DEFAULT_COIN,
  ): Promise<CompanyWalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const wallet = await em
        .getRepository(CompanyWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      wallet.balances = {
        ...wallet.balances,
        [coinType]: (wallet.balances[coinType] ?? 0) + coins,
      };
      await em.getRepository(CompanyWallet).save(wallet);

      const tx = em.getRepository(CompanyWalletTransaction).create({
        walletId,
        coinType,
        amount: coins,
        source: CompanyWalletTxSource.RAFFLE_REFUND,
        referenceId: `raffle-refund:${raffleId}:${walletId}`,
        description: 'Estorno por cancelamento de sorteio',
      });
      return em.getRepository(CompanyWalletTransaction).save(tx);
    });
  }

  async manualAdjust(
    companyId: string,
    amount: number,
    coinType = DEFAULT_COIN,
    description?: string,
  ): Promise<CompanyWalletTransaction> {
    if (amount === 0) throw new BadRequestException('Ajuste não pode ser zero');
    const wallet = await this.getOrCreateWallet(companyId);
    return this.applyBalance(wallet.id, amount, coinType, CompanyWalletTxSource.MANUAL_ADMIN, null, description);
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  private async loadSupportMetricsByCompanyIds(
    companyIds: string[],
  ): Promise<
    Map<
      string,
      { totalSupportedReais: number; supportCount: number; monthsSupporting: number }
    >
  > {
    if (companyIds.length === 0) return new Map();

    const rows = await this.txRepo
      .createQueryBuilder('tx')
      .select('w."companyId"', 'companyId')
      .addSelect(
        'COALESCE(SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END), 0)',
        'totalSupportedReais',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN tx.amount > 0 THEN 1 ELSE 0 END), 0)',
        'supportCount',
      )
      .innerJoin(CompanyWallet, 'w', 'w.id = tx."walletId"')
      .where('w."companyId" IN (:...companyIds)', { companyIds })
      .andWhere('tx.source = :source', { source: CompanyWalletTxSource.STRIPE_INVOICE })
      .andWhere('tx."coinType" = :coinType', { coinType: DEFAULT_COIN })
      .groupBy('w."companyId"')
      .getRawMany<{
        companyId: string;
        totalSupportedReais: string;
        supportCount: string;
      }>();

    return new Map(
      rows.map((row) => {
        const totalSupportedReais = Number.parseInt(row.totalSupportedReais ?? '0', 10);
        const supportCount = Number.parseInt(row.supportCount ?? '0', 10);
        return [
          row.companyId,
          {
            totalSupportedReais,
            supportCount,
            monthsSupporting: Math.floor(totalSupportedReais / 200),
          },
        ];
      }),
    );
  }

  private async creditCoins(
    companyId: string,
    coins: number,
    source: CompanyWalletTxSource,
    referenceId: string,
    coinType = DEFAULT_COIN,
    description?: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(companyId);
    await this.applyBalance(wallet.id, coins, coinType, source, referenceId, description);
  }

  private async applyBalance(
    walletId: string,
    amount: number,
    coinType: string,
    source: CompanyWalletTxSource,
    referenceId: string | null,
    description?: string,
  ): Promise<CompanyWalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const txRepo = em.getRepository(CompanyWalletTransaction);
      const txWhere: FindOptionsWhere<CompanyWalletTransaction> = {
        walletId,
        source,
        referenceId: referenceId ?? IsNull(),
        coinType,
      };
      if (referenceId) {
        const existing = await txRepo.findOne({ where: txWhere });
        if (existing) return existing;
      }

      let savedTx: CompanyWalletTransaction;
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
        throw new ConflictException('Transação duplicada');
      }

      const wallet = await em
        .getRepository(CompanyWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) throw new NotFoundException('Carteira não encontrada');

      const currentBalance = wallet.balances[coinType] ?? 0;
      const nextBalance = currentBalance + amount;
      if (amount < 0 && nextBalance < 0) {
        throw new BadRequestException(
          `Saldo insuficiente: ${currentBalance} ${coinType} disponíveis, ${Math.abs(amount)} solicitados`,
        );
      }

      wallet.balances = {
        ...wallet.balances,
        [coinType]: nextBalance,
      };
      await em.getRepository(CompanyWallet).save(wallet);
      return savedTx;
    });
  }

  private async freezeWallet(companyId: string, coinType = DEFAULT_COIN): Promise<void> {
    const wallet = await this.getOrCreateWallet(companyId);
    if (!wallet.frozenTypes.includes(coinType)) {
      wallet.frozenTypes = [...wallet.frozenTypes, coinType];
      await this.walletRepo.save(wallet);
    }
  }

  // ── Distribuição de SortCoins ─────────────────────────────────────────────

  /**
   * Distribui SortCoins da carteira da empresa para membros (responsável ou colaboradores).
   * `distributions`: array de { githubHandle, amount }
   */
  async distributeCoins(
    companyId: string,
    distributions: CoinDistributionItemDto[],
    requesterMemberId: string,
  ): Promise<{ distributed: number; recipients: number }> {
    const company = await this.findOwned(companyId, requesterMemberId);

    const mergedByHandle = new Map<string, number>();
    for (const dist of distributions) {
      const normalizedHandle = dist.githubHandle.trim().toLowerCase();
      if (!normalizedHandle) {
        throw new BadRequestException('githubHandle inválido');
      }
      mergedByHandle.set(
        normalizedHandle,
        (mergedByHandle.get(normalizedHandle) ?? 0) + dist.amount,
      );
    }

    const normalizedDistributions = Array.from(mergedByHandle.entries()).map(
      ([githubHandle, amount]) => ({ githubHandle, amount }),
    );

    const totalToDistribute = normalizedDistributions.reduce((s, d) => s + d.amount, 0);
    if (totalToDistribute <= 0) throw new BadRequestException('Valor total deve ser positivo');

    const [responsibleMember, collaborators] = await Promise.all([
      this.memberEntityRepo.findOne({
        where: { id: company.responsibleMemberId },
        select: ['githubHandle'],
      }),
      this.memberRepo.find({
        where: { companyId },
        select: ['memberId'],
      }),
    ]);
    if (!responsibleMember) {
      throw new NotFoundException('Responsável da empresa não encontrado');
    }

    const allowedHandles = new Set<string>([
      responsibleMember.githubHandle.toLowerCase(),
      ...collaborators.map((collaborator) => collaborator.memberId.toLowerCase()),
    ]);
    const invalidRecipients = normalizedDistributions
      .map((dist) => dist.githubHandle)
      .filter((handle) => !allowedHandles.has(handle));
    if (invalidRecipients.length > 0) {
      throw new BadRequestException(
        `Destinatário(s) sem vínculo com a empresa: ${invalidRecipients.join(', ')}`,
      );
    }

    const members = await this.memberEntityRepo
      .createQueryBuilder('member')
      .where('LOWER(member."githubHandle") IN (:...handles)', {
        handles: normalizedDistributions.map((dist) => dist.githubHandle),
      })
      .andWhere('member."isActive" = true')
      .getMany();
    const memberByHandle = new Map(
      members.map((member) => [member.githubHandle.toLowerCase(), member]),
    );
    const missingMembers = normalizedDistributions
      .map((dist) => dist.githubHandle)
      .filter((handle) => !memberByHandle.has(handle));
    if (missingMembers.length > 0) {
      throw new BadRequestException(
        `Membro(s) não encontrado(s) ou inativo(s): ${missingMembers.join(', ')}`,
      );
    }

    const distRefTs = Date.now().toString();
    const distRef = `company-dist:${companyId}:${distRefTs}`;
    const successfulCredits: Array<{ memberId: string; amount: number }> = [];
    let companyDebited = false;

    try {
      // Débita da empresa com source COMPANY_DISTRIBUTION para rastreabilidade
      await this.creditCoins(
        companyId,
        -totalToDistribute,
        CompanyWalletTxSource.COMPANY_DISTRIBUTION,
        distRef,
        DEFAULT_COIN,
        `Distribuição para ${normalizedDistributions.length} destinatário(s)`,
      );
      companyDebited = true;

      // Credita cada destinatário (resolve githubHandle → memberId UUID)
      for (const dist of normalizedDistributions) {
        const member = memberByHandle.get(dist.githubHandle)!;
        await this.clubService.creditDistribution(
          member.id,
          dist.amount,
          `company-dist:${companyId}:${member.id}:${distRefTs}`,
          `Distribuição da empresa (${dist.amount} SortCoins)`,
        );
        successfulCredits.push({ memberId: member.id, amount: dist.amount });
      }
    } catch (error) {
      for (const credit of successfulCredits) {
        await this.clubService.creditDistribution(
          credit.memberId,
          -credit.amount,
          `company-dist-reversal:${companyId}:${credit.memberId}:${distRefTs}`,
          `Reversão de distribuição da empresa (${credit.amount} SortCoins)`,
        );
      }

      if (companyDebited) {
        await this.creditCoins(
          companyId,
          totalToDistribute,
          CompanyWalletTxSource.COMPANY_DISTRIBUTION,
          `company-dist-reversal:${companyId}:${distRefTs}`,
          DEFAULT_COIN,
          `Reversão de distribuição para ${normalizedDistributions.length} destinatário(s)`,
        );
      }

      throw error;
    }

    return { distributed: totalToDistribute, recipients: normalizedDistributions.length };
  }

  // ── Colaboradores ─────────────────────────────────────────────────────────

  async getCollaborators(companyId: string): Promise<CompanyMember[]> {
    return this.memberRepo.find({ where: { companyId } });
  }

  async addCollaborator(companyId: string, githubHandle: string, requesterMemberId: string): Promise<CompanyMember> {
    await this.findOwned(companyId, requesterMemberId);

    const normalizedHandle = githubHandle.trim().toLowerCase();
    if (!normalizedHandle) {
      throw new BadRequestException('githubHandle inválido');
    }

    // garante que o responsável não adiciona a si mesmo pelo handle
    const requester = await this.memberEntityRepo.findOne({ where: { id: requesterMemberId } });
    if (requester?.githubHandle.toLowerCase() === normalizedHandle) {
      throw new BadRequestException('O responsável já tem acesso à empresa');
    }

    const existing = await this.memberRepo.findOne({
      where: { companyId, memberId: normalizedHandle },
    });
    if (existing) throw new ConflictException('Colaborador já adicionado');

    const entry = this.memberRepo.create({ companyId, memberId: normalizedHandle });
    return this.memberRepo.save(entry);
  }

  async removeCollaborator(companyId: string, collaboratorId: string, requesterMemberId: string): Promise<void> {
    await this.findOwned(companyId, requesterMemberId);
    await this.memberRepo.delete({ id: collaboratorId, companyId });
  }

  /** Retorna true se o membro é responsável ou colaborador da empresa.
   * memberId é o UUID do JWT; colaboradores são armazenados por githubHandle.
   */
  async isMemberOfCompany(companyId: string, memberId: string): Promise<boolean> {
    const company = await this.findById(companyId);
    if (company.responsibleMemberId === memberId) return true;
    // resolve UUID → githubHandle para checar na tabela company_members
    const member = await this.memberEntityRepo.findOne({ where: { id: memberId } });
    if (!member) return false;
    const collab = await this.memberRepo
      .createQueryBuilder('membership')
      .where('membership."companyId" = :companyId', { companyId })
      .andWhere(
        'membership."memberId" = :memberId OR LOWER(LTRIM(membership."memberId", \'@\')) = :handle',
        {
          memberId,
          handle: member.githubHandle.toLowerCase(),
        },
      )
      .getOne();
    return !!collab;
  }

  private async findOwned(companyId: string, memberId: string): Promise<Company> {
    const company = await this.findById(companyId);
    if (company.responsibleMemberId !== memberId)
      throw new BadRequestException('Sem permissão para esta empresa');
    return company;
  }
}

// ── CNPJ validator (inline — sem dependência externa) ─────────────────────────
export function validateCnpj(cnpj: string): void {
  if (!/^\d{14}$/.test(cnpj))
    throw new BadRequestException('CNPJ inválido (deve conter 14 dígitos)');

  // rejeita sequências como 00000000000000
  if (/^(\d)\1{13}$/.test(cnpj))
    throw new BadRequestException('CNPJ inválido');

  const calc = (digits: string, weights: number[]): number => {
    const sum = digits
      .split('')
      .reduce((acc, d, i) => acc + Number.parseInt(d, 10) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(cnpj.slice(0, 12), weights1);
  const d2 = calc(cnpj.slice(0, 13), weights2);

  if (d1 !== Number.parseInt(cnpj[12], 10) || d2 !== Number.parseInt(cnpj[13], 10))
    throw new BadRequestException('CNPJ inválido (dígitos verificadores incorretos)');
}
