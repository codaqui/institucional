import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { AuditService } from '../audit/audit.service';
import { MemberRole } from './entities/member.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockMember = () => ({
  id: '11111111-1111-1111-1111-111111111111',
  githubHandle: 'testuser',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  bio: null,
  linkedinUrl: null,
  role: MemberRole.MEMBRO,
  joinedAt: new Date('2024-01-01'),
});

describe('MembersController', () => {
  let controller: MembersController;
  let membersService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  beforeEach(async () => {
    membersService = {
      findAllActive: jest.fn(),
      findOne: jest.fn(),
      findByHandle: jest.fn(),
      findDonors: jest.fn(),
      findMemberDonations: jest.fn(),
      findAll: jest.fn(),
      adminUpdate: jest.fn(),
      updateMeById: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        { provide: MembersService, useValue: membersService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    controller = module.get<MembersController>(MembersController);
  });

  describe('findAll (GET /members)', () => {
    it('should return paginated active members with defaults', async () => {
      const expected = {
        data: [mockMember()],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      membersService.findAllActive.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(result).toEqual(expected);
      expect(membersService.findAllActive).toHaveBeenCalledWith(1, 50);
    });

    it('should parse page and limit query params', async () => {
      membersService.findAllActive.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        totalPages: 0,
      });

      await controller.findAll(2, 10);

      expect(membersService.findAllActive).toHaveBeenCalledWith(2, 10);
    });
  });

  describe('findDonors (GET /members/donors)', () => {
    it('should return donors list', async () => {
      const expected = { data: [], total: 0, page: 1, totalPages: 0 };
      membersService.findDonors.mockResolvedValue(expected);

      const result = await controller.findDonors();

      expect(result).toEqual(expected);
    });
  });

  describe('getMe (GET /members/me)', () => {
    it('should return the authenticated member', async () => {
      const member = mockMember();
      membersService.findOne.mockResolvedValue(member);

      const result = await controller.getMe({
        user: {
          sub: member.id,
          githubId: '12345',
          handle: 'testuser',
          name: 'Test',
          email: 't@t.com',
          avatarUrl: '',
          role: 'membro',
        },
      });

      expect(result).toEqual(member);
      expect(membersService.findOne).toHaveBeenCalledWith(member.id);
    });
  });

  describe('updateMe (PUT /members/me)', () => {
    it('should update the member profile', async () => {
      const member = mockMember();
      membersService.updateMeById.mockResolvedValue({
        ...member,
        bio: 'New bio',
      });

      const result = await controller.updateMe(
        {
          user: {
            sub: member.id,
            githubId: '12345',
            handle: 'testuser',
            name: 'Test',
            email: 't@t.com',
            avatarUrl: '',
            role: 'membro',
          },
        },
        { bio: 'New bio' },
      );

      expect(result.bio).toBe('New bio');
      expect(membersService.updateMeById).toHaveBeenCalledWith(member.id, {
        bio: 'New bio',
      });
    });
  });

  describe('findByHandle (GET /members/by-handle/:handle)', () => {
    it('should return a member by handle', async () => {
      const member = mockMember();
      membersService.findByHandle.mockResolvedValue(member);

      const result = await controller.findByHandle('testuser');

      expect(result).toEqual(member);
    });

    it('should throw BadRequestException for invalid handle', async () => {
      await expect(controller.findByHandle('invalid handle!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when not found', async () => {
      membersService.findByHandle.mockResolvedValue(null);
      await expect(controller.findByHandle('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne (GET /members/:id)', () => {
    it('should return a member by id', async () => {
      const member = mockMember();
      membersService.findOne.mockResolvedValue(member);

      const result = await controller.findOne(member.id);

      expect(result).toEqual(member);
    });

    it('should throw NotFoundException when not found', async () => {
      membersService.findOne.mockResolvedValue(null);
      await expect(controller.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMemberDonations (GET /members/:id/donations)', () => {
    it('should return donations for a member', async () => {
      const member = mockMember();
      membersService.findOne.mockResolvedValue(member);
      membersService.findMemberDonations.mockResolvedValue([]);

      const result = await controller.findMemberDonations(member.id);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when member not found', async () => {
      membersService.findOne.mockResolvedValue(null);
      await expect(controller.findMemberDonations('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllAdmin (GET /admin/members)', () => {
    it('should return all members including inactive', async () => {
      const members = [mockMember()];
      membersService.findAll.mockResolvedValue(members);

      const result = await controller.findAllAdmin();

      expect(result).toEqual(members);
    });
  });

  describe('adminUpdate (PATCH /admin/members/:id)', () => {
    const req = {
      user: {
        sub: 'admin-id',
        githubId: '99',
        handle: 'admin',
        name: 'Admin',
        email: 'a@a.com',
        avatarUrl: '',
        role: 'admin',
      },
    };

    it('should update role and log audit', async () => {
      const member = mockMember();
      membersService.adminUpdate.mockResolvedValue(member);

      await controller.adminUpdate(member.id, req, { role: MemberRole.ADMIN });

      expect(membersService.adminUpdate).toHaveBeenCalledWith(member.id, {
        role: MemberRole.ADMIN,
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.role_change' }),
      );
    });

    it('should log MEMBER_DEACTIVATE when isActive is false', async () => {
      membersService.adminUpdate.mockResolvedValue(mockMember());

      await controller.adminUpdate('some-id', req, { isActive: false });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.deactivate' }),
      );
    });

    it('should log MEMBER_ACTIVATE when isActive is true', async () => {
      membersService.adminUpdate.mockResolvedValue(mockMember());

      await controller.adminUpdate('some-id', req, { isActive: true });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.activate' }),
      );
    });

    it('should not log audit when no action applies', async () => {
      membersService.adminUpdate.mockResolvedValue(mockMember());

      await controller.adminUpdate('some-id', req, {});

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
