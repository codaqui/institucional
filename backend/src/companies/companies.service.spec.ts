import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService, validateCnpj } from './companies.service';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import { CompanyMember } from './entities/company-member.entity';
import {
  CompanyWalletTransaction,
  CompanyWalletTxSource,
} from './entities/company-wallet-transaction.entity';
import { Member } from '../members/entities/member.entity';
import { ClubService } from '../club/club.service';

const MEMBER_ID = 'aaaa0000-aaaa-aaaa-aaaa-000000000001';
const COMPANY_ID = 'bbbb0000-bbbb-bbbb-bbbb-000000000001';
const WALLET_ID = 'cccc0000-cccc-cccc-cccc-000000000001';

// CNPJ válido para testes (gerado com algoritmo): 11.222.333/0001-81
const VALID_CNPJ = '11222333000181';

const makeCompany = (overrides: Partial<Company> = {}): Company =>
  ({
    id: COMPANY_ID,
    cnpj: VALID_CNPJ,
    name: 'Empresa Teste Ltda',
    logoUrl: null,
    websiteUrl: null,
    status: CompanyStatus.PENDING,
    responsibleMemberId: MEMBER_ID,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionAmountCents: 20000,
    showOnSponsorsPage: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeWallet = (): CompanyWallet =>
  ({
    id: WALLET_ID,
    companyId: COMPANY_ID,
    balances: { sort_coin: 50 },
    frozenTypes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    company: null as any,
  });

const makeMockEm = (balances?: Record<string, number>) => {
  const wallet = makeWallet();
  wallet.balances = balances ?? { sort_coin: 50 };
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
    create: jest.fn((d) => ({ ...d })),
    save: jest.fn((e) => Promise.resolve(e)),
    findOne: jest.fn().mockResolvedValue(null),
  };
  return { wallet, walletRepo, txRepo };
};

// ─── validateCnpj standalone ────────────────────────────────────────────────

describe('validateCnpj', () => {
  it('accepts valid CNPJ', () => {
    expect(() => validateCnpj(VALID_CNPJ)).not.toThrow();
  });

  it('rejects non-digit string', () => {
    expect(() => validateCnpj('11.222.333/0001-81')).toThrow(BadRequestException);
  });

  it('rejects all-same digits', () => {
    expect(() => validateCnpj('11111111111111')).toThrow(BadRequestException);
  });

  it('rejects wrong check digits', () => {
    expect(() => validateCnpj('11222333000199')).toThrow(BadRequestException);
  });

  it('rejects too short', () => {
    expect(() => validateCnpj('1122233300018')).toThrow(BadRequestException);
  });
});

// ─── CompaniesService ────────────────────────────────────────────────────────

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyRepo: Record<string, jest.Mock>;
  let walletRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let memberEntityRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let clubService: { creditDistribution: jest.Mock };

  beforeEach(async () => {
    companyRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? COMPANY_ID })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn(),
      findByIds: jest.fn(),
    };

    walletRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? WALLET_ID })),
    };

    txRepo = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
      createQueryBuilder: jest.fn(),
    };

    memberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    memberEntityRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    dataSource = { transaction: jest.fn() };
    clubService = { creditDistribution: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(CompanyWallet), useValue: walletRepo },
        { provide: getRepositoryToken(CompanyWalletTransaction), useValue: txRepo },
        { provide: getRepositoryToken(CompanyMember), useValue: memberRepo },
        { provide: getRepositoryToken(Member), useValue: memberEntityRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ClubService, useValue: clubService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  // ─── register ────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates company with valid CNPJ', async () => {
      companyRepo.findOne.mockResolvedValue(null);

      await service.register({ cnpj: VALID_CNPJ, name: 'Empresa' }, MEMBER_ID);

      expect(companyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cnpj: VALID_CNPJ,
          name: 'Empresa',
          responsibleMemberId: MEMBER_ID,
          status: CompanyStatus.PENDING,
        }),
      );
    });

    it('throws BadRequestException for invalid CNPJ', async () => {
      await expect(
        service.register({ cnpj: '12345678000100', name: 'X' }, MEMBER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if CNPJ already registered', async () => {
      companyRepo.findOne.mockResolvedValueOnce(makeCompany()); // CNPJ exists

      await expect(
        service.register({ cnpj: VALID_CNPJ, name: 'Outra' }, MEMBER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if member already responsible', async () => {
      companyRepo.findOne
        .mockResolvedValueOnce(null) // CNPJ not found
        .mockResolvedValueOnce(makeCompany()); // responsibleMemberId exists

      await expect(
        service.register({ cnpj: VALID_CNPJ, name: 'Outra' }, MEMBER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── findByMember ─────────────────────────────────────────────────────────

  describe('findByMember', () => {
    it('returns company for the member', async () => {
      const company = makeCompany();
      companyRepo.findOne.mockResolvedValue(company);

      const result = await service.findByMember(MEMBER_ID);
      expect(result).toBe(company);
    });

    it('returns null when not found', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      const result = await service.findByMember('other-member');
      expect(result).toBeNull();
    });
  });

  describe('findCollaborations', () => {
    it('returns empty array when member uuid is unknown', async () => {
      memberEntityRepo.findOne.mockResolvedValue(null);
      const result = await service.findCollaborations(MEMBER_ID);
      expect(result).toEqual([]);
    });

    it('returns empty array when member has no memberships', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'octocat' });
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      memberRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findCollaborations(MEMBER_ID);
      expect(result).toEqual([]);
    });

    it('returns companies for collaborator memberships', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'octocat' });
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ companyId: COMPANY_ID }]),
      };
      memberRepo.createQueryBuilder.mockReturnValue(qb);
      companyRepo.find.mockResolvedValue([{ id: COMPANY_ID, name: 'Acme' }]);

      const result = await service.findCollaborations(MEMBER_ID);
      expect(result).toEqual([{ id: COMPANY_ID, name: 'Acme' }]);
      expect(companyRepo.find).toHaveBeenCalled();
    });
  });

  describe('findPublicInfo', () => {
    it('returns public info with responsible handle', async () => {
      companyRepo.findOne.mockResolvedValue(makeCompany());
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'owner' });

      const result = await service.findPublicInfo(COMPANY_ID);
      expect(result).toEqual(
        expect.objectContaining({
          id: COMPANY_ID,
          responsibleGithubHandle: 'owner',
        }),
      );
    });

    it('returns public info with null responsible when member not found', async () => {
      companyRepo.findOne.mockResolvedValue(makeCompany());
      memberEntityRepo.findOne.mockResolvedValue(null);

      const result = await service.findPublicInfo(COMPANY_ID);
      expect(result.responsibleGithubHandle).toBeNull();
    });
  });

  describe('findPublicAffiliationByHandle/getSupportSummary', () => {
    it('returns null when handle has no active member', async () => {
      const memberQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      memberEntityRepo.createQueryBuilder.mockReturnValue(memberQb);
      const result = await service.findPublicAffiliationByHandle('ghost');
      expect(result).toBeNull();
    });

    it('returns support summary fallback when no invoices exist', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getSupportSummary(COMPANY_ID);
      expect(result).toEqual({
        totalSupportedReais: 0,
        supportCount: 0,
        monthsSupporting: 0,
      });
    });
  });

  // ─── findAllAdmin ─────────────────────────────────────────────────────────

  describe('findAllAdmin', () => {
    it('returns companies with wallet and support metrics', async () => {
      const companies = [makeCompany({ status: CompanyStatus.ACTIVE })];
      companyRepo.find.mockResolvedValue(companies);
      memberEntityRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        githubHandle: 'maintainer',
      });
      walletRepo.findOne.mockResolvedValue(
        makeWallet(),
      );

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { companyId: COMPANY_ID, totalSupportedReais: '500', supportCount: '1' },
        ]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllAdmin();

      expect(result).toEqual([
        expect.objectContaining({
          id: COMPANY_ID,
          responsibleGithubHandle: 'maintainer',
          sortCoinBalance: 50,
          totalSupportedReais: 500,
          supportCount: 1,
          monthsSupporting: 2,
        }),
      ]);
    });

    it('returns empty metrics when there is no invoice history', async () => {
      const companies = [makeCompany({ status: CompanyStatus.PENDING })];
      companyRepo.find.mockResolvedValue(companies);
      memberEntityRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue(null);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllAdmin();
      expect(result).toEqual([
        expect.objectContaining({
          id: COMPANY_ID,
          totalSupportedReais: 0,
          supportCount: 0,
          monthsSupporting: 0,
        }),
      ]);
    });
  });

  // ─── listSponsors ─────────────────────────────────────────────────────────

  describe('listSponsors', () => {
    it('returns only active companies with support metrics', async () => {
      const sponsors = [makeCompany({ status: CompanyStatus.ACTIVE, showOnSponsorsPage: true })];
      companyRepo.find.mockResolvedValue(sponsors);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { companyId: COMPANY_ID, totalSupportedReais: '1250', supportCount: '6' },
        ]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listSponsors();
      expect(result).toEqual([
        expect.objectContaining({
          id: COMPANY_ID,
          totalSupportedReais: 1250,
          supportCount: 6,
          monthsSupporting: 6,
        }),
      ]);
      expect(companyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CompanyStatus.ACTIVE },
        }),
      );
    });

    it('returns empty array when there are no active sponsors', async () => {
      companyRepo.find.mockResolvedValue([]);
      const result = await service.listSponsors();
      expect(result).toEqual([]);
      expect(txRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ─── activateFromInvoice ──────────────────────────────────────────────────

  describe('activateFromInvoice', () => {
    it('keeps company status unchanged and credits coins', async () => {
      const company = makeCompany({ status: CompanyStatus.PENDING, stripeSubscriptionId: null });
      companyRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(company);
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({ companyId: COMPANY_ID, balances: {}, frozenTypes: [] });
      walletRepo.save.mockResolvedValue(makeWallet());

      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 0 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await service.activateFromInvoice('sub_123', 'cus_abc', 20, 'stripe-pi:pi_123');

      expect(companyRepo.update).not.toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ status: CompanyStatus.ACTIVE }),
      );
      // 20 reais × 1 = 20 coins
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20 }),
      );
    });

    it('finds company by companyId fallback when webhook order is inverted', async () => {
      const company = makeCompany({ status: CompanyStatus.PENDING });
      companyRepo.findOne.mockResolvedValueOnce(company);
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({ companyId: COMPANY_ID, balances: {}, frozenTypes: [] });
      walletRepo.save.mockResolvedValue(makeWallet());

      const { txRepo: emTxRepo } = makeMockEm({ sort_coin: 0 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? { createQueryBuilder: jest.fn().mockReturnValue({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(makeWallet()),
            }), save: jest.fn((entity) => Promise.resolve(entity)) } : emTxRepo,
        }),
      );

      await service.activateFromInvoice(
        'sub_missing',
        'cus_missing',
        30,
        'stripe-pi:pi_order',
        COMPANY_ID,
      );

      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 30 }),
      );
    });

    it('logs warning when company not found', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.activateFromInvoice('sub_xxx', 'cus_xxx', 10, 'pi_xxx');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ─── suspendFromSubscriptionDeleted ──────────────────────────────────────

  describe('suspendFromSubscriptionDeleted', () => {
    it('suspends company and freezes wallet', async () => {
      const company = makeCompany({ status: CompanyStatus.ACTIVE });
      companyRepo.findOne.mockResolvedValue(company);
      walletRepo.findOne.mockResolvedValue(makeWallet());

      await service.suspendFromSubscriptionDeleted('sub_123');

      expect(companyRepo.update).toHaveBeenCalledWith(
        COMPANY_ID,
        {
          status: CompanyStatus.SUSPENDED,
          stripeSubscriptionId: null,
          subscriptionAmountCents: 0,
        },
      );
    });

    it('does nothing when subscription not found', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      await service.suspendFromSubscriptionDeleted('sub_unknown');
      expect(companyRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getWallet/getTransactions', () => {
    it('returns wallet when it exists', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const result = await service.getWallet(COMPANY_ID);
      expect(result).toEqual(expect.objectContaining({ id: WALLET_ID }));
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(service.getWallet(COMPANY_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns paginated company transactions', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      txRepo.findAndCount.mockResolvedValue([[{ id: 'tx-1' }], 1]);

      const result = await service.getTransactions(COMPANY_ID, 2, 10);

      expect(result).toEqual({
        items: [{ id: 'tx-1' }],
        total: 1,
        page: 2,
        limit: 10,
      });
      expect(txRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: WALLET_ID },
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ─── debitForRaffle ───────────────────────────────────────────────────────

  describe('debitForRaffle', () => {
    it('deducts coins and saves transaction', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 100 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await service.debitForRaffle(WALLET_ID, 30, 'raffle-id');

      expect(emWalletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balances: { sort_coin: 70 } }),
      );
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -30,
          source: CompanyWalletTxSource.RAFFLE_ENTRY,
        }),
      );
    });

    it('throws when balance insufficient', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 5 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await expect(
        service.debitForRaffle(WALLET_ID, 30, 'raffle-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when wallet is frozen for the coin type', async () => {
      const emWalletRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            ...makeWallet(),
            balances: { sort_coin: 50 },
            frozenTypes: ['sort_coin'],
          }),
        }),
        save: jest.fn(),
      };
      const emTxRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await expect(
        service.debitForRaffle(WALLET_ID, 10, 'raffle-id'),
      ).rejects.toThrow(BadRequestException);
    });

  });

  describe('refundFromRaffle', () => {
    it('refunds coins and records transaction', async () => {
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 40 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await service.refundFromRaffle(WALLET_ID, 15, 'raffle-1');

      expect(emWalletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balances: { sort_coin: 55 } }),
      );
      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15,
          source: CompanyWalletTxSource.RAFFLE_REFUND,
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
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await expect(
        service.refundFromRaffle(WALLET_ID, 10, 'raffle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('distributeCoins', () => {
    const requesterId = MEMBER_ID;

    beforeEach(() => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: requesterId }),
      );
    });

    it('throws for invalid githubHandle', async () => {
      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: '   ', amount: 10 }],
          requesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when total amount is not positive', async () => {
      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: 'octocat', amount: 0 }],
          requesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when responsible member is not found', async () => {
      memberEntityRepo.findOne.mockResolvedValue(null);
      memberRepo.find.mockResolvedValue([]);

      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: 'octocat', amount: 10 }],
          requesterId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when recipient has no relation with company', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ githubHandle: 'owner' });
      memberRepo.find.mockResolvedValue([{ memberId: 'collaborator' }]);

      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: 'outsider', amount: 10 }],
          requesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when recipient member is missing/inactive', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ githubHandle: 'owner' });
      memberRepo.find.mockResolvedValue([{ memberId: 'collaborator' }]);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      memberEntityRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: 'collaborator', amount: 10 }],
          requesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when company wallet has insufficient balance', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ githubHandle: 'owner' });
      memberRepo.find.mockResolvedValue([{ memberId: 'collaborator' }]);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'member-collab', githubHandle: 'collaborator', isActive: true },
        ]),
      };
      memberEntityRepo.createQueryBuilder.mockReturnValue(qb);
      walletRepo.findOne.mockResolvedValue({
        id: WALLET_ID,
        companyId: COMPANY_ID,
        balances: { sort_coin: 5 },
        frozenTypes: [],
      });
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        sort_coin: 5,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) => (e === CompanyWallet ? emWalletRepo : emTxRepo),
        }),
      );

      await expect(
        service.distributeCoins(
          COMPANY_ID,
          [{ githubHandle: 'collaborator', amount: 10 }],
          requesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('distributes coins successfully with merged handles', async () => {
      memberEntityRepo.findOne.mockResolvedValue({ githubHandle: 'owner' });
      memberRepo.find.mockResolvedValue([{ memberId: 'collaborator' }]);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'member-collab', githubHandle: 'collaborator', isActive: true },
          { id: 'member-owner', githubHandle: 'owner', isActive: true },
        ]),
      };
      memberEntityRepo.createQueryBuilder.mockReturnValue(qb);
      walletRepo.findOne.mockResolvedValue({
        id: WALLET_ID,
        companyId: COMPANY_ID,
        balances: { sort_coin: 100 },
        frozenTypes: [],
      });
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({
        sort_coin: 100,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) => (e === CompanyWallet ? emWalletRepo : emTxRepo),
        }),
      );

      const result = await service.distributeCoins(
        COMPANY_ID,
        [
          { githubHandle: 'collaborator', amount: 10 },
          { githubHandle: 'COLLABORATOR', amount: 15 },
          { githubHandle: 'owner', amount: 5 },
        ],
        requesterId,
      );

      expect(result).toEqual({ distributed: 30, recipients: 2 });
      expect(clubService.creditDistribution).toHaveBeenCalledTimes(2);
    });
  });

  describe('addCollaborator/removeCollaborator/isMemberOfCompany', () => {
    it('throws when responsible tries to add itself as collaborator', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: MEMBER_ID }),
      );
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'owner' });

      await expect(
        service.addCollaborator(COMPANY_ID, 'owner', MEMBER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when collaborator already exists', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: MEMBER_ID }),
      );
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'owner' });
      memberRepo.findOne.mockResolvedValue({ id: 'collab-1' });

      await expect(
        service.addCollaborator(COMPANY_ID, 'collab', MEMBER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('adds collaborator successfully', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: MEMBER_ID }),
      );
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'owner' });
      memberRepo.findOne.mockResolvedValue(null);
      memberRepo.create.mockReturnValue({ id: 'c1', companyId: COMPANY_ID, memberId: 'collab' });
      memberRepo.save.mockResolvedValue({ id: 'c1', companyId: COMPANY_ID, memberId: 'collab' });

      const result = await service.addCollaborator(COMPANY_ID, 'collab', MEMBER_ID);
      expect(result).toEqual(expect.objectContaining({ memberId: 'collab' }));
    });

    it('removes collaborator after ownership check', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: MEMBER_ID }),
      );
      await service.removeCollaborator(COMPANY_ID, 'collab-1', MEMBER_ID);
      expect(memberRepo.delete).toHaveBeenCalledWith({
        id: 'collab-1',
        companyId: COMPANY_ID,
      });
    });

    it('returns collaborators for company', async () => {
      memberRepo.find.mockResolvedValue([{ id: 'c1', companyId: COMPANY_ID }]);
      const result = await service.getCollaborators(COMPANY_ID);
      expect(result).toEqual([{ id: 'c1', companyId: COMPANY_ID }]);
    });

    it('throws in findOwned path when requester is not responsible', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: 'other-member' }),
      );
      await expect(
        service.removeCollaborator(COMPANY_ID, 'collab-1', MEMBER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns true in isMemberOfCompany when requester is owner', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: MEMBER_ID }),
      );
      const result = await service.isMemberOfCompany(COMPANY_ID, MEMBER_ID);
      expect(result).toBe(true);
    });

    it('returns false in isMemberOfCompany when member uuid is unknown', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: 'owner-uuid' }),
      );
      memberEntityRepo.findOne.mockResolvedValue(null);

      const result = await service.isMemberOfCompany(COMPANY_ID, MEMBER_ID);
      expect(result).toBe(false);
    });

    it('returns true in isMemberOfCompany when githubHandle is collaborator', async () => {
      companyRepo.findOne.mockResolvedValue(
        makeCompany({ id: COMPANY_ID, responsibleMemberId: 'owner-uuid' }),
      );
      memberEntityRepo.findOne.mockResolvedValue({ id: MEMBER_ID, githubHandle: 'octocat' });
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'collab-link' }),
      };
      memberRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.isMemberOfCompany(COMPANY_ID, MEMBER_ID);
      expect(result).toBe(true);
    });
  });

  // ─── manualAdjust ─────────────────────────────────────────────────────────

  describe('manualAdjust', () => {
    it('throws on zero amount', async () => {
      await expect(service.manualAdjust(COMPANY_ID, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates wallet and credits', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({ companyId: COMPANY_ID, balances: {}, frozenTypes: [] });
      walletRepo.save.mockResolvedValue(makeWallet());

      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 0 });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await service.manualAdjust(COMPANY_ID, 100, 'sort_coin', 'Bônus evento');

      expect(emTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          source: CompanyWalletTxSource.MANUAL_ADMIN,
          description: 'Bônus evento',
        }),
      );
    });

    it('returns existing tx on duplicate key (idempotent path)', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 0 });
      emTxRepo.save.mockRejectedValueOnce({ code: '23505' });
      emTxRepo.findOne.mockResolvedValueOnce({ id: 'existing-company-tx' });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      const result = await service.manualAdjust(COMPANY_ID, 10, 'sort_coin', 'dup');
      expect(result).toEqual({ id: 'existing-company-tx' });
    });

    it('throws ConflictException when duplicate has no existing tx', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      const { walletRepo: emWalletRepo, txRepo: emTxRepo } = makeMockEm({ sort_coin: 0 });
      emTxRepo.save.mockRejectedValueOnce({ code: '23505' });
      emTxRepo.findOne.mockResolvedValueOnce(null);
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb({
          getRepository: (e: any) =>
            e === CompanyWallet ? emWalletRepo : emTxRepo,
        }),
      );

      await expect(
        service.manualAdjust(COMPANY_ID, 10, 'sort_coin', 'dup'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
