import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ProjectsService } from './projects.service';

const director = {
  sub: 'director-1',
  handle: 'director',
  roles: ['diretor'],
} as any;
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
  let storage: any;

  beforeEach(() => {
    repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'project-1', ...value })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };
    const entity = {
      id: 'entity-1',
      slug: 'codaqui',
      name: 'Associação Codaqui',
      isActive: true,
    };
    entities = {
      findOneBy: jest.fn().mockResolvedValue(entity),
      find: jest.fn().mockResolvedValue([entity]),
    };
    partnerships = { findOneBy: jest.fn() };
    designations = {
      hasAnyDesignation: jest.fn().mockResolvedValue(true),
      grant: jest.fn(async (value) => value),
    };
    dataSource = {
      transaction: jest.fn(async (work) =>
        work({
          getRepository: jest.fn().mockReturnValue(repo),
          query: jest.fn(),
        }),
      ),
    };
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
    storage = { validateReceiptUrl: jest.fn((url) => url) };
    service = new ProjectsService(
      repo,
      entities,
      partnerships,
      designationRepo,
      membersRepo,
      dataSource,
      designations,
      audit,
      email,
      storage as any,
      participantsRepo,
    );
  });

  function mockMentorUpdate(
    project: Record<string, unknown>,
    activeMentor: Record<string, unknown>,
    currentParticipants: Array<Record<string, unknown>>,
  ) {
    repo.findOne.mockResolvedValue(project);
    designationRepo.findOne = jest.fn().mockResolvedValue(activeMentor);
    designationRepo.save = jest.fn(async (value) => value);
    participantsRepo.find.mockResolvedValue(currentParticipants);
    membersRepo.findOneBy.mockImplementation(
      async ({ id }: { id: string }) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        isActive: true,
      }),
    );
    const repositories = {
      ExtensionProject: repo,
      MemberDesignation: designationRepo,
      ProjectParticipant: participantsRepo,
    } as const;
    dataSource.transaction.mockImplementation(
      async (work: (manager: unknown) => unknown) =>
        work({
          getRepository: jest.fn(
            (entity: { name: keyof typeof repositories }) =>
              repositories[entity.name],
          ),
          query: jest.fn(),
        }),
    );
  }

  it('creates a minimal draft with normalized name and slug', async () => {
    const created = await service.create(
      { name: '  Ação   Extensão ', entityId: 'entity-1' } as any,
      director,
    );

    expect(created).toMatchObject({
      slug: 'acao-extensao',
      normalizedName: 'acao extensao',
      status: 'draft',
      createdById: director.sub,
    });
  });

  it('rejects a complete project without a principal mentor', async () => {
    await expect(
      service.create(
        {
          name: 'Projeto',
          entityId: 'entity-1',
          status: 'proposed',
          kind: 'projeto',
          summary: 'Resumo',
          startsAt: '2026-03-10',
          endsAt: '2026-04-10',
          registrationStartsAt: '2026-03-01',
          registrationEndsAt: '2026-03-09',
          odsPrimary: 4,
          targetCommunity: 'Comunidade',
          justification: 'J',
          objective: 'O',
          skillsDeveloped: 'S',
          methodology: 'PjBL',
          totalHours: 1,
          schedule: [{ numero: 1, descricao: 'Encontro', carga: 1 }],
          maxParticipants: 5,
        } as any,
        director,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a director for creation', async () => {
    designations.hasAnyDesignation.mockResolvedValue(false);
    await expect(
      service.create({ name: 'Projeto', entityId: 'entity-1' } as any, member),
    ).rejects.toThrow();
  });

  it('omits private fields from the public projection', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'project-1',
        kind: 'projeto',
        name: 'Projeto',
        slug: 'projeto',
        summary: 'Resumo',
        entityId: 'entity-1',
        createdById: 'private-actor',
        internalNotes: 'secret',
        status: 'active',
        isPublic: true,
      },
    ]);
    designations.hasAnyDesignation.mockResolvedValue(true);

    const result = await service.listPublic();

    expect(result[0]).not.toHaveProperty('internalNotes');
    expect(result[0]).not.toHaveProperty('createdById');
    expect(result[0]).not.toHaveProperty('entityId');
    expect(result[0].entity).toEqual({
      slug: 'codaqui',
      name: 'Associação Codaqui',
    });
  });

  it('allows the principal mentor to finish with only a report URL', async () => {
    const mentor = {
      sub: 'mentor-1',
      handle: 'mentor',
      roles: ['mentor'],
    } as any;
    designations.hasAnyDesignation.mockResolvedValue(false);
    designations.hasDesignation = jest.fn().mockResolvedValue(true);
    repo.findOne
      .mockResolvedValueOnce({
        id: 'project-1',
        status: 'active',
        createdById: director.sub,
      })
      .mockResolvedValueOnce({ memberId: mentor.sub, status: 'active' });

    const result = await service.update(
      'project-1',
      {
        status: 'finished',
        reportDiscussionUrl:
          'https://github.com/codaqui/institucional/discussions/42',
      } as any,
      mentor,
    );

    expect(result).toMatchObject({
      status: 'finished',
      reportDiscussionUrl: expect.stringContaining('/42'),
    });
  });

  it('does not let a mentor change editorial project fields', async () => {
    const mentor = {
      sub: 'mentor-1',
      handle: 'mentor',
      roles: ['mentor'],
    } as any;
    designations.hasAnyDesignation.mockResolvedValue(false);
    designations.hasDesignation = jest.fn().mockResolvedValue(true);

    await expect(
      service.update(
        'project-1',
        { summary: 'Alteração indevida' } as any,
        mentor,
      ),
    ).rejects.toThrow('Gestão de projetos requer admin ou diretor ativo.');
  });

  it('does not rewrite mentors or notify when an edit keeps the same set', async () => {
    mockMentorUpdate(
      {
        id: 'project-1',
        status: 'proposed',
        createdById: director.sub,
        name: 'Projeto',
        summary: 'Antigo',
      },
      { memberId: 'mentor-1', status: 'active' },
      [
        {
          id: 'row-principal',
          memberId: 'mentor-1',
          role: 'mentor',
          leftAt: null,
        },
        { id: 'row-co', memberId: 'co-1', role: 'mentor', leftAt: null },
      ],
    );

    await service.update(
      'project-1',
      {
        summary: 'Novo resumo',
        mentorMemberId: 'mentor-1',
        coMentors: ['co-1'],
      } as any,
      director,
    );

    expect(designations.grant).not.toHaveBeenCalled();
    expect(designationRepo.save).not.toHaveBeenCalled();
    expect(participantsRepo.update).not.toHaveBeenCalled();
    expect(participantsRepo.save).not.toHaveBeenCalled();
    expect(email.sendProjectEmail).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PROJECT_MENTOR_DESIGNATED,
      }),
    );
  });

  it('changes only removed and added co-mentors without notifying the principal', async () => {
    mockMentorUpdate(
      {
        id: 'project-1',
        status: 'proposed',
        createdById: director.sub,
        name: 'Projeto',
      },
      { memberId: 'mentor-1', status: 'active' },
      [
        {
          id: 'row-principal',
          memberId: 'mentor-1',
          role: 'mentor',
          leftAt: null,
        },
        { id: 'row-keep', memberId: 'co-keep', role: 'mentor', leftAt: null },
        {
          id: 'row-remove',
          memberId: 'co-remove',
          role: 'mentor',
          leftAt: null,
        },
      ],
    );

    await service.update(
      'project-1',
      {
        summary: 'Novo resumo',
        mentorMemberId: 'mentor-1',
        coMentors: ['co-keep', 'co-new'],
      } as any,
      director,
    );

    expect(participantsRepo.update).toHaveBeenCalledTimes(1);
    expect(participantsRepo.update).toHaveBeenCalledWith('row-remove', {
      leftAt: expect.any(Date),
    });
    expect(participantsRepo.save).toHaveBeenCalledTimes(1);
    expect(participantsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'co-new' }),
    );
    expect(email.sendProjectEmail).not.toHaveBeenCalled();
  });

  it('replaces the principal with one notification and preserves unchanged co-mentors', async () => {
    mockMentorUpdate(
      {
        id: 'project-1',
        status: 'proposed',
        createdById: director.sub,
        name: 'Projeto',
      },
      { memberId: 'mentor-old', status: 'active' },
      [
        { id: 'row-old', memberId: 'mentor-old', role: 'mentor', leftAt: null },
        { id: 'row-keep', memberId: 'co-keep', role: 'mentor', leftAt: null },
      ],
    );

    await service.update(
      'project-1',
      {
        summary: 'Novo resumo',
        mentorMemberId: 'mentor-new',
        coMentors: ['co-keep'],
      } as any,
      director,
    );

    expect(designationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'mentor-old',
        status: 'ended',
        endedAt: expect.any(Date),
      }),
    );
    expect(designations.grant).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'mentor-new' }),
      expect.anything(),
    );
    expect(participantsRepo.update).toHaveBeenCalledWith('row-old', {
      leftAt: expect.any(Date),
    });
    expect(participantsRepo.save).toHaveBeenCalledTimes(1);
    expect(participantsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'mentor-new' }),
    );
    expect(email.sendProjectEmail).toHaveBeenCalledTimes(1);
    expect(email.sendProjectEmail).toHaveBeenCalledWith(
      expect.objectContaining({ memberName: 'mentor-new' }),
    );
  });

  it('returns 400 with the storage message when an attachment host is rejected', async () => {
    storage.validateReceiptUrl.mockImplementation(() => {
      throw new Error('URL de comprovante fora da allowlist.');
    });

    await expect(
      service.create(
        {
          name: 'Projeto',
          entityId: 'entity-1',
          attachments: ['https://blocked.example/file'],
        } as any,
        director,
      ),
    ).rejects.toThrow(
      new BadRequestException('URL de comprovante fora da allowlist.'),
    );
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
      {
        projectId: 'project-1',
        memberId: 'mentor-1',
        role: 'mentor',
        leftAt: null,
      },
      {
        projectId: 'project-1',
        memberId: 'co-1',
        role: 'mentor',
        leftAt: null,
      },
      {
        projectId: 'project-1',
        memberId: 'co-2',
        role: 'mentor',
        leftAt: null,
      },
    ]);
    membersRepo.findBy.mockResolvedValue([
      {
        id: 'mentor-1',
        name: 'Principal',
        githubHandle: 'principal',
        avatarUrl: 'principal.png',
        email: 'private@example.test',
        isActive: false,
      },
      {
        id: 'co-1',
        name: 'Co Um',
        githubHandle: 'co-um',
        avatarUrl: 'co-um.png',
        isActive: true,
      },
      {
        id: 'co-2',
        name: 'Co Dois',
        githubHandle: 'co-dois',
        avatarUrl: null,
        isActive: true,
      },
    ]);

    const result = await service.listManage({ page: 1, limit: 50 }, director);

    expect(result.data[0].mentor).toEqual({
      id: 'mentor-1',
      name: 'Principal',
      githubHandle: 'principal',
      avatarUrl: 'principal.png',
    });
    expect(result.data[0].coMentors).toEqual([
      {
        id: 'co-1',
        name: 'Co Um',
        githubHandle: 'co-um',
        avatarUrl: 'co-um.png',
      },
      { id: 'co-2', name: 'Co Dois', githubHandle: 'co-dois', avatarUrl: null },
    ]);
    expect(result.data[1].mentor).toBeNull();
    expect(result.data[1].coMentors).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('private@example.test');

    const designationWhere = designationRepo.find.mock.calls[0][0].where;
    expect(designationWhere).toMatchObject({
      targetType: 'extension_project',
      designation: 'mentor',
      status: 'active',
    });
    expect(designationWhere.targetId.value).toEqual(['project-1', 'project-2']);
    const participantsWhere = participantsRepo.find.mock.calls[0][0].where;
    expect(participantsWhere).toMatchObject({
      role: 'mentor',
      leftAt: IsNull(),
    });
    expect(participantsWhere.projectId.value).toEqual([
      'project-1',
      'project-2',
    ]);
    const membersWhere = membersRepo.findBy.mock.calls[0][0];
    expect(membersWhere.id.value).toEqual(['mentor-1', 'co-1', 'co-2']);
    expect(designationRepo.find).toHaveBeenCalledTimes(1);
    expect(participantsRepo.find).toHaveBeenCalledTimes(1);
    expect(membersRepo.findBy).toHaveBeenCalledTimes(1);
  });
});
