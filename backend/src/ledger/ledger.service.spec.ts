import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Account, AccountType } from './entities/account.entity';
import { Transaction } from './entities/transaction.entity';
import { DataSource } from 'typeorm';

describe('LedgerService', () => {
  let service: LedgerService;
  let accountRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    accountRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    txRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates account', async () => {
    const result = await service.createAccount('Comunidade', AccountType.VIRTUAL_WALLET, 'devparana');
    expect(accountRepo.create).toHaveBeenCalledWith({
      name: 'Comunidade',
      type: AccountType.VIRTUAL_WALLET,
      projectKey: 'devparana',
    });
    expect(result).toEqual(
      expect.objectContaining({ name: 'Comunidade', projectKey: 'devparana' }),
    );
  });

  describe('getOrCreateCommunityAccount', () => {
    it('returns existing account', async () => {
      accountRepo.findOneBy.mockResolvedValue({ id: 'acc-1', projectKey: 'devparana' });
      const result = await service.getOrCreateCommunityAccount('devparana', 'DevParana');
      expect(result).toEqual({ id: 'acc-1', projectKey: 'devparana' });
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('creates account when not exists', async () => {
      accountRepo.findOneBy.mockResolvedValueOnce(null);
      const result = await service.getOrCreateCommunityAccount('tisocial', 'T.I Social');
      expect(result).toEqual(
        expect.objectContaining({ projectKey: 'tisocial', name: 'T.I Social' }),
      );
    });

    it('handles race condition returning account created by another process', async () => {
      accountRepo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'acc-race', projectKey: 'devparana' });
      accountRepo.save.mockRejectedValueOnce(new Error('duplicate key'));

      const result = await service.getOrCreateCommunityAccount('devparana', 'DevParana');
      expect(result).toEqual({ id: 'acc-race', projectKey: 'devparana' });
    });

    it('rethrows original error when race fallback still cannot find account', async () => {
      const duplicateError = new Error('duplicate key');
      accountRepo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      accountRepo.save.mockRejectedValueOnce(duplicateError);

      await expect(
        service.getOrCreateCommunityAccount('devparana', 'DevParana'),
      ).rejects.toThrow(duplicateError);
    });
  });

  describe('recordTransaction', () => {
    it('throws when amount is not positive', async () => {
      await expect(
        service.recordTransaction('a', 'b', 0, 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when source and destination are equal', async () => {
      await expect(
        service.recordTransaction('same', 'same', 10, 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('records transaction with valid accounts', async () => {
      const manager = {
        findOneBy: jest
          .fn()
          .mockResolvedValueOnce({ id: 'src' })
          .mockResolvedValueOnce({ id: 'dst' }),
        create: jest.fn((_entity, data) => ({ ...data, id: 'tx-1' })),
        save: jest.fn((tx) => Promise.resolve(tx)),
      };
      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.recordTransaction('src', 'dst', 100, 'Doação', 'ref-1');
      expect(result).toEqual(expect.objectContaining({ id: 'tx-1', amount: 100 }));
    });

    it('throws when source or destination account is invalid', async () => {
      const manager = {
        findOneBy: jest
          .fn()
          .mockResolvedValueOnce({ id: 'src' })
          .mockResolvedValueOnce(null),
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      await expect(
        service.recordTransaction('src', 'missing-dst', 100, 'Doação'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAccountBalance', () => {
    it('throws when account does not exist', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getAccountBalance('missing')).rejects.toThrow(BadRequestException);
    });

    it('returns credits minus debits', async () => {
      accountRepo.findOneBy.mockResolvedValue({ id: 'acc-1' });
      const creditsQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '300' }),
      };
      const debitsQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '125' }),
      };
      txRepo.createQueryBuilder
        .mockReturnValueOnce(creditsQb)
        .mockReturnValueOnce(debitsQb);

      const balance = await service.getAccountBalance('acc-1');
      expect(balance).toBe(175);
    });
  });

  it('returns paginated account transactions', async () => {
    const txs = [{ id: 'tx-1' }, { id: 'tx-2' }];
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([txs, 2]),
    };
    txRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getAccountTransactions('acc-1', 1, 10, {
      type: 'transfer',
      days: 30,
      search: 'PIX',
    });
    expect(result).toEqual({
      data: txs,
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it.each([
    ['donation', 'cs_%'],
    ['reimbursement', 'reimbursement:%'],
    ['vendor-payment', 'vendor-payment:%'],
    ['transfer', 'transfer:%'],
  ] as const)(
    'applies transaction type filter "%s"',
    async (type, expectedFragment) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getAccountTransactions('acc-1', 1, 10, { type });
      const andWhereCalls = qb.andWhere.mock.calls.map(([sql]) => String(sql));
      expect(andWhereCalls.some((sql) => sql.includes(expectedFragment))).toBe(true);
    },
  );

  it('returns accounts list', async () => {
    accountRepo.find.mockResolvedValue([{ id: 'acc-1' }]);
    const result = await service.getAccounts();
    expect(result).toEqual([{ id: 'acc-1' }]);
  });

  it('returns community balances using wallet accounts', async () => {
    const acc1 = { id: 'acc-1', projectKey: 'devparana', name: 'DevParana' };
    const acc2 = { id: 'acc-2', projectKey: 'tisocial', name: 'TISocial' };
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([acc1, acc2]),
    };
    accountRepo.createQueryBuilder.mockReturnValue(qb);
    jest
      .spyOn(service, 'getAccountBalance')
      .mockResolvedValueOnce(1000)
      .mockResolvedValueOnce(250);

    const result = await service.getCommunityBalances();
    expect(result).toEqual([
      { id: 'acc-1', projectKey: 'devparana', name: 'DevParana', balance: 1000 },
      { id: 'acc-2', projectKey: 'tisocial', name: 'TISocial', balance: 250 },
    ]);
  });

  describe('getTransparencyStats', () => {
    it('returns zeroed stats when there are no wallet accounts', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      const stats = await service.getTransparencyStats();
      expect(stats).toEqual({
        totalReceived: 0,
        totalExpenses: 0,
        totalTransactions: 0,
        uniqueDonors: 0,
        recentDonors: [],
        communityStats: [],
      });
    });

    it('returns aggregated transparency stats for wallet accounts', async () => {
      const wallets = [
        { id: 'w1', projectKey: 'devparana', name: 'DevParana' },
        { id: 'w2', projectKey: 'tisocial', name: 'TISocial' },
      ];
      const walletsQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(wallets),
      };
      accountRepo.createQueryBuilder.mockReturnValue(walletsQb);

      const makeQbRawOne = (value: unknown) => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(value),
      });
      const makeQbRawMany = (value: unknown[]) => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(value),
      });

      txRepo.createQueryBuilder
        .mockReturnValueOnce(makeQbRawOne({ sum: '1500' })) // totalReceived
        .mockReturnValueOnce(makeQbRawOne({ sum: '500' })) // totalExpenses
        .mockReturnValueOnce(makeQbRawOne({ count: '12' })) // totalTransactions
        .mockReturnValueOnce(makeQbRawMany([{ handle: '@octocat' }, { handle: '@codaqui' }])) // unique donors
        .mockReturnValueOnce(
          makeQbRawMany([
            {
              handle: '@octocat',
              communityName: 'DevParana',
              date: '2026-01-10T00:00:00.000Z',
              amount: 200,
            },
          ]),
        ) // recent donors
        .mockReturnValueOnce(
          makeQbRawMany([
            { accountId: 'w1', totalIn: '900', inboundCount: '4' },
            { accountId: 'w2', totalIn: '600', inboundCount: '3' },
          ]),
        ) // inbound
        .mockReturnValueOnce(
          makeQbRawMany([
            { accountId: 'w1', totalOut: '300', outboundCount: '2' },
            { accountId: 'w2', totalOut: '200', outboundCount: '1' },
          ]),
        ) // outbound
        .mockReturnValueOnce(
          makeQbRawMany([{ accountId: 'w1', selfCount: '1' }]),
        ); // self transfer

      const stats = await service.getTransparencyStats();
      expect(stats.totalReceived).toBe(1500);
      expect(stats.totalExpenses).toBe(500);
      expect(stats.totalTransactions).toBe(12);
      expect(stats.uniqueDonors).toBe(2);
      expect(stats.recentDonors).toHaveLength(1);
      expect(stats.communityStats).toEqual([
        {
          projectKey: 'devparana',
          name: 'DevParana',
          totalIn: 900,
          totalOut: 300,
          txCount: 5, // 4 + 2 - 1 self-transfer
        },
        {
          projectKey: 'tisocial',
          name: 'TISocial',
          totalIn: 600,
          totalOut: 200,
          txCount: 4, // 3 + 1 - 0
        },
      ]);
    });
  });

  it('gets transaction by id with relations', async () => {
    txRepo.findOne.mockResolvedValue({ id: 'tx-1' });
    const result = await service.getTransactionById('tx-1');
    expect(txRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      relations: ['sourceAccount', 'destinationAccount'],
    });
    expect(result).toEqual({ id: 'tx-1' });
  });
});
