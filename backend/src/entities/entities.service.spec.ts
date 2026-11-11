import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntitiesService } from './entities.service';

const adminActor = { sub: 'admin-1', handle: 'admin', roles: ['admin'] } as any;
const directorActor = { sub: 'director-1', handle: 'director', roles: ['diretor'] } as any;
const memberActor = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;
const baseEntity = { name: '  Associação Codaqui ', type: 'ong' } as any;

describe('EntitiesService', () => {
  let service: EntitiesService;
  let repo: any;
  let partnerships: any;
  let designations: any;
  let audit: any;

  beforeEach(() => {
    repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'entity-1', ...value })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOneBy: jest.fn(),
    };
    partnerships = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'partnership-1', ...value })),
      find: jest.fn(),
      findOneBy: jest.fn(),
    };
    designations = { hasAnyDesignation: jest.fn().mockResolvedValue(true) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new EntitiesService(repo, partnerships, designations, audit);
  });

  it('requires an active director to create an entity', async () => {
    designations.hasAnyDesignation.mockResolvedValue(false);

    await expect(service.create(baseEntity, memberActor)).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('derives a unique public slug and audits creation', async () => {
    const created = await service.create(baseEntity, directorActor);

    expect(created.slug).toBe('associacao-codaqui');
    expect(created.registeredById).toBe(directorActor.sub);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'entity.created' }));
  });

  it('rejects IES creation through the generic entity CRUD', async () => {
    await expect(service.create({
      name: 'IES Exemplo',
      type: 'instituicao_ensino',
    } as any, adminActor)).rejects.toThrow(BadRequestException);
    await expect(service.create({
      name: 'IES Exemplo',
      type: 'instituicao_ensino',
    } as any, adminActor)).rejects.toThrow('/admin/universitario');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects changing an existing IES type through the generic entity CRUD', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'ies-1', name: 'IES Exemplo', type: 'instituicao_ensino' });

    await expect(service.update('ies-1', { type: 'ong' } as any, adminActor))
      .rejects.toThrow('/admin/universitario');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects converting another entity into an IES through the generic entity CRUD', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'entity-1', name: 'Entidade', type: 'ong' });

    await expect(service.update('entity-1', { type: 'instituicao_ensino' } as any, adminActor))
      .rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('preserves generic updates that do not change an IES type', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'ies-1', name: 'IES Exemplo', type: 'instituicao_ensino' });

    await expect(service.update('ies-1', {
      name: 'IES Atualizada',
      type: 'instituicao_ensino',
    } as any, adminActor)).resolves.toMatchObject({ name: 'IES Atualizada', type: 'instituicao_ensino' });
  });

  it('preserves type changes between non-IES entities', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'entity-1', name: 'Entidade', type: 'ong' });

    await expect(service.update('entity-1', { type: 'governo' } as any, adminActor))
      .resolves.toMatchObject({ id: 'entity-1', type: 'governo' });
  });

  it('returns only public entity fields', async () => {
    repo.find.mockResolvedValue([{
      id: 'entity-1', slug: 'codaqui', name: 'Associação Codaqui', type: 'ong',
      website: 'https://codaqui.dev', contactEmail: 'private@example.test',
      registeredById: 'private-actor', isActive: true,
    }]);

    const result = await service.listPublic();

    expect(result).toEqual([{
      id: 'entity-1', slug: 'codaqui', name: 'Associação Codaqui', type: 'ong',
      website: 'https://codaqui.dev',
    }]);
    expect(result[0]).not.toHaveProperty('contactEmail');
    expect(result[0]).not.toHaveProperty('registeredById');
  });

  it('rejects a partnership for an inactive entity', async () => {
    repo.findOneBy.mockResolvedValue(null);

    await expect(service.createPartnership('missing', {
      kind: 'termo', startedAt: '2026-01-01', status: 'active',
    } as any, adminActor)).rejects.toThrow(NotFoundException);
  });
});
