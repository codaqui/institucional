import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Account, AccountType } from './entities/account.entity';
import { Transaction } from './entities/transaction.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async createAccount(name: string, type: AccountType, projectKey?: string) {
    const account = this.accountRepo.create({ name, type, projectKey });
    return this.accountRepo.save(account);
  }

  async getOrCreateCommunityAccount(
    projectKey: string,
    defaultName: string,
    type: AccountType = AccountType.VIRTUAL_WALLET,
  ): Promise<Account> {
    const existing = await this.accountRepo.findOneBy({ projectKey });
    if (existing) return existing;

    try {
      return await this.createAccount(defaultName, type, projectKey);
    } catch (err: unknown) {
      // Violação de UNIQUE constraint — outra instância criou a conta simultaneamente
      const account = await this.accountRepo.findOneBy({ projectKey });
      if (account) return account;
      throw err;
    }
  }

  async recordTransaction(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be strictly positive');
    }
    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException(
        'Source and destination cannot be the same',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const source = await manager.findOneBy(Account, { id: sourceAccountId });
      const dest = await manager.findOneBy(Account, {
        id: destinationAccountId,
      });

      if (!source || !dest) {
        throw new BadRequestException('Invalid account IDs provided');
      }

      const tx = manager.create(Transaction, {
        sourceAccount: source,
        destinationAccount: dest,
        amount,
        description,
        referenceId,
      });

      return manager.save(tx);
    });
  }

  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account) {
      throw new BadRequestException('Account not found');
    }

    const { sum: credits } = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'sum')
      .where('tx.destinationAccountId = :id', { id: accountId })
      .getRawOne();

    const { sum: debits } = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'sum')
      .where('tx.sourceAccountId = :id', { id: accountId })
      .getRawOne();

    return (Number.parseFloat(credits) || 0) - (Number.parseFloat(debits) || 0);
  }

  async getAccountTransactions(
    accountId: string,
    page = 1,
    limit = 10,
    filters?: { type?: string; days?: number; search?: string },
  ): Promise<PaginatedResult<Transaction>> {
    const skip = (page - 1) * limit;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.sourceAccount', 'src')
      .leftJoinAndSelect('tx.destinationAccount', 'dst')
      .where(
        new Brackets((sub) =>
          sub.where('tx.sourceAccountId = :id').orWhere('tx.destinationAccountId = :id'),
        ),
        { id: accountId },
      );

    // Type filter
    if (filters?.type) {
      switch (filters.type) {
        case 'donation':
          qb.andWhere(
            "(tx.referenceId LIKE 'cs_%' OR tx.referenceId LIKE 'in_%' OR tx.description ILIKE 'doação%' OR tx.description ILIKE 'assinatura%')",
          );
          break;
        case 'reimbursement':
          qb.andWhere(
            "(tx.referenceId LIKE 'reimbursement:%' OR tx.description ILIKE 'reembolso%')",
          );
          break;
        case 'vendor-payment':
          qb.andWhere(
            "(tx.referenceId LIKE 'vendor-payment:%' OR tx.description ILIKE 'pagamento a fornecedor%')",
          );
          break;
        case 'transfer':
          qb.andWhere(
            "(tx.referenceId LIKE 'transfer:%' OR tx.description ILIKE 'transfer%')",
          );
          break;
      }
    }

    // Date filter
    if (filters?.days) {
      const since = new Date();
      since.setDate(since.getDate() - filters.days);
      qb.andWhere('tx.createdAt >= :since', { since });
    }

    // Search filter
    if (filters?.search) {
      qb.andWhere('tx.description ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    const [data, total] = await qb
      .orderBy('tx.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAccounts(): Promise<Account[]> {
    return this.accountRepo.find();
  }

  async getCommunityBalances(): Promise<
    Array<{ id: string; projectKey: string; name: string; balance: number }>
  > {
    const accounts = await this.accountRepo
      .createQueryBuilder('acc')
      .where('acc.projectKey IS NOT NULL')
      .andWhere('acc.type = :type', { type: AccountType.VIRTUAL_WALLET })
      .getMany();

    const result = await Promise.all(
      accounts.map(async (acc) => {
        const balance = await this.getAccountBalance(acc.id);
        return {
          id: acc.id,
          projectKey: acc.projectKey,
          name: acc.name,
          balance,
        };
      }),
    );

    return result;
  }

  async getTransparencyStats(): Promise<{
    totalReceived: number;
    totalExpenses: number;
    totalTransactions: number;
    uniqueDonors: number;
    recentDonors: Array<{
      handle: string;
      communityName: string;
      date: string;
      amount: number;
    }>;
    communityStats: Array<{
      projectKey: string;
      name: string;
      totalIn: number;
      totalOut: number;
      txCount: number;
    }>;
  }> {
    const wallets = await this.accountRepo
      .createQueryBuilder('acc')
      .where('acc.projectKey IS NOT NULL')
      .andWhere('acc.type = :type', { type: AccountType.VIRTUAL_WALLET })
      .getMany();

    const walletIds = wallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return {
        totalReceived: 0,
        totalExpenses: 0,
        totalTransactions: 0,
        uniqueDonors: 0,
        recentDonors: [],
        communityStats: [],
      };
    }

    // Total received (credits to wallets, excluding internal transfers)
    const { sum: totalReceived } = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'sum')
      .where('tx.destinationAccountId IN (:...ids)', { ids: walletIds })
      .andWhere(
        "(tx.referenceId IS NULL OR tx.referenceId NOT LIKE 'transfer:%')",
      )
      .getRawOne();

    // Total expenses (debits from wallets, excluding internal transfers)
    const { sum: totalExpenses } = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'sum')
      .where('tx.sourceAccountId IN (:...ids)', { ids: walletIds })
      .andWhere(
        "(tx.referenceId IS NULL OR tx.referenceId NOT LIKE 'transfer:%')",
      )
      .getRawOne();

    // Total transactions involving wallets
    const { count: totalTransactions } = await this.txRepo
      .createQueryBuilder('tx')
      .select('COUNT(tx.id)', 'count')
      .where(
        'tx.destinationAccountId IN (:...ids) OR tx.sourceAccountId IN (:...ids)',
        { ids: walletIds },
      )
      .getRawOne();

    // Unique donors — extract handles from descriptions like "Doação de @handle" or "Assinatura mensal de @handle"
    const donorRows: Array<{ handle: string }> = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        String.raw`DISTINCT SUBSTRING(tx.description FROM '(?:Doação|Assinatura (?:mensal|anual)) de (@[\w.-]+)')`,
        'handle',
      )
      .where('tx.destinationAccountId IN (:...ids)', { ids: walletIds })
      .andWhere(
        "(tx.description LIKE 'Doação de @%' OR tx.description LIKE 'Assinatura%de @%')",
      )
      .getRawMany();
    const uniqueDonors = donorRows.filter((r) => r.handle).length;

    // Recent donors (last 10)
    const recentDonorRows: Array<{
      handle: string;
      communityName: string;
      date: string;
      amount: number;
    }> = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoin('tx.destinationAccount', 'dst')
      .select([
        String.raw`SUBSTRING(tx.description FROM '(?:Doação|Assinatura (?:mensal|anual)) de (@[\w.-]+)') AS handle`,
        'dst.name AS "communityName"',
        'tx.createdAt AS date',
        'tx.amount AS amount',
      ])
      .where('tx.destinationAccountId IN (:...ids)', { ids: walletIds })
      .andWhere(
        "(tx.description LIKE 'Doação de @%' OR tx.description LIKE 'Assinatura%de @%')",
      )
      .orderBy('tx.createdAt', 'DESC')
      .limit(10)
      .getRawMany();
    const recentDonors = recentDonorRows.filter((r) => r.handle);

    // Per-community stats (grouped queries instead of N+1)
    const inboundRows: Array<{ accountId: string; totalIn: string; inboundCount: string }> =
      await this.txRepo
        .createQueryBuilder('tx')
        .select('tx.destinationAccountId', 'accountId')
        .addSelect('COALESCE(SUM(tx.amount), 0)', 'totalIn')
        .addSelect('COUNT(tx.id)', 'inboundCount')
        .where('tx.destinationAccountId IN (:...ids)', { ids: walletIds })
        .groupBy('tx.destinationAccountId')
        .getRawMany();

    const outboundRows: Array<{ accountId: string; totalOut: string; outboundCount: string }> =
      await this.txRepo
        .createQueryBuilder('tx')
        .select('tx.sourceAccountId', 'accountId')
        .addSelect('COALESCE(SUM(tx.amount), 0)', 'totalOut')
        .addSelect('COUNT(tx.id)', 'outboundCount')
        .where('tx.sourceAccountId IN (:...ids)', { ids: walletIds })
        .groupBy('tx.sourceAccountId')
        .getRawMany();

    const inboundByAccount = new Map(
      inboundRows.map((r) => [r.accountId, {
        totalIn: Number.parseFloat(r.totalIn) || 0,
        count: Number.parseInt(r.inboundCount, 10) || 0,
      }]),
    );
    const outboundByAccount = new Map(
      outboundRows.map((r) => [r.accountId, {
        totalOut: Number.parseFloat(r.totalOut) || 0,
        count: Number.parseInt(r.outboundCount, 10) || 0,
      }]),
    );

    // Count self-transfers to avoid double-counting
    const selfTransferRows: Array<{ accountId: string; selfCount: string }> =
      await this.txRepo
        .createQueryBuilder('tx')
        .select('tx.sourceAccountId', 'accountId')
        .addSelect('COUNT(tx.id)', 'selfCount')
        .where('tx.sourceAccountId IN (:...ids)', { ids: walletIds })
        .andWhere('tx.sourceAccountId = tx.destinationAccountId')
        .groupBy('tx.sourceAccountId')
        .getRawMany();
    const selfByAccount = new Map(
      selfTransferRows.map((r) => [r.accountId, Number.parseInt(r.selfCount, 10) || 0]),
    );

    const communityStats = wallets.map((w) => {
      const id = String(w.id);
      const inbound = inboundByAccount.get(id);
      const outbound = outboundByAccount.get(id);
      const selfCount = selfByAccount.get(id) || 0;
      return {
        projectKey: w.projectKey,
        name: w.name,
        totalIn: inbound?.totalIn || 0,
        totalOut: outbound?.totalOut || 0,
        txCount: (inbound?.count || 0) + (outbound?.count || 0) - selfCount,
      };
    });

    return {
      totalReceived: Number.parseFloat(totalReceived) || 0,
      totalExpenses: Number.parseFloat(totalExpenses) || 0,
      totalTransactions: Number.parseInt(totalTransactions, 10) || 0,
      uniqueDonors,
      recentDonors,
      communityStats,
    };
  }
}
