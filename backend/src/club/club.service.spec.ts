import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClubService } from './club.service';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, WalletTxSource } from './entities/wallet-transaction.entity';
import { Member } from '../members/entities/member.entity';

const MEMBER_ID = 'aaaa0000-aaaa-aaaa-aaaa-000000000001';
const WALLET_ID = 'bbbb0000-bbbb-bbbb-bbbb-000000000001';

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet =>
  {
    id: WALLET_ID,
    memberId: MEMBER_ID,
    balances: { sort_coin: 100 },
    frozenTypes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

const makeTx = (overrides: Partial<WalletTransaction> = {}): WalletTransaction =>
  {
    id: 'tx-0001',
    walletId: WALLET_ID,
    coinType: 'sort_coin',
    amount: 50,
    source: WalletTxSource.STRIPE_INVOICE,
    referenceId: 'stripe-pi:pi_test',
    description: null,
    createdAt: new Date(),
    wallet: null as any,
    ...overrides,
  };

/** Helper: cria mock de EntityManager com SELECT FOR UPDATE stub */
const makeMockEm = (walletData: Partial<Wallet> = {}) => {
  const wallet = makeWallet(walletData);
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(wallet),
  };
  const walletRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    save: jest.fn((e) => Promise.resolve(e)),
  };
  const txRepo = {
    create: jest.fn((data) => ({ ...data, id: 'tx-generated' })),
    save: jest.fn((e) => Promise.resolve(e)),
    findOne: jest.fn().mockResolvedValue(null),
  };
  return { wallet, qb, walletRepo, txRepo };
};

