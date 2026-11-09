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

  beforeEach(() => {
    profileRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'profile-1', active: true, ...value })),
      findOneBy: jest.fn().mockResolvedValue({ id: 'profile-1', memberId: candidate.sub, active: true, areas: ['DevOps'], focus: 'Carreira' }),
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
    service = new MentorshipService(profileRepo as any, designationRepo as any, designations as any, audit as any);
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
});
