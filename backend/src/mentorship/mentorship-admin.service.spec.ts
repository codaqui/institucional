import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Member } from '../members/entities/member.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorshipService } from './mentorship.service';

const admin = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'admin', roles: ['admin'],
} as JwtPayload;
const manager = { ...admin, sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', roles: ['membro'] } as JwtPayload;

describe('MentorshipService — admin mentors', () => {
  let service: MentorshipService;
  let profileRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let txProfiles: Record<string, jest.Mock>;
  let txMembers: Record<string, jest.Mock>;
  let txDesignations: Record<string, jest.Mock>;

  beforeEach(() => {
    txProfiles = {
      findOneBy: jest.fn(),
      save: jest.fn((profile) => Promise.resolve(profile)),
    };
    txMembers = { findOneBy: jest.fn() };
    txDesignations = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((designation) => designation),
      save: jest.fn((designation) => Promise.resolve(designation)),
    };
    const txManager = {
      getRepository: jest.fn((entity) => {
        if (entity === MentorProfile) return txProfiles;
        if (entity === Member) return txMembers;
        if (entity === MemberDesignation) return txDesignations;
        throw new Error('Repositório inesperado');
      }),
    };
    profileRepo = {
      findAndCount: jest.fn(),
      manager: { transaction: jest.fn((work) => work(txManager)) },
    };
    memberRepo = { findBy: jest.fn() };
    designationRepo = {};
    designations = {
      syncMember: jest.fn().mockResolvedValue(undefined),
      invalidateCache: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new MentorshipService(
      profileRepo as any,
      designationRepo as any,
      designations as any,
      audit as any,
      memberRepo as any,
      {} as any,
      {} as any,
    );
  });

  it('rejects non-admin and paginates mentor projections without exposing emails', async () => {
    await expect(service.listMentors(manager, 1, 50)).rejects.toThrow(ForbiddenException);

    profileRepo.findAndCount.mockResolvedValue([[{
      id: 'profile-1', memberId: 'placeholder-1', areas: ['Backend'], focus: null, active: false,
    }], 2]);
    memberRepo.findBy.mockResolvedValue([{
      id: 'placeholder-1', name: 'Mentor histórico', githubHandle: 'seed-matheus', avatarUrl: '',
      email: 'seed-matheus@anon.invalid', isActive: false,
    }]);

    await expect(service.listMentors(admin, 2, 1)).resolves.toEqual({
      data: [{
        id: 'profile-1', memberId: 'placeholder-1', name: 'Mentor histórico',
        githubHandle: 'seed-matheus', avatarUrl: '', areas: ['Backend'], focus: null,
        active: false, isPlaceholder: true,
      }],
      total: 2, page: 2, totalPages: 2, limit: 1,
    });
    expect(profileRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1 }));
    expect(JSON.stringify(await service.listMentors(admin, 2, 1))).not.toContain('@anon.invalid');
  });

  it('reassigns a placeholder, revokes the old designation and activates the new one', async () => {
    const profile = {
      id: 'profile-1', memberId: 'placeholder-1', areas: ['Backend'], focus: null,
      active: false, approvedById: 'placeholder-1',
    };
    txProfiles.findOneBy.mockImplementation(({ id }) => Promise.resolve(id === profile.id ? profile : null));
    txMembers.findOneBy.mockResolvedValue({ id: 'member-1', isActive: true });
    txDesignations.find.mockResolvedValue([
      { id: 'old-designation', memberId: 'placeholder-1', status: 'pending' },
      { id: 'new-designation', memberId: 'member-1', status: 'removed', endedAt: new Date() },
    ]);

    const updated = await service.updateMentor('profile-1', {
      memberId: 'member-1', areas: ['Backend', '.NET'], focus: ' Arquitetura ', active: true,
    }, admin);

    expect(updated).toMatchObject({ memberId: 'member-1', areas: ['Backend', '.NET'], focus: 'Arquitetura', active: true });
    expect(txDesignations.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'old-designation', status: 'removed' }));
    expect(txDesignations.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-designation', status: 'active', endedAt: null }));
    expect(designations.syncMember).toHaveBeenCalledWith('placeholder-1');
    expect(designations.syncMember).toHaveBeenCalledWith('member-1');
    expect(designations.invalidateCache).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.MENTOR_PROFILE_UPDATED,
      details: expect.objectContaining({
        before: expect.objectContaining({ memberId: 'placeholder-1', active: false }),
        after: expect.objectContaining({ memberId: 'member-1', active: true }),
      }),
    }));
  });

  it('deactivates a mentor and removes only the mentorship designation', async () => {
    const profile = { id: 'profile-1', memberId: 'member-1', areas: ['DevOps'], focus: null, active: true };
    txProfiles.findOneBy.mockResolvedValue(profile);
    txMembers.findOneBy.mockResolvedValue({ id: 'member-1', isActive: true });
    txDesignations.find.mockResolvedValue([{ id: 'mentor-designation', memberId: 'member-1', status: 'active' }]);

    await service.updateMentor('profile-1', { memberId: 'member-1', areas: ['DevOps'], active: false }, admin);

    expect(profile.active).toBe(false);
    expect(txDesignations.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'mentor-designation', status: 'removed' }));
  });

  it('rejects an inactive or missing target member', async () => {
    txProfiles.findOneBy.mockResolvedValue({ id: 'profile-1', memberId: 'placeholder-1', active: false });
    txMembers.findOneBy.mockResolvedValue(null);

    await expect(service.updateMentor('profile-1', {
      memberId: 'missing-member', areas: ['DevOps'], active: true,
    }, admin)).rejects.toThrow(NotFoundException);
    expect(txProfiles.save).not.toHaveBeenCalled();
  });

  it('rejects a member already linked to another mentor profile', async () => {
    txProfiles.findOneBy.mockImplementation(({ id, memberId }) => Promise.resolve(
      id === 'profile-1'
        ? { id: 'profile-1', memberId: 'placeholder-1', active: false }
        : memberId === 'member-1' ? { id: 'other-profile', memberId: 'member-1' } : null,
    ));
    txMembers.findOneBy.mockResolvedValue({ id: 'member-1', isActive: true });

    await expect(service.updateMentor('profile-1', {
      memberId: 'member-1', areas: ['DevOps'], active: true,
    }, admin)).rejects.toThrow(ConflictException);
    expect(txProfiles.save).not.toHaveBeenCalled();
  });
});
