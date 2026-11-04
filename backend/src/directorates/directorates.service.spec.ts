import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ILike } from 'typeorm';
import { JwtPayload } from '../auth/jwt.strategy';
import { Directorate } from './entities/directorate.entity';
import { DirectoratesService } from './directorates.service';

const userAdmin = {
  sub: 'admin-1',
  handle: 'admin',
  roles: ['admin'],
} as JwtPayload;

const userDirector = {
  sub: 'member-1',
  handle: 'director',
  roles: ['diretor'],
} as JwtPayload;

describe('DirectoratesService', () => {
  let service: DirectoratesService;
  let repo: Record<string, jest.Mock>;
  let designations: { hasDesignation: jest.Mock };
  let audit: { log: jest.Mock };
  let directorate: Directorate;

  beforeEach(() => {
    directorate = {
      id: 'directorate-1',
      slug: 'tecnologia',
      name: 'Diretoria de Tecnologia',
      description: 'Infraestrutura e projetos',
      isActive: true,
      createdAt: new Date('2026-10-30T12:00:00Z'),
      updatedAt: new Date('2026-10-30T12:00:00Z'),
    };
    repo = {
      find: jest.fn().mockResolvedValue([directorate]),
      findAndCount: jest.fn().mockResolvedValue([[directorate], 101]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => ({ ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    designations = { hasDesignation: jest.fn().mockResolvedValue(false) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new DirectoratesService(repo as any, designations as any, audit as any);
  });

  it('lists only active directorates publicly', async () => {
    await expect(service.listPublic()).resolves.toEqual([directorate]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  });

  it('searches and returns the standard pagination envelope', async () => {
    const result = await service.listManage({
      page: 2,
      limit: 50,
      search: 'tec',
    });

    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: [
        { name: ILike('%tec%') },
        { slug: ILike('%tec%') },
        { description: ILike('%tec%') },
      ],
      order: { name: 'ASC' },
      skip: 50,
      take: 50,
    });
    expect(result).toEqual({
      data: [directorate],
      total: 101,
      page: 2,
      totalPages: 3,
      limit: 50,
    });
  });

  it('caps management pagination at 100 items', async () => {
    const result = await service.listManage({ page: 1, limit: 500 });

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(result.limit).toBe(100);
    expect(result.totalPages).toBe(2);
  });

  it('creates a directorate with a unique slug', async () => {
    const input = {
      slug: 'comunicacao',
      name: 'Diretoria de Comunicação',
      description: 'Comunicação da Associação',
    };

    await expect(service.create(input, userAdmin)).resolves.toMatchObject(input);
    expect(repo.create).toHaveBeenCalledWith(input);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'directorate.created',
        actorId: 'admin-1',
        details: expect.objectContaining({
          after: expect.objectContaining({ slug: 'comunicacao' }),
        }),
      }),
    );
  });

  it('rejects a duplicate slug before creating', async () => {
    repo.findOne.mockResolvedValue(directorate);

    await expect(
      service.create({ slug: 'tecnologia', name: 'Duplicada' }, userAdmin),
    ).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows an admin to edit without a director designation', async () => {
    repo.findOne.mockResolvedValue(directorate);

    await expect(
      service.update('directorate-1', { name: 'Novo nome' }, userAdmin),
    ).resolves.toMatchObject({ name: 'Novo nome' });
    expect(designations.hasDesignation).not.toHaveBeenCalled();
  });

  it('audits isActive changes with actor and before/after snapshots', async () => {
    repo.findOne.mockResolvedValue(directorate);

    await service.update('directorate-1', { isActive: false }, userAdmin);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'directorate.updated',
        actorId: 'admin-1',
        actorHandle: 'admin',
        targetId: 'directorate-1',
        targetType: 'directorate',
        details: expect.objectContaining({
          before: expect.objectContaining({ isActive: true }),
          after: expect.objectContaining({ isActive: false }),
        }),
      }),
    );
  });

  it('allows a director to edit their own directorate', async () => {
    repo.findOne.mockResolvedValue(directorate);
    designations.hasDesignation.mockResolvedValue(true);

    await service.update('directorate-1', { name: 'Novo' }, userDirector);

    expect(designations.hasDesignation).toHaveBeenCalledWith('member-1', {
      targetType: 'directorate',
      targetId: 'directorate-1',
      designation: 'director',
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Novo' }),
    );
  });

  it('allows a director to edit only their own directorate', async () => {
    repo.findOne.mockResolvedValue({
      ...directorate,
      id: 'directorate-2',
      slug: 'outra',
    });
    designations.hasDesignation.mockResolvedValue(false);

    await expect(
      service.update('directorate-2', { name: 'Novo' }, userDirector),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws when editing an unknown directorate', async () => {
    await expect(
      service.update('missing', { name: 'Novo' }, userAdmin),
    ).rejects.toThrow(NotFoundException);
  });
});
