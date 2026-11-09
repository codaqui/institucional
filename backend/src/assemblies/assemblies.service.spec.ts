import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { AssembliesService } from './assemblies.service';
import { UpdateAssemblyDto, type CreateAssemblyDto } from './dto/assembly.dto';
import { Assembly } from './entities/assembly.entity';

const director = {
  sub: 'director-1',
  handle: 'diretor',
  roles: ['diretor'],
} as JwtPayload;
const admin = {
  sub: 'admin-1',
  handle: 'admin',
  roles: ['admin'],
} as JwtPayload;
const member = {
  sub: 'member-1',
  handle: 'membro',
  roles: ['membro'],
} as JwtPayload;

const baseDto: CreateAssemblyDto = {
  entityId: 'codaqui-entity',
  type: 'ordinaria',
  title: 'Assembleia ordinária',
  scheduledAt: new Date('2026-12-01T18:00:00Z'),
  agendaSummary: 'Resumo sintético da pauta.',
  discussionUrl: 'https://github.com/codaqui/institucional/discussions/101',
};

function makeAssembly(overrides: Partial<Assembly> = {}): Assembly {
  return Object.assign(new Assembly(), {
    id: 'assembly-1',
    type: 'ordinaria',
    number: 1,
    title: baseDto.title,
    scheduledAt: baseDto.scheduledAt,
    heldAt: null,
    status: 'scheduled',
    agendaSummary: baseDto.agendaSummary,
    discussionUrl: baseDto.discussionUrl,
    ataPdfUrl: null,
    notaryRegistry: null,
    entityId: baseDto.entityId,
    createdById: 'creator-private-id',
    createdAt: new Date('2026-11-01T12:00:00Z'),
    updatedAt: new Date('2026-11-01T12:00:00Z'),
    ...overrides,
  });
}

