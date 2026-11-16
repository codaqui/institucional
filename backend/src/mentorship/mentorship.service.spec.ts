import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MentorshipService } from './mentorship.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
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
  let dataSource: Record<string, jest.Mock>;
  let queryRunner: Record<string, jest.Mock>;
  let memberOptionsQuery: Record<string, jest.Mock>;

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
      hasDesignation: jest.fn().mockResolvedValue(false),
      invalidateCache: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    memberOptionsQuery = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'member-1', name: 'Ana', githubHandle: 'ana', avatarUrl: 'avatar', email: 'private@example.test' }]),
    };
    memberRepo = {
      findBy: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(memberOptionsQuery),
    };
    availabilityRepo = { find: jest.fn().mockResolvedValue([]) };
    sessionRepo = { find: jest.fn().mockResolvedValue([]) };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === MemberDesignation) return designationRepo;
          if (entity === MentorProfile) return profileRepo;
          throw new Error('Repositório inesperado');
        }),
      },
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    service = new MentorshipService(
      profileRepo as any, designationRepo as any, designations as any, audit as any,
      memberRepo as any, availabilityRepo as any, sessionRepo as any, dataSource as any,
    );
  });

  it('creates a pending application and rejects duplicates', async () => {
    const pending = await service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate);
    expect(pending).toMatchObject({ id: 'application-1', status: 'pending', designation: 'mentor', targetKey: 'mentoria' });

    designations.grant.mockRejectedValue(new ConflictException('Já existe candidatura pendente.'));
    await expect(service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate)).rejects.toThrow(ConflictException);
  });

  it('lists only real pending candidates with public member and profile data', async () => {
    designationRepo.find.mockResolvedValue([
      { id: 'placeholder-application', memberId: 'placeholder-1', status: 'pending', designation: 'mentor' },
      { id: 'application-1', memberId: candidate.sub, status: 'pending', designation: 'mentor' },
    ]);
    memberRepo.findBy.mockResolvedValue([{
      id: candidate.sub, name: 'Ana', githubHandle: 'ana', avatarUrl: 'avatar', isActive: true,
      email: 'private@example.test',
    }]);
    profileRepo.find.mockResolvedValue([{ memberId: candidate.sub, areas: ['DevOps'], focus: 'Carreira' }]);

    const applications = await service.listApplications(adminActor);

    expect(applications).toEqual([{
      id: 'application-1', memberId: candidate.sub, status: 'pending', designation: 'mentor',
      name: 'Ana', githubHandle: 'ana', avatarUrl: 'avatar', areas: ['DevOps'], focus: 'Carreira',
    }]);
    expect(JSON.stringify(applications)).not.toContain('placeholder-application');
    expect(JSON.stringify(applications)).not.toContain('private@example.test');
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
    designationRepo.find.mockResolvedValue([{
      memberId: candidate.sub,
      targetType: 'program',
      targetKey: 'mentoria',
      designation: 'mentor',
      status: 'active',
    }]);

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

  it('omits active profiles without a valid mentor designation from the public snapshot', async () => {
    profileRepo.find.mockResolvedValue([{
      id: 'profile-1', memberId: candidate.sub, approvedById: adminActor.sub,
      active: true, areas: ['DevOps'], focus: 'Carreira',
    }]);
    memberRepo.findBy.mockResolvedValue([{
      id: candidate.sub, githubHandle: 'ana', name: 'Ana', avatarUrl: 'avatar', isActive: true,
    }]);
    designationRepo.find.mockResolvedValue([]);

    const payload = await service.listPublic();

    expect(payload.mentors).toEqual([]);
    expect(payload.insights.activeMentors).toBe(0);
    expect(designationRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ validUntil: expect.anything() }),
      }),
    );
  });

  it('searches active member options with escaped wildcards and a public whitelist', async () => {
    const result = await service.searchMemberOptions('A%_\\');

    expect(memberOptionsQuery.andWhere).toHaveBeenCalledWith(
      '(member.name ILIKE :term OR member.githubHandle ILIKE :term)',
      { term: '%A\\%\\_\\\\%' },
    );
    expect(memberOptionsQuery.take).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ id: 'member-1', name: 'Ana', githubHandle: 'ana', avatarUrl: 'avatar' }]);
    expect(JSON.stringify(result)).not.toContain('private@example.test');
  });

  it('allows only admins to read operational insights', async () => {
    await expect(service.listInsights(managerActor)).rejects.toThrow(ForbiddenException);

    await expect(service.listInsights(adminActor)).resolves.toMatchObject({
      requested: 0, confirmed: 0, completed: 0, canceled: 0, noShow: 0,
    });
  });

  it('rejects reapplication by an already active mentor without deactivating the profile', async () => {
    designations.hasDesignation.mockResolvedValue(true);

    await expect(service.apply({ areas: ['DevOps'] }, candidate)).rejects.toThrow(ConflictException);

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(profileRepo.save).not.toHaveBeenCalled();
    expect(designations.hasDesignation).toHaveBeenCalledWith(candidate.sub, {
      targetType: 'program',
      targetKey: 'mentoria',
      designation: 'mentor',
    });
  });

  it('reuses the existing profile on reapplication and keeps it inactive until confirmation', async () => {
    profileRepo.findOneBy.mockResolvedValue({
      id: 'profile-1',
      memberId: candidate.sub,
      active: true,
      areas: ['Antiga'],
      focus: 'Antigo',
      approvedById: 'original-admin',
    });

    await service.apply({ areas: ['Backend', 'Carreira'], focus: 'Nova candidatura' }, candidate);

    expect(profileRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'profile-1',
        areas: ['Backend', 'Carreira'],
        focus: 'Nova candidatura',
        active: false,
        approvedById: 'original-admin',
      }),
    );
    expect(profileRepo.create).not.toHaveBeenCalled();
    expect(designations.grant).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.objectContaining({ actorId: candidate.sub }),
      queryRunner,
    );
  });

  it('rolls back both writes when saving the profile fails', async () => {
    profileRepo.save.mockRejectedValue(new Error('unique violation'));

    await expect(service.apply({ areas: ['DevOps'] }, candidate)).rejects.toThrow('unique violation');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(designations.grant).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      queryRunner,
    );
  });

  it('creates a new inactive profile when there is no previous one', async () => {
    profileRepo.findOneBy.mockResolvedValue(null);

    await service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate);

    expect(profileRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: candidate.sub, active: false, focus: 'Carreira' }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
