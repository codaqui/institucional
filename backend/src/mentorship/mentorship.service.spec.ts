import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MentorshipService } from './mentorship.service';
import type { JwtPayload } from '../auth/jwt.strategy';

const actor = (roles: string[]): JwtPayload => ({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  githubId: '1', handle: 'ana', name: 'Ana', email: 'ana@example.test', avatarUrl: '', roles,
} as JwtPayload);
const candidate = actor(['membro']);
const managerActor = actor(['diretor']);
const adminActor = actor(['admin']);

describe('MentorshipService — applications and profile', () => {
  let service: MentorshipService;
  let profileRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let availabilityRepo: Record<string, jest.Mock>;
  let sessionRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    profileRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'profile-1', active: true, ...value })),
      findOneBy: jest.fn().mockResolvedValue({ id: 'profile-1', memberId: candidate.sub, active: true, areas: ['DevOps'], focus: 'Carreira' }),
      find: jest.fn().mockResolvedValue([]),
    };
    designationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    designations = {
      grant: jest.fn().mockImplementation((input) => Promise.resolve({ id: 'application-1', ...input })),
      confirm: jest.fn().mockImplementation((id) => Promise.resolve({ id, status: 'active' })),
      hasDesignation: jest.fn().mockResolvedValue(true),
      invalidateCache: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    memberRepo = { findBy: jest.fn().mockResolvedValue([]) };
    availabilityRepo = { find: jest.fn().mockResolvedValue([]) };
    sessionRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new MentorshipService(
      profileRepo as any, designationRepo as any, designations as any, audit as any,
      memberRepo as any, availabilityRepo as any, sessionRepo as any,
    );
  });

  it('creates a pending application and rejects duplicates', async () => {
    const pending = await service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate);
    expect(pending).toMatchObject({ id: 'application-1', status: 'pending', designation: 'mentor', targetKey: 'mentoria' });

    designations.grant.mockRejectedValue(new ConflictException('Já existe candidatura pendente.'));
    await expect(service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate)).rejects.toThrow(ConflictException);
  });

  it('allows only admin to confirm and creates the active profile', async () => {
    designationRepo.findOneBy.mockResolvedValue({ id: 'application-1', status: 'pending', memberId: candidate.sub });
    await expect(service.confirmApplication('application-1', managerActor)).rejects.toThrow(ForbiddenException);

    const profile = await service.confirmApplication('application-1', adminActor);
    expect(profile).toMatchObject({ id: 'profile-1', active: true, approvedById: adminActor.sub });
    expect(designations.invalidateCache).toHaveBeenCalledTimes(1);
  });

  it('updates focus and areas only for an active mentor', async () => {
    const updated = await service.updateProfile({ areas: ['Backend', '.NET'], focus: 'Arquitetura' }, candidate);
    expect(profileRepo.save).toHaveBeenCalledWith(expect.objectContaining({ areas: ['Backend', '.NET'], focus: 'Arquitetura' }));
    expect(updated.focus).toBe('Arquitetura');

    profileRepo.findOneBy.mockResolvedValue(null);
    await expect(service.updateProfile({ areas: ['DevOps'] }, candidate)).rejects.toThrow(ForbiddenException);
  });

  it('projects public mentors and aggregate insights without actor or mentee data', async () => {
    profileRepo.find.mockResolvedValue([{
      id: 'profile-1', memberId: candidate.sub, approvedById: adminActor.sub,
      active: true, areas: ['DevOps'], focus: 'Carreira',
    }]);
    memberRepo.findBy.mockResolvedValue([{
      id: candidate.sub, githubHandle: 'ana', name: 'Ana', avatarUrl: 'avatar', isActive: true,
      email: 'private@example.test',
    }]);
    availabilityRepo.find.mockResolvedValue([{
      id: 'availability-private', mentorId: 'profile-1', weekday: 1,
      startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo',
    }]);
    sessionRepo.find.mockResolvedValue([
      { mentorId: 'profile-1', status: 'completed', menteeEmail: 'private@example.test' },
      { mentorId: 'profile-1', status: 'no_show', menteeEmail: 'private@example.test' },
    ]);

    const payload = await service.listPublic();

    expect(payload.mentors).toEqual([{
      id: 'profile-1', handle: 'ana', name: 'Ana', avatarUrl: 'avatar',
      areas: ['DevOps'], focus: 'Carreira',
      availability: [{ weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }],
    }]);
    expect(payload.mentors[0]).not.toHaveProperty('memberId');
    expect(payload).not.toHaveProperty('sessions');
    expect(payload.insights).toEqual({
      completed: 1,
      activeMentors: 1,
      areas: [{ area: 'DevOps', mentors: 1, completed: 1 }],
      noShowRate: 0.5,
    });
    expect(JSON.stringify(payload)).not.toContain('private@example.test');
  });

  it('allows only admins to read operational insights', async () => {
    await expect(service.listInsights(managerActor)).rejects.toThrow(ForbiddenException);

    await expect(service.listInsights(adminActor)).resolves.toMatchObject({
      requested: 0, confirmed: 0, completed: 0, canceled: 0, noShow: 0,
    });
  });
});
