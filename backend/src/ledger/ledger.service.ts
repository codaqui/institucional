import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    return this.createAccount(defaultName, type, projectKey);
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
  ): Promise<PaginatedResult<Transaction>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.sourceAccount', 'src')
      .leftJoinAndSelect('tx.destinationAccount', 'dst')
      .where('tx.sourceAccountId = :id OR tx.destinationAccountId = :id', {
        id: accountId,
      })
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
}