describe('ClubService', () => {
  let service: ClubService;
  let walletRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    walletRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? WALLET_ID })),
    };

    txRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
    };

    memberRepo = {
      createQueryBuilder: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubService,
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(WalletTransaction), useValue: txRepo },
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ClubService>(ClubService);
  });

  // ─── getOrCreateWallet ────────────────────────────────────────────────────

  describe('getOrCreateWallet', () => {
    it('returns existing wallet', async () => {
      const wallet = makeWallet();
      walletRepo.findOne.mockResolvedValue(wallet);

      const result = await service.getOrCreateWallet(MEMBER_ID);
      expect(result).toBe(wallet);
      expect(walletRepo.create).not.toHaveBeenCalled();
    });

    it('creates wallet when not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await service.getOrCreateWallet(MEMBER_ID);

      expect(walletRepo.create).toHaveBeenCalledWith({
        memberId: MEMBER_ID,
        balances: {},
        frozenTypes: [],
      });
      expect(walletRepo.save).toHaveBeenCalled();
    });
  });

  // ─── getWallet ────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns wallet when found', async () => {
      const wallet = makeWallet();
      walletRepo.findOne.mockResolvedValue(wallet);
      await expect(service.getWallet(MEMBER_ID)).resolves.toBe(wallet);
    });

    it('throws NotFoundException when not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(service.getWallet(MEMBER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicWalletByHandle', () => {
    it('returns wallet and latest transactions for public handle', async () => {
      const memberQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: MEMBER_ID,
          githubHandle: 'octocat',
          name: 'Octo',
        }),
      };
      memberRepo.createQueryBuilder.mockReturnValue(memberQb);
      walletRepo.findOne.mockResolvedValue(makeWallet());
      txRepo.find.mockResolvedValue([makeTx()]);

      const result = await service.getPublicWalletByHandle('octocat', 5);

      expect(result.member.githubHandle).toBe('octocat');
      expect(result.wallet?.id).toBe(WALLET_ID);
      expect(result.transactions).toHaveLength(1);
      expect(txRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('throws on invalid handle', async () => {
      await expect(
        service.getPublicWalletByHandle('../x'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getTransactions ──────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transactions', async () => {
      const wallet = makeWallet();
      const txs = [makeTx()];
      walletRepo.findOne.mockResolvedValue(wallet);
      txRepo.find.mockResolvedValue(txs);

      const result = await service.getTransactions(MEMBER_ID, 1, 10);
      expect(result).toEqual(txs);
      expect(txRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  // ─── creditFromInvoice ────────────────────────────────────────────────────

  describe('creditFromInvoice', () => {
    it('credits 1 coin per real', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await service.creditFromInvoice(MEMBER_ID, 5, 'stripe-pi:pi_abc');

      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5,
          source: WalletTxSource.STRIPE_INVOICE,
          referenceId: 'stripe-pi:pi_abc',
        }),
      );
    });

    it('floors fractional coins', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      // R$1.99 = 1.99 → floor → 1 coin
      await service.creditFromInvoice(MEMBER_ID, 1.99, 'stripe-pi:pi_floor');
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1 }),
      );
    });
  });

  // ─── debitForRaffle ───────────────────────────────────────────────────────

  describe('debitForRaffle', () => {
    it('deducts coins and creates transaction', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        balances: { sort_coin: 100 },
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await service.debitForRaffle(WALLET_ID, 30, 'raffle-uuid');

      expect(emWalletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balances: { sort_coin: 70 } }),
      );
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -30,
          source: WalletTxSource.RAFFLE_ENTRY,
        }),
      );
    });

    it('throws BadRequestException when balance insufficient', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        balances: { sort_coin: 5 },
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await expect(
        service.debitForRaffle(WALLET_ID, 30, 'raffle-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when coin is frozen', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        balances: { sort_coin: 100 },
        frozenTypes: ['sort_coin'],
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await expect(
        service.debitForRaffle(WALLET_ID, 10, 'raffle-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      const emWalletRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
        save: jest.fn(),
      };
      const emTxRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await expect(
        service.debitForRaffle(WALLET_ID, 10, 'raffle-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

  });

  // ─── refundFromRaffle ─────────────────────────────────────────────────────

  describe('refundFromRaffle', () => {
    it('adds coins back to balance', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        balances: { sort_coin: 70 },
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await service.refundFromRaffle(WALLET_ID, 30, 'raffle-uuid');

      expect(emWalletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balances: { sort_coin: 100 } }),
      );
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 30,
          source: WalletTxSource.RAFFLE_REFUND,
        }),
      );
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      const emWalletRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
        save: jest.fn(),
      };
      const emTxRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await expect(
        service.refundFromRaffle(WALLET_ID, 10, 'raffle-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── manualAdjust ─────────────────────────────────────────────────────────

  describe('manualAdjust', () => {
    it('throws on zero amount', async () => {
      await expect(service.manualAdjust(MEMBER_ID, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates wallet and applies balance', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({ memberId: MEMBER_ID, balances: {}, frozenTypes: [] });
      walletRepo.save.mockResolvedValue(makeWallet({ balances: {} }));

      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ balances: {} });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await service.manualAdjust(MEMBER_ID, 50, 'sort_coin', 'Prêmio evento');

      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          source: WalletTxSource.MANUAL_ADMIN,
          referenceId: null,
          description: 'Prêmio evento',
        }),
      );
    });

    it('returns existing tx on duplicate key with null referenceId', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        balances: { sort_coin: 0 },
      });
      emTxRepo.save.mockRejectedValueOnce({ code: '23505' });
      emTxRepo.findOne.mockResolvedValueOnce({ id: 'existing-manual-tx' });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      const result = await service.manualAdjust(MEMBER_ID, 10, 'sort_coin', 'Ajuste duplicado');
      expect(result).toEqual({ id: 'existing-manual-tx' });
    });
  });

  describe('creditDistribution', () => {
    it('credits distribution with COMPANY_DISTRIBUTION source', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await service.creditDistribution(
        MEMBER_ID,
        25,
        'company-dist:1',
        'Distribuição da empresa',
      );

      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 25,
          source: WalletTxSource.COMPANY_DISTRIBUTION,
          referenceId: 'company-dist:1',
          description: 'Distribuição da empresa',
        }),
      );
    });

    it('returns existing tx on duplicate key (idempotent path)', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm();
      emTxRepo.save.mockRejectedValueOnce({ code: '23505' });
      emTxRepo.findOne.mockResolvedValueOnce({ id: 'existing-tx' });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      const result = await service.creditDistribution(
        MEMBER_ID,
        10,
        'company-dist:dup',
        'Distribuição duplicada',
      );
      expect(result).toEqual({ id: 'existing-tx' });
    });

    it('throws ConflictException when duplicate key has no existing tx', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm();
      emTxRepo.save.mockRejectedValueOnce({ code: '23505' });
      emTxRepo.findOne.mockResolvedValueOnce(null);
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({ getRepository: (e: any) => (e === Wallet ? emWalletRepo : emTxRepo) }),
      );

      await expect(
        service.creditDistribution(
          MEMBER_ID,
          10,
          'company-dist:dup2',
          'Distribuição duplicada',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── freezeCoin / unfreezeCoin ────────────────────────────────────────────

  describe('freezeCoin', () => {
    it('adds coinType to frozenTypes', async () => {
      const wallet = makeWallet({ frozenTypes: [] });
      walletRepo.findOne.mockResolvedValue(wallet);

      await service.freezeCoin(MEMBER_ID);

      expect(walletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ frozenTypes: ['sort_coin'] }),
      );
    });

    it('does not duplicate if already frozen', async () => {
      const wallet = makeWallet({ frozenTypes: ['sort_coin'] });
      walletRepo.findOne.mockResolvedValue(wallet);

      await service.freezeCoin(MEMBER_ID);

      expect(walletRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('unfreezeCoin', () => {
    it('removes coinType from frozenTypes', async () => {
      const wallet = makeWallet({ frozenTypes: ['sort_coin'] });
      walletRepo.findOne.mockResolvedValue(wallet);

      await service.unfreezeCoin(MEMBER_ID);

      expect(walletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ frozenTypes: [] }),
      );
    });
  });

  describe('getAdminAllTransactions', () => {
    it('returns union of member and company transactions for type=all', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([{ id: 'tx1' }, { id: 'tx2' }]);

      const result = await service.getAdminAllTransactions('all', 1, 50);
      expect(result).toEqual({ total: 2, data: [{ id: 'tx1' }, { id: 'tx2' }] });
      expect(String(dataSource.query.mock.calls[0][0])).toContain('UNION ALL');
    });

    it('returns only member transactions for type=member', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([{ id: 'member-tx' }]);

      const result = await service.getAdminAllTransactions('member', 2, 10);
      expect(result).toEqual({ total: 1, data: [{ id: 'member-tx' }] });
      expect(String(dataSource.query.mock.calls[0][0])).toContain(
        'FROM club_wallet_transactions',
      );
    });

    it('returns only company transactions for type=company', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([{ id: 'company-tx' }]);

      const result = await service.getAdminAllTransactions('company', 1, 20);
      expect(result).toEqual({ total: 1, data: [{ id: 'company-tx' }] });
      expect(String(dataSource.query.mock.calls[0][0])).toContain(
        'FROM company_wallet_transactions',
      );
    });

    it('uses defaults and returns total 0 when count row is missing', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'tx-default' }]);

      const result = await service.getAdminAllTransactions();

      expect(result).toEqual({ total: 0, data: [{ id: 'tx-default' }] });
      expect(dataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [50, 0],
      );
    });
  });
});
