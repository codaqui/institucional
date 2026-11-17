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
  let designationRepo: any;
  let participantsRepo: any;
  let membersRepo: any;

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
    designationRepo = { find: jest.fn().mockResolvedValue([]) };
    participantsRepo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
    };
    membersRepo = {
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
    };
    service = new ProjectsService(
      repo, entities, partnerships, designationRepo, membersRepo, dataSource,
      designations, audit, email, { validateReceiptUrl: jest.fn((url) => url) } as any,
      participantsRepo,
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

  it('allows the principal mentor to finish with only a report URL', async () => {
    const mentor = { sub: 'mentor-1', handle: 'mentor', roles: ['mentor'] } as any;
    designations.hasAnyDesignation.mockResolvedValue(false);
    designations.hasDesignation = jest.fn().mockResolvedValue(true);
    repo.findOne
      .mockResolvedValueOnce({ id: 'project-1', status: 'active', createdById: director.sub })
      .mockResolvedValueOnce({ memberId: mentor.sub, status: 'active' });

    const result = await service.update('project-1', {
      status: 'finished',
      reportDiscussionUrl: 'https://github.com/codaqui/institucional/discussions/42',
    } as any, mentor);

    expect(result).toMatchObject({ status: 'finished', reportDiscussionUrl: expect.stringContaining('/42') });
  });

  it('does not let a mentor change editorial project fields', async () => {
    const mentor = { sub: 'mentor-1', handle: 'mentor', roles: ['mentor'] } as any;
    designations.hasAnyDesignation.mockResolvedValue(false);
    designations.hasDesignation = jest.fn().mockResolvedValue(true);

    await expect(service.update('project-1', { summary: 'Alteração indevida' } as any, mentor))
      .rejects.toThrow('Gestão de projetos requer admin ou diretor ativo.');
  });

  it('enriches the manage page with current mentors in batch', async () => {
    repo.findAndCount.mockResolvedValue([
      [
        { id: 'project-1', name: 'Com mentores' },
        { id: 'project-2', name: 'Sem mentores' },
      ],
      2,
    ]);
    designationRepo.find.mockResolvedValue([
      { targetId: 'project-1', memberId: 'mentor-1' },
    ]);
    participantsRepo.find.mockResolvedValue([
      { projectId: 'project-1', memberId: 'mentor-1', role: 'mentor', leftAt: null },
      { projectId: 'project-1', memberId: 'co-1', role: 'mentor', leftAt: null },
      { projectId: 'project-1', memberId: 'co-2', role: 'mentor', leftAt: null },
    ]);
    membersRepo.findBy.mockResolvedValue([
      { id: 'mentor-1', name: 'Principal', githubHandle: 'principal', avatarUrl: 'principal.png', email: 'private@example.test', isActive: false },
      { id: 'co-1', name: 'Co Um', githubHandle: 'co-um', avatarUrl: 'co-um.png', isActive: true },
      { id: 'co-2', name: 'Co Dois', githubHandle: 'co-dois', avatarUrl: null, isActive: true },
    ]);

    const result = await service.listManage({ page: 1, limit: 50 }, director);

    expect(result.data[0].mentor).toEqual({
      id: 'mentor-1', name: 'Principal', githubHandle: 'principal', avatarUrl: 'principal.png',
    });
    expect(result.data[0].coMentors).toEqual([
      { id: 'co-1', name: 'Co Um', githubHandle: 'co-um', avatarUrl: 'co-um.png' },
      { id: 'co-2', name: 'Co Dois', githubHandle: 'co-dois', avatarUrl: null },
    ]);
    expect(result.data[1].mentor).toBeNull();
    expect(result.data[1].coMentors).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('private@example.test');

    const designationWhere = designationRepo.find.mock.calls[0][0].where;
    expect(designationWhere).toMatchObject({
      targetType: 'extension_project', designation: 'mentor', status: 'active',
    });
    expect(designationWhere.targetId.value).toEqual(['project-1', 'project-2']);
    const participantsWhere = participantsRepo.find.mock.calls[0][0].where;
    expect(participantsWhere).toMatchObject({ role: 'mentor', leftAt: null });
    expect(participantsWhere.projectId.value).toEqual(['project-1', 'project-2']);
    const membersWhere = membersRepo.findBy.mock.calls[0][0];
    expect(membersWhere.id.value).toEqual(['mentor-1', 'co-1', 'co-2']);
    expect(designationRepo.find).toHaveBeenCalledTimes(1);
    expect(participantsRepo.find).toHaveBeenCalledTimes(1);
    expect(membersRepo.findBy).toHaveBeenCalledTimes(1);
  });
});
