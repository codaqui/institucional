import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RaffleService } from './raffle.service';
import { ClubService } from './club.service';
import { CompaniesService } from '../companies/companies.service';
import { Raffle, RaffleStatus } from './entities/raffle.entity';
import { RaffleEntry, RaffleOwnerType } from './entities/raffle-entry.entity';
import { Wallet } from './entities/wallet.entity';
import { CompanyWallet } from '../companies/entities/company-wallet.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { Member } from '../members/entities/member.entity';

const MEMBER_ID = 'aaaa0000-aaaa-aaaa-aaaa-000000000001';
const RAFFLE_ID = 'cccc0000-cccc-cccc-cccc-000000000001';
const WALLET_ID = 'dddd0000-dddd-dddd-dddd-000000000001';
const COMPANY_ID = 'eeee0000-eeee-eeee-eeee-000000000001';

const futureDateIso = () => new Date(Date.now() + 86_400_000).toISOString();

const makeRaffle = (overrides: Partial<Raffle> = {}): Raffle =>
  ({
    id: RAFFLE_ID,
    title: 'Sorteio Teste',
    description: null,
    costInCoins: 10,
    status: RaffleStatus.OPEN,
    winnerId: null,
    winnerType: null,
    drawAt: null,
    closesAt: new Date(Date.now() + 86_400_000),
    createdByMemberId: MEMBER_ID,
    createdAt: new Date(),
    ...overrides,
  } as Raffle);

const makeEntry = (overrides: Partial<RaffleEntry> = {}): RaffleEntry =>
  ({
    id: 'entry-001',
    raffleId: RAFFLE_ID,
    ownerId: MEMBER_ID,
    ownerType: RaffleOwnerType.MEMBER,
    coinsSpent: 10,
    enteredAt: new Date(),
    raffle: null as any,
    ...overrides,
  } as RaffleEntry);

