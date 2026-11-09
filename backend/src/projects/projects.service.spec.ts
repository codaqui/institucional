import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const director = { sub: 'director-1', handle: 'director', roles: ['diretor'] } as any;
const member = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: any;
  let entities: any;
  let partnerships: any;
  let designations: any;
  let dataSource: any;
  let audit: any;
  let email: any;

  beforeEach(() => {
    repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'project-1', ...value })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };
    const entity = { id: 'entity-1', slug: 'codaqui', name: 'Associação Codaqui', isActive: true };
    entities = { findOneBy: jest.fn().mockResolvedValue(entity), find: jest.fn().mockResolvedValue([entity]) };
    partnerships = { findOneBy: jest.fn() };
    designations = {
      hasAnyDesignation: jest.fn().mockResolvedValue(true),
      grant: jest.fn(async (value) => value),
    };
    dataSource = { transaction: jest.fn(async (work) => work({
      getRepository: jest.fn().mockReturnValue(repo),
      query: jest.fn(),
    })) };
    audit = { log: jest.fn() };
    email = { sendProjectEmail: jest.fn() };
    const designationRepo = { find: jest.fn().mockResolvedValue([]) };
    const membersRepo = { find: jest.fn().mockResolvedValue([]), findOneBy: jest.fn() };
    service = new ProjectsService(
      repo, entities, partnerships, designationRepo, membersRepo, dataSource,
      designations, audit, email, { validateReceiptUrl: jest.fn((url) => url) } as any,
    );
  });

  it('creates a minimal draft with normalized name and slug', async () => {
    const created = await service.create({ name: '  Ação   Extensão ', entityId: 'entity-1' } as any, director);

    expect(created).toMatchObject({ slug: 'acao-extensao', normalizedName: 'acao extensao', status: 'draft', createdById: director.sub });
  });

  it('rejects a complete project without a principal mentor', async () => {
    await expect(service.create({
      name: 'Projeto', entityId: 'entity-1', status: 'proposed', kind: 'projeto', summary: 'Resumo',
      startsAt: '2026-03-10', endsAt: '2026-04-10', registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-09',
      odsPrimary: 4, targetCommunity: 'Comunidade', justification: 'J', objective: 'O', skillsDeveloped: 'S', methodology: 'PjBL',
      totalHours: 1, schedule: [{ numero: 1, descricao: 'Encontro', carga: 1 }], maxParticipants: 5,
    } as any, director)).rejects.toThrow(BadRequestException);
  });

  it('requires a director for creation', async () => {
    designations.hasAnyDesignation.mockResolvedValue(false);
    await expect(service.create({ name: 'Projeto', entityId: 'entity-1' } as any, member)).rejects.toThrow();
  });

  it('omits private fields from the public projection', async () => {
    repo.find.mockResolvedValue([{
      id: 'project-1', kind: 'projeto', name: 'Projeto', slug: 'projeto', summary: 'Resumo',
      entityId: 'entity-1', createdById: 'private-actor', internalNotes: 'secret', status: 'active', isPublic: true,
    }]);
    designations.hasAnyDesignation.mockResolvedValue(true);

    const result = await service.listPublic();

    expect(result[0]).not.toHaveProperty('internalNotes');
    expect(result[0]).not.toHaveProperty('createdById');
    expect(result[0]).not.toHaveProperty('entityId');
    expect(result[0].entity).toEqual({ slug: 'codaqui', name: 'Associação Codaqui' });
  });
});
