import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Member } from '../members/entities/member.entity';
import { MemberDesignation } from './entities/member-designation.entity';
import { DesignationsService } from './designations.service';

describe('DesignationsService', () => {
  let service: DesignationsService;
  let repo: Record<string, jest.Mock>;
  let membersRepo: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;
  let queryRunner: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let member: Member;

  const actor = { actorId: 'admin-1', actorHandle: 'admin' };
  const directorInput = {
    memberId: 'member-1',
    targetType: 'directorate',
    targetId: 'directorate-1',
    designation: 'director',
    appointedById: 'admin-1',
  } as const;

  beforeEach(() => {
    member = {
      id: 'member-1',
      roles: ['membro', 'admin'],
    } as Member;

    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((value) => ({ ...value })),
      save: jest.fn().mockImplementation(async (value) => ({
        ...value,
        id: value.id ?? 'designation-1',
      })),
    };
    membersRepo = {
      findOne: jest.fn().mockResolvedValue(member),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === MemberDesignation) return repo;
          if (entity === Member) return membersRepo;
          throw new Error('Repositório inesperado');
        }),
      },
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new DesignationsService(
      repo as any,
      membersRepo as any,
      dataSource as any,
      audit as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires validUntil to be null or in the future when checking a designation', async () => {
    await service.hasDesignation('member-1', {
      targetType: 'ies',
      targetId: 'ies-1',
      designation: 'ambassador',
    });

    expect(repo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ validUntil: expect.anything() }),
    });
  });

  it('grants a director and derives both organizational roles', async () => {
    repo.find.mockResolvedValue([{ ...directorInput, status: 'active' }]);

    const designation = await service.grant(directorInput, actor);

    expect(designation.status).toBe('active');
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.arrayContaining(['membro', 'diretor', 'voluntario']),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESIGNATION_GRANTED }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.ROLE_DERIVED }),
    );
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['member-1'],
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid target and designation combination in the service', async () => {
    await expect(
      service.grant({ ...directorInput, targetId: undefined }, actor),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does not grant a second active responsible for the same community', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing', status: 'active' });

    await expect(
      service.grant(
        {
          memberId: 'member-2',
          targetType: 'community',
          targetId: 'community-1',
          designation: 'responsible',
          appointedById: 'admin-1',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(repo.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('returns an existing active designation without writing again', async () => {
    const existing = {
      ...directorInput,
      id: 'designation-1',
      status: 'active',
    };
    repo.findOne.mockResolvedValue(existing);

    await expect(service.grant(directorInput, actor)).resolves.toBe(existing);

    expect(repo.save).not.toHaveBeenCalled();
    expect(membersRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('accepts a pending grant without deriving roles', async () => {
    const designation = await service.grant(
      { ...directorInput, status: 'pending' },
      actor,
    );

    expect(designation.status).toBe('pending');
    expect(membersRepo.save).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESIGNATION_GRANTED }),
    );
  });

  it('confirms a pending designation and derives its roles', async () => {
    const pending = {
      ...directorInput,
      id: 'designation-1',
      status: 'pending',
    };
    repo.findOne.mockResolvedValueOnce(pending).mockResolvedValue(null);
    repo.find.mockResolvedValue([{ ...pending, status: 'active' }]);

    const designation = await service.confirm('designation-1', actor);

    expect(designation.status).toBe('active');
    expect(designation.confirmedById).toBe('admin-1');
    expect(designation.confirmedAt).toBeInstanceOf(Date);
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.arrayContaining(['diretor', 'voluntario']),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESIGNATION_CONFIRMED }),
    );
  });

  it('returns an active designation when confirmation is repeated', async () => {
    const active = { ...directorInput, id: 'designation-1', status: 'active' };
    repo.findOne.mockResolvedValue(active);

    await expect(service.confirm('designation-1', actor)).resolves.toBe(active);

    expect(repo.save).not.toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(membersRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects confirmation of a revoked designation', async () => {
    repo.findOne.mockResolvedValue({
      ...directorInput,
      id: 'designation-1',
      status: 'removed',
    });

    await expect(service.confirm('designation-1', actor)).rejects.toThrow(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('revokes a designation and removes only its derived roles', async () => {
    member.roles = [
      'membro',
      'admin',
      'diretor',
      'voluntario',
      'mentor',
      'gestor_universitario',
    ] as Member['roles'];
    repo.findOne.mockResolvedValue({
      ...directorInput,
      id: 'designation-1',
      status: 'active',
    });
    repo.find.mockResolvedValue([]);

    const designation = await service.revoke('designation-1', actor);

    expect(designation.status).toBe('removed');
    expect(designation.endedAt).toBeInstanceOf(Date);
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['membro', 'admin'] }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESIGNATION_REVOKED }),
    );
  });

  it('returns a removed designation when revocation is repeated', async () => {
    const removed = {
      ...directorInput,
      id: 'designation-1',
      status: 'removed',
    };
    repo.findOne.mockResolvedValue(removed);

    await expect(service.revoke('designation-1', actor)).resolves.toBe(removed);

    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('returns an ended designation when revocation is repeated', async () => {
    const ended = {
      ...directorInput,
      id: 'designation-1',
      status: 'ended',
    };
    repo.findOne.mockResolvedValue(ended);

    await expect(service.revoke('designation-1', actor)).resolves.toBe(ended);

    expect(repo.save).not.toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(membersRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('throws when confirming an unknown designation', async () => {
    await expect(service.confirm('missing', actor)).rejects.toThrow(
      NotFoundException,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('lists only active designations for a member', async () => {
    const active = [{ ...directorInput, status: 'active' }];
    repo.find.mockResolvedValue(active);

    await expect(service.listActive('member-1')).resolves.toBe(active);
    expect(repo.find).toHaveBeenCalledWith({
      where: { memberId: 'member-1', status: 'active' },
      order: { createdAt: 'ASC' },
    });
  });

  it.each([
    {
      name: 'volunteer directorate',
      designation: {
        targetType: 'directorate',
        targetId: 'directorate-1',
        designation: 'volunteer',
      },
      roles: ['voluntario'],
    },
    {
      name: 'mentoring program',
      designation: {
        targetType: 'program',
        targetKey: 'mentoria',
        designation: 'mentor',
      },
      roles: ['mentor'],
    },
    {
      name: 'extension project mentor',
      designation: {
        targetType: 'extension_project',
        targetId: 'project-1',
        designation: 'mentor',
      },
      roles: ['mentor'],
    },
    {
      name: 'university program manager',
      designation: {
        targetType: 'program',
        targetKey: 'universitario',
        designation: 'manager',
      },
      roles: ['gestor_universitario'],
    },
  ])('derives roles from $name', async ({ designation, roles }) => {
    repo.find.mockResolvedValue([
      { memberId: 'member-1', status: 'active', ...designation },
    ]);

    await service.syncMember('member-1');

    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.arrayContaining(roles),
      }),
    );
  });

  it('does not derive mentor from another program', async () => {
    member.roles = ['membro', 'mentor'] as Member['roles'];
    repo.find.mockResolvedValue([
      {
        memberId: 'member-1',
        targetType: 'program',
        targetKey: 'outro',
        designation: 'mentor',
        status: 'active',
      },
    ]);

    await service.syncMember('member-1');

    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['membro'] }),
    );
  });

  it('throws when synchronizing an unknown member', async () => {
    membersRepo.findOne.mockResolvedValue(null);

    await expect(service.syncMember('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('finds an active designation on any concrete target without null filters', async () => {
    repo.findOne.mockResolvedValue({ id: 'designation-1', status: 'active' });

    await expect(
      service.hasAnyDesignation('member-1', {
        targetType: 'directorate',
        designation: 'director',
      }),
    ).resolves.toBe(true);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        memberId: 'member-1',
        status: 'active',
        targetType: 'directorate',
        designation: 'director',
      },
    });
  });

  it('caches designation checks for 60 seconds', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T12:00:00Z'));
    repo.findOne.mockResolvedValue({ id: 'designation-1', status: 'active' });
    const query = {
      targetType: 'directorate',
      targetId: 'directorate-1',
      designation: 'director',
    } as const;

    await expect(service.hasDesignation('member-1', query)).resolves.toBe(true);
    await expect(service.hasDesignation('member-1', query)).resolves.toBe(true);
    expect(repo.findOne).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_001);
    await expect(service.hasDesignation('member-1', query)).resolves.toBe(true);
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached designation checks after a write', async () => {
    const query = {
      targetType: 'event',
      targetId: 'event-1',
      designation: 'organizer',
    } as const;
    repo.findOne
      .mockResolvedValueOnce({ id: 'existing', status: 'active' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'designation-1', status: 'active' });

    await service.hasDesignation('member-1', query);
    await service.grant(
      { memberId: 'member-1', ...query, appointedById: 'admin-1' },
      actor,
    );
    await service.hasDesignation('member-1', query);

    expect(repo.findOne).toHaveBeenCalledTimes(3);
  });
});