describe('AssembliesService', () => {
  let service: AssembliesService;
  let repo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let designations: { hasAnyDesignation: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      save: jest
        .fn()
        .mockImplementation((value: Assembly) => Promise.resolve(value)),
    };
    txRepo = {
      findOne: jest
        .fn()
        .mockImplementation(
          (options: unknown): Promise<Assembly | null> =>
            Promise.resolve(repo.findOne(options) as Assembly | null),
        ),
      create: jest
        .fn()
        .mockImplementation((value: Partial<Assembly>) =>
          Object.assign(new Assembly(), value),
        ),
      save: jest.fn().mockImplementation((value: Assembly) =>
        Promise.resolve(
          Object.assign(value, {
            id: 'assembly-1',
            createdAt: new Date('2026-11-01T12:00:00Z'),
            updatedAt: new Date('2026-11-01T12:00:00Z'),
          }),
        ),
      ),
    };
    manager = {
      query: jest
        .fn()
        .mockImplementation((sql: string) =>
          Promise.resolve(sql.includes('MAX(number)') ? [{ number: '1' }] : []),
        ),
      getRepository: jest.fn().mockReturnValue(txRepo),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((work: (value: unknown) => unknown) =>
          Promise.resolve(work(manager)),
        ),
    };
    designations = { hasAnyDesignation: jest.fn().mockResolvedValue(true) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AssembliesService(
      repo as unknown as Repository<Assembly>,
      dataSource as unknown as DataSource,
      designations as unknown as DesignationsService,
      audit as unknown as AuditService,
    );
  });

  it('creates the first assembly for an active director inside the numbered transaction', async () => {
    const created = await service.create(baseDto, director);

    expect(created).toMatchObject({
      type: 'ordinaria',
      number: 1,
      slug: 'ordinaria-1',
      status: 'scheduled',
    });
    expect(created).not.toHaveProperty('createdById');
    expect(designations.hasAnyDesignation).toHaveBeenCalledWith('director-1', {
      targetType: 'directorate',
      designation: 'director',
    });
    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['codaqui-entity:ordinaria'],
    );
    expect(manager.query).toHaveBeenNthCalledWith(
      2,
      'SELECT COALESCE(MAX(number), 0) + 1 AS number FROM assemblies WHERE "entityId" = $1 AND type = $2',
      ['codaqui-entity', 'ordinaria'],
    );
    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'director-1', number: 1 }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assembly.created',
        actorId: 'director-1',
        targetId: 'assembly-1',
        targetType: 'assembly',
      }),
    );
  });

  it('continues the independent numbering sequence of the requested type', async () => {
    manager.query.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('MAX(number)') ? [{ number: '8' }] : []),
    );

    const created = await service.create(
      { ...baseDto, type: 'oficial' },
      admin,
    );

    expect(created).toMatchObject({ type: 'oficial', number: 8 });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('MAX(number)'),
      ['codaqui-entity', 'oficial'],
    );
    expect(designations.hasAnyDesignation).not.toHaveBeenCalled();
  });

  it('rejects creation by a member without an active director designation', async () => {
    designations.hasAnyDesignation.mockResolvedValue(false);

    await expect(service.create(baseDto, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects notary data at creation by a non-admin director', async () => {
    await expect(
      service.create(
        {
          ...baseDto,
          ataPdfUrl: 'https://drive.google.com/file/d/minutes/view',
        },
        director,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('retries only the assembly type and number unique violation', async () => {
    txRepo.save
      .mockRejectedValueOnce({
        code: '23505',
        constraint: 'UQ_assemblies_entity_type_number',
      })
      .mockImplementationOnce((value: Assembly) =>
        Promise.resolve(Object.assign(value, { id: 'assembly-retry' })),
      );

    await expect(service.create(baseDto, admin)).resolves.toMatchObject({
      id: 'assembly-retry',
      number: 1,
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unrelated unique violation', async () => {
    const error = { code: '23505', constraint: 'UQ_another_constraint' };
    txRepo.save.mockRejectedValue(error);

    await expect(service.create(baseDto, admin)).rejects.toBe(error);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('lists the complete public collection by scheduled date descending without creator data', async () => {
    repo.find.mockResolvedValue([makeAssembly()]);

    const result = await service.listPublic();

    expect(repo.find).toHaveBeenCalledWith({
      order: { scheduledAt: 'DESC' },
    });
    expect(result[0]).toMatchObject({ slug: 'ordinaria-1' });
    expect(result[0]).not.toHaveProperty('createdById');
  });

  it('finds a public assembly by its derived slug', async () => {
    repo.findOne.mockResolvedValue(
      makeAssembly({ type: 'oficial', number: 2 }),
    );

    const result = await service.publicBySlug('oficial-2');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { type: 'oficial', number: 2, entity: { slug: 'codaqui' } },
    });
    expect(result).toMatchObject({ slug: 'oficial-2' });
    expect(result).not.toHaveProperty('createdById');
  });

  it.each(['invalid', 'oficial-0', 'oficial-2-extra'])(
    'returns not found for invalid public slug %s',
    async (slug) => {
      await expect(service.publicBySlug(slug)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findOne).not.toHaveBeenCalled();
    },
  );

  it('returns the standard management envelope with filters and safe projections', async () => {
    repo.findAndCount.mockResolvedValue([[makeAssembly()], 101]);

    const result = await service.listManage({
      page: 2,
      limit: 50,
      type: 'oficial',
      status: 'held',
    });

    expect(result).toEqual({
      data: [expect.objectContaining({ slug: 'ordinaria-1' })],
      total: 101,
      page: 2,
      totalPages: 3,
      limit: 50,
    });
    expect(result.data[0]).not.toHaveProperty('createdById');
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { type: 'oficial', status: 'held' },
      order: { scheduledAt: 'DESC' },
      skip: 50,
      take: 50,
    });
  });

  it('reuses the official held validation instead of duplicating it', async () => {
    const official = makeAssembly({ type: 'oficial' });
    repo.findOne.mockResolvedValue(official);

    await expect(
      service.update(
        official.id,
        {
          status: 'held',
          heldAt: new Date('2026-12-01T20:00:00Z'),
        },
        admin,
      ),
    ).rejects.toThrow('PDF e cartório');
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('keeps type, number and Discussion immutable at the service boundary', async () => {
    repo.findOne.mockResolvedValue(makeAssembly());

    await expect(
      service.update(
        'assembly-1',
        { number: 2 } as unknown as UpdateAssemblyDto,
        director,
      ),
    ).rejects.toThrow('number é imutável');
    await expect(
      service.update(
        'assembly-1',
        {
          discussionUrl:
            'https://github.com/codaqui/institucional/discussions/102',
        } as UpdateAssemblyDto,
        director,
      ),
    ).rejects.toThrow('discussionUrl é imutável');
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('audits a status transition with before and after states', async () => {
    repo.findOne.mockResolvedValue(makeAssembly());

    const updated = await service.update(
      'assembly-1',
      { status: 'canceled' },
      director,
    );

    expect(updated).toMatchObject({ status: 'canceled' });
    expect(txRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'assembly-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assembly.status_changed',
        details: { beforeStatus: 'scheduled', afterStatus: 'canceled' },
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assembly.updated' }),
    );
  });

  it('preserves unchanged fields when a transformed patch contains undefined optional properties', async () => {
    repo.findOne.mockResolvedValue(makeAssembly());
    const patch = Object.assign(new UpdateAssemblyDto(), {
      title: undefined,
      scheduledAt: undefined,
      heldAt: undefined,
      status: 'canceled',
      agendaSummary: undefined,
      ataPdfUrl: undefined,
      notaryRegistry: undefined,
    });

    const updated = await service.update('assembly-1', patch, admin);

    expect(updated).toMatchObject({
      title: 'Assembleia ordinária',
      scheduledAt: new Date('2026-12-01T18:00:00Z'),
      agendaSummary: 'Resumo sintético da pauta.',
      status: 'canceled',
    });
  });

  it('allows only admin to register notary data and audits that mutation', async () => {
    repo.findOne.mockResolvedValue(makeAssembly());
    const patch = {
      ataPdfUrl: 'https://drive.google.com/file/d/minutes/view',
      notaryRegistry: {
        book: 'Livro sintético',
        page: '10',
        registeredAt: new Date('2026-12-02T12:00:00Z'),
      },
    };

    await expect(service.update('assembly-1', patch, director)).rejects.toThrow(
      ForbiddenException,
    );
    const updated = await service.update('assembly-1', patch, admin);

    expect(updated).toMatchObject({ ataPdfUrl: patch.ataPdfUrl });
    expect(updated).not.toHaveProperty('createdById');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assembly.notary_registered',
        actorId: 'admin-1',
        targetId: 'assembly-1',
      }),
    );
  });

  it('returns not found when updating an unknown assembly', async () => {
    await expect(
      service.update('missing', { title: 'Novo título' }, admin),
    ).rejects.toThrow(NotFoundException);
    expect(txRepo.save).not.toHaveBeenCalled();
  });
});
