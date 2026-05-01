import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MembersService } from './members.service';
import { Member, MemberRole } from './entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';

const mockMember = (): Member => ({
  id: '11111111-1111-1111-1111-111111111111',
  githubId: '12345',
  githubHandle: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/testuser',
  bio: null,
  linkedinUrl: null,
  role: MemberRole.MEMBRO,
  isActive: true,
  joinedAt: new Date('2024-01-01'),
});

describe('MembersService', () => {
  let service: MembersService;
  let memberRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    memberRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({
          ...entity,
          id: entity.id ?? '22222222-2222-2222-2222-222222222222',
        }),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    txRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  // ─── upsertByGithub ──────────────────────────────────────────────────────

  describe('upsertByGithub', () => {
    const profile = {
      githubId: '12345',
      githubHandle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/testuser',
    };

    it('should create a new member when not found', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await service.upsertByGithub(profile);

      expect(memberRepo.create).toHaveBeenCalledWith({
        ...profile,
        role: MemberRole.MEMBRO,
        isActive: true,
      });
      expect(memberRepo.save).toHaveBeenCalled();
    });

    it('should update an existing member', async () => {
      const existing = mockMember();
      memberRepo.findOne.mockResolvedValue(existing);

      await service.upsertByGithub({
        ...profile,
        name: 'Updated Name',
      });

      expect(existing.name).toBe('Updated Name');
      expect(memberRepo.save).toHaveBeenCalledWith(existing);
      expect(memberRepo.create).not.toHaveBeenCalled();
    });

    it('should force admin role for bootstrap admin (endersonmenezes)', async () => {
      const bootstrapProfile = { ...profile, githubHandle: 'endersonmenezes' };
      memberRepo.findOne.mockResolvedValue(null);

      await service.upsertByGithub(bootstrapProfile);

      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: MemberRole.ADMIN }),
      );
    });

    it('should restore admin role for bootstrap admin on login', async () => {
      const existing = {
        ...mockMember(),
        githubHandle: 'endersonmenezes',
        role: MemberRole.MEMBRO,
      };
      memberRepo.findOne.mockResolvedValue(existing);

      await service.upsertByGithub({
        ...profile,
        githubHandle: 'endersonmenezes',
      });

      expect(existing.role).toBe(MemberRole.ADMIN);
    });

    it('should not change role for non-bootstrap admin', async () => {
      const existing = mockMember();
      memberRepo.findOne.mockResolvedValue(existing);

      await service.upsertByGithub(profile);

      expect(existing.role).toBe(MemberRole.MEMBRO);
    });

    it('should throw on invalid handle', async () => {
      await expect(
        service.upsertByGithub({ ...profile, githubHandle: 'invalid handle!' }),
      ).rejects.toThrow('Handle GitHub inválido');
    });
  });

  // ─── findAllActive ────────────────────────────────────────────────────────

  describe('findAllActive', () => {
    it('should return paginated active members', async () => {
      const members = [mockMember()];
      memberRepo.findAndCount.mockResolvedValue([members, 1]);

      const result = await service.findAllActive(1, 50);

      expect(result).toEqual({
        data: members,
        total: 1,
        page: 1,
        totalPages: 1,
      });
      expect(memberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 50,
        }),
      );
    });

    it('should cap limit at 100', async () => {
      memberRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllActive(1, 200);

      expect(memberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ─── findOne / findByHandle ───────────────────────────────────────────────

  describe('findOne', () => {
    it('should return an active member by id', async () => {
      const member = mockMember();
      memberRepo.findOne.mockResolvedValue(member);

      const result = await service.findOne(member.id);

      expect(result).toEqual(member);
      expect(memberRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: member.id, isActive: true },
        }),
      );
    });

    it('should return null when not found', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.findOne('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByHandle', () => {
    it('should find a member by GitHub handle', async () => {
      const member = mockMember();
      memberRepo.findOne.mockResolvedValue(member);

      const result = await service.findByHandle('testuser');

      expect(result).toEqual(member);
      expect(memberRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { githubHandle: 'testuser', isActive: true },
        }),
      );
    });
  });

  // ─── updateMe / updateMeById ──────────────────────────────────────────────

  describe('updateMeById', () => {
    it('should update and return the member', async () => {
      const member = mockMember();
      memberRepo.findOneOrFail.mockResolvedValue(member);

      const result = await service.updateMeById(member.id, { bio: 'New bio' });

      expect(memberRepo.update).toHaveBeenCalledWith(
        { id: member.id },
        { bio: 'New bio' },
      );
      expect(result).toEqual(member);
    });
  });

  // ─── adminUpdate ──────────────────────────────────────────────────────────

  describe('adminUpdate', () => {
    it('should update role and return member', async () => {
      const member = mockMember();
      memberRepo.findOneOrFail.mockResolvedValue(member);

      const result = await service.adminUpdate(member.id, {
        role: MemberRole.ADMIN,
      });

      expect(memberRepo.update).toHaveBeenCalledWith(member.id, {
        role: MemberRole.ADMIN,
      });
      expect(result).toEqual(member);
    });

    it('should deactivate a member', async () => {
      const member = mockMember();
      memberRepo.findOneOrFail.mockResolvedValue(member);

      await service.adminUpdate(member.id, { isActive: false });

      expect(memberRepo.update).toHaveBeenCalledWith(member.id, {
        isActive: false,
      });
    });
  });

  // ─── findAll (admin) ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all members ordered by joinedAt DESC', async () => {
      const members = [mockMember()];
      memberRepo.find.mockResolvedValue(members);

      const result = await service.findAll();

      expect(result).toEqual(members);
      expect(memberRepo.find).toHaveBeenCalledWith({
        order: { joinedAt: 'DESC' },
      });
    });
  });

  // ─── findDonors ───────────────────────────────────────────────────────────

  describe('findDonors', () => {
    it('should return paginated donors with totals', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            id: '11111111-1111-1111-1111-111111111111',
            githubHandle: 'donor1',
            name: 'Donor One',
            avatarUrl: 'https://example.com/avatar.png',
            bio: null,
            linkedinUrl: null,
            role: 'membro',
            joinedAt: '2024-01-01T00:00:00Z',
            totalDonated: '100.00',
            lastDonatedAt: '2024-06-01T00:00:00Z',
            donationCount: '5',
          },
        ]),
        getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findDonors(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].totalDonated).toBe(100);
      expect(result.data[0].donationCount).toBe(5);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should clamp page and limit values', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findDonors(-1, 200);

      expect(result.page).toBe(1);
      // limit is clamped to 100
      expect(qb.limit).toHaveBeenCalledWith(100);
    });
  });

  // ─── findMemberDonations ─────────────────────────────────────────────────

  describe('findMemberDonations', () => {
    it('should return donation history with type labels', async () => {
      const memberId = '11111111-1111-1111-1111-111111111111';
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            amount: 50,
            description:
              'Doação de @user [11111111-1111-1111-1111-111111111111]',
            createdAt: new Date('2024-06-01'),
            destinationAccount: { name: 'DevParaná', projectKey: 'devparana' },
          },
          {
            id: 'tx-2',
            amount: 25,
            description:
              'Assinatura mensal de @user [11111111-1111-1111-1111-111111111111]',
            createdAt: new Date('2024-07-01'),
            destinationAccount: {
              name: 'Codaqui',
              projectKey: 'tesouro-geral',
            },
          },
          {
            id: 'tx-3',
            amount: 100,
            description:
              'Assinatura anual de @user [11111111-1111-1111-1111-111111111111]',
            createdAt: new Date('2024-08-01'),
            destinationAccount: null,
          },
        ]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findMemberDonations(memberId);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('Doação única');
      expect(result[0].community).toBe('DevParaná');
      expect(result[1].type).toBe('Assinatura mensal');
      expect(result[2].type).toBe('Assinatura anual');
      expect(result[2].community).toBe('Comunidade');
    });
  });
});