describe('RaffleService', () => {
  let service: RaffleService;
  let raffleRepo: Record<string, jest.Mock>;
  let entryRepo: Record<string, jest.Mock>;
  let walletRepo: Record<string, jest.Mock>;
  let companyWalletRepo: Record<string, jest.Mock>;
  let companyRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let clubService: Partial<ClubService>;
  let companiesService: Partial<CompaniesService>;

  beforeEach(async () => {
    raffleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? RAFFLE_ID })),
    };

    entryRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
    };

    walletRepo = {
      findOne: jest.fn(),
    };

    companyWalletRepo = {
      findOne: jest.fn(),
    };

    companyRepo = {
      findOne: jest.fn(),
    };

    memberRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    clubService = {
      getOrCreateWallet: jest.fn().mockResolvedValue({ id: WALLET_ID }),
      debitForRaffle: jest.fn().mockResolvedValue({}),
      refundFromRaffle: jest.fn().mockResolvedValue({}),
    };

    companiesService = {
      getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'company-wallet-id' }),
      debitForRaffle: jest.fn().mockResolvedValue({}),
      refundFromRaffle: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaffleService,
        { provide: getRepositoryToken(Raffle), useValue: raffleRepo },
        { provide: getRepositoryToken(RaffleEntry), useValue: entryRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(CompanyWallet), useValue: companyWalletRepo },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        { provide: ClubService, useValue: clubService },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get<RaffleService>(RaffleService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates raffle with future closesAt', async () => {
      const closesAt = futureDateIso();
      await service.create({ title: 'Sorteio', costInCoins: 10, closesAt }, MEMBER_ID);

      expect(raffleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sorteio',
          costInCoins: 10,
          createdByMemberId: MEMBER_ID,
          status: RaffleStatus.OPEN,
        }),
      );
    });

    it('throws when closesAt is in the past', async () => {
      await expect(
        service.create(
          { title: 'X', costInCoins: 5, closesAt: new Date(Date.now() - 1000).toISOString() },
          MEMBER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when raffle not found', async () => {
      raffleRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMyEntries', () => {
    it('aggregates member and company entries by raffle', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      companyRepo.find = jest
        .fn()
        .mockResolvedValue([{ id: COMPANY_ID }]);
      entryRepo.find.mockResolvedValue([
        makeEntry({ raffleId: 'r1', ownerId: MEMBER_ID, coinsSpent: 10 }),
        makeEntry({ id: 'e2', raffleId: 'r1', ownerId: COMPANY_ID, ownerType: RaffleOwnerType.COMPANY, coinsSpent: 15 }),
        makeEntry({ id: 'e3', raffleId: 'r2', ownerId: MEMBER_ID, coinsSpent: 20 }),
      ]);

      const result = await service.listMyEntries(MEMBER_ID);
      expect(result).toEqual(
        expect.arrayContaining([
          { raffleId: 'r1', coinsSpent: 25 },
          { raffleId: 'r2', coinsSpent: 20 },
        ]),
      );
    });
  });

  describe('listOpen/listAll/listHistory', () => {
    it('lists open raffles ordered by closesAt', async () => {
      raffleRepo.find.mockResolvedValue([makeRaffle()]);

      const result = await service.listOpen();

      expect(result).toHaveLength(1);
      expect(raffleRepo.find).toHaveBeenCalledWith({
        where: { status: RaffleStatus.OPEN },
        order: { closesAt: 'ASC' },
      });
    });

    it('builds listAll view including winner display for member winner', async () => {
      raffleRepo.find.mockResolvedValue([
        makeRaffle({
          status: RaffleStatus.DRAWN,
          winnerId: MEMBER_ID,
          winnerType: RaffleOwnerType.MEMBER,
        }),
      ]);
      entryRepo.find.mockResolvedValue([
        makeEntry({ ownerId: MEMBER_ID, ownerType: RaffleOwnerType.MEMBER, coinsSpent: 20 }),
      ]);
      memberRepo.findOne.mockResolvedValue({ githubHandle: 'octocat', name: 'Octo' });

      const result = await service.listAll();

      expect(result).toEqual([
        expect.objectContaining({
          id: RAFFLE_ID,
          winnerDisplay: '@octocat (Octo)',
          participantCount: 1,
          totalCoinsGenerated: 20,
        }),
      ]);
      expect(raffleRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('builds history view including winner display for company winner', async () => {
      raffleRepo.find.mockResolvedValue([
        makeRaffle({
          status: RaffleStatus.DRAWN,
          winnerId: COMPANY_ID,
          winnerType: RaffleOwnerType.COMPANY,
        }),
      ]);
      entryRepo.find.mockResolvedValue([
        makeEntry({ ownerId: COMPANY_ID, ownerType: RaffleOwnerType.COMPANY, coinsSpent: 30 }),
      ]);
      companyRepo.findOne.mockResolvedValue({ id: COMPANY_ID, name: 'Acme Inc' });

      const result = await service.listHistory();

      expect(result).toEqual([
        expect.objectContaining({
          id: RAFFLE_ID,
          winnerDisplay: 'Acme Inc',
          participantCount: 1,
          totalCoinsGenerated: 30,
        }),
      ]);
      expect(raffleRepo.find).toHaveBeenCalledWith({
        where: [
          { status: RaffleStatus.DRAWN },
          { status: RaffleStatus.CANCELED },
          { status: RaffleStatus.CLOSED },
        ],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getRaffleStats', () => {
    it('returns participant count and coin sum', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      entryRepo.find.mockResolvedValue([
        makeEntry({ coinsSpent: 10 }),
        makeEntry({ id: 'e2', coinsSpent: 25 }),
      ]);

      const stats = await service.getRaffleStats(RAFFLE_ID);
      expect(stats).toEqual({ participantCount: 2, totalCoins: 35 });
    });
  });

  // ─── enterRaffle ─────────────────────────────────────────────────────────

  describe('enterRaffle', () => {
    it('enters as MEMBER correctly', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.findOne.mockResolvedValue(null);

      const result = await service.enterRaffle(RAFFLE_ID, MEMBER_ID, RaffleOwnerType.MEMBER);

      expect(clubService.getOrCreateWallet).toHaveBeenCalledWith(MEMBER_ID);
      expect(clubService.debitForRaffle).toHaveBeenCalledWith(
        WALLET_ID,
        10,
        `raffle:${RAFFLE_ID}`,
      );
      expect(entryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: MEMBER_ID,
          ownerType: RaffleOwnerType.MEMBER,
          coinsSpent: 10,
        }),
      );
    });

    it('enters as COMPANY correctly', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.findOne.mockResolvedValue(null);
      companyRepo.findOne.mockResolvedValue({
        id: COMPANY_ID,
        status: CompanyStatus.ACTIVE,
        responsibleMemberId: MEMBER_ID,
      });

      await service.enterRaffle(RAFFLE_ID, MEMBER_ID, RaffleOwnerType.COMPANY);

      expect(companiesService.getOrCreateWallet).toHaveBeenCalledWith(COMPANY_ID);
      expect(companiesService.debitForRaffle).toHaveBeenCalled();
      expect(entryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: COMPANY_ID,
          ownerType: RaffleOwnerType.COMPANY,
        }),
      );
    });

    it('allows reinforcing participation if already entered', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      const existing = makeEntry({ coinsSpent: 10 });
      entryRepo.findOne.mockResolvedValue(existing);
      entryRepo.save.mockImplementation((entry) => Promise.resolve(entry));

      const updated = await service.enterRaffle(
        RAFFLE_ID,
        MEMBER_ID,
        RaffleOwnerType.MEMBER,
      );

      expect(clubService.debitForRaffle).toHaveBeenCalledWith(
        WALLET_ID,
        10,
        `raffle:${RAFFLE_ID}:entry:entry-001:total:20`,
      );
      expect(updated.coinsSpent).toBe(20);
    });

    it('throws BadRequestException if raffle not open', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle({ status: RaffleStatus.DRAWN }));

      await expect(
        service.enterRaffle(RAFFLE_ID, MEMBER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if raffle expired', async () => {
      raffleRepo.findOne.mockResolvedValue(
        makeRaffle({ closesAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.enterRaffle(RAFFLE_ID, MEMBER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when company not found for COMPANY type', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      entryRepo.findOne.mockResolvedValue(null);
      companyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.enterRaffle(RAFFLE_ID, MEMBER_ID, RaffleOwnerType.COMPANY),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when company is not active', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      entryRepo.findOne.mockResolvedValue(null);
      companyRepo.findOne.mockResolvedValue({
        id: COMPANY_ID,
        status: CompanyStatus.SUSPENDED,
      });

      await expect(
        service.enterRaffle(RAFFLE_ID, MEMBER_ID, RaffleOwnerType.COMPANY),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── draw ─────────────────────────────────────────────────────────────────

  describe('draw', () => {
    it('draws a winner among entries', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.find.mockResolvedValue([makeEntry(), makeEntry({ id: 'entry-002', ownerId: 'other-member' })]);
      raffleRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.draw(RAFFLE_ID);

      expect(result.status).toBe(RaffleStatus.DRAWN);
      expect(result.winnerId).toBeTruthy();
      expect(result.drawAt).toBeInstanceOf(Date);
    });

    it('throws BadRequestException if no entries', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      entryRepo.find.mockResolvedValue([]);

      await expect(service.draw(RAFFLE_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws if raffle already drawn', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle({ status: RaffleStatus.DRAWN }));

      await expect(service.draw(RAFFLE_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when total coins invested is zero', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle());
      entryRepo.find.mockResolvedValue([makeEntry({ coinsSpent: 0 })]);

      await expect(service.draw(RAFFLE_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels raffle and refunds member entries', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.find.mockResolvedValue([makeEntry()]);
      walletRepo.findOne.mockResolvedValue({ id: WALLET_ID, memberId: MEMBER_ID });
      raffleRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.cancel(RAFFLE_ID);

      expect(result.status).toBe(RaffleStatus.CANCELED);
      expect(clubService.refundFromRaffle).toHaveBeenCalledWith(
        WALLET_ID,
        10,
        RAFFLE_ID,
      );
    });

    it('cancels raffle and refunds company entries', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.find.mockResolvedValue([
        makeEntry({ ownerId: COMPANY_ID, ownerType: RaffleOwnerType.COMPANY }),
      ]);
      companyWalletRepo.findOne.mockResolvedValue({ id: 'cwallet-id', companyId: COMPANY_ID });
      raffleRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.cancel(RAFFLE_ID);

      expect(companiesService.refundFromRaffle).toHaveBeenCalledWith(
        'cwallet-id',
        10,
        RAFFLE_ID,
      );
    });

    it('throws if raffle is already drawn', async () => {
      raffleRepo.findOne.mockResolvedValue(makeRaffle({ status: RaffleStatus.DRAWN }));

      await expect(service.cancel(RAFFLE_ID)).rejects.toThrow(BadRequestException);
    });

    it('continues cancellation even if a refund fails', async () => {
      const raffle = makeRaffle();
      raffleRepo.findOne.mockResolvedValue(raffle);
      entryRepo.find.mockResolvedValue([makeEntry()]);
      walletRepo.findOne.mockResolvedValue({ id: WALLET_ID, memberId: MEMBER_ID });
      (clubService.refundFromRaffle as jest.Mock).mockRejectedValueOnce(new Error('refund-failed'));
      raffleRepo.save.mockImplementation((e) => Promise.resolve(e));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.cancel(RAFFLE_ID);
      expect(result.status).toBe(RaffleStatus.CANCELED);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('listEntries', () => {
    it('returns empty array when raffle has no entries', async () => {
      entryRepo.find.mockResolvedValue([]);

      const result = await service.listEntries(RAFFLE_ID);
      expect(result).toEqual([]);
    });

    it('resolves ownerDisplay for member and company entries', async () => {
      entryRepo.find.mockResolvedValue([
        makeEntry({ ownerType: RaffleOwnerType.MEMBER, ownerId: MEMBER_ID }),
        makeEntry({ id: 'e2', ownerType: RaffleOwnerType.COMPANY, ownerId: COMPANY_ID }),
      ]);
      memberRepo.find.mockResolvedValue([{ id: MEMBER_ID, githubHandle: 'octocat', name: 'Octo' }]);
      companyRepo.find = jest.fn().mockResolvedValue([{ id: COMPANY_ID, name: 'Acme Inc' }]);

      const result = await service.listEntries(RAFFLE_ID);
      expect(result[0].ownerDisplay).toContain('@octocat');
      expect(result[1].ownerDisplay).toBe('Acme Inc');
    });

    it('falls back to generic owner labels when member/company not found', async () => {
      entryRepo.find.mockResolvedValue([
        makeEntry({ ownerType: RaffleOwnerType.MEMBER, ownerId: MEMBER_ID }),
        makeEntry({ id: 'e2', ownerType: RaffleOwnerType.COMPANY, ownerId: COMPANY_ID }),
      ]);
      memberRepo.find.mockResolvedValue([]);
      companyRepo.find = jest.fn().mockResolvedValue([]);

      const result = await service.listEntries(RAFFLE_ID);
      expect(result[0].ownerDisplay).toBe(`Membro ${MEMBER_ID}`);
      expect(result[1].ownerDisplay).toBe(`Empresa ${COMPANY_ID}`);
    });
  });
});
