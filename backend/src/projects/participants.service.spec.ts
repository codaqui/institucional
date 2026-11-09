import { ConflictException } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { ExtensionProject } from './entities/extension-project.entity';

const member = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;
const director = { sub: 'director-1', handle: 'director', roles: ['diretor'] } as any;
const project = {
  id: 'project-1', name: 'Projeto', slug: 'projeto', status: 'active', maxParticipants: 1,
  registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-10',
} as any;

describe('ParticipantsService', () => {
  let service: ParticipantsService;
  let projects: any;
  let participants: any;
  let members: any;
  let dataSource: any;
  let audit: any;
  let designations: any;
  let email: any;

  beforeEach(() => {
    projects = { findOne: jest.fn().mockResolvedValue(project), find: jest.fn().mockResolvedValue([project]) };
    participants = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      update: jest.fn(),
    };
    members = { findOneBy: jest.fn().mockResolvedValue({ id: member.sub, name: 'Membro', email: 'member@example.test' }) };
    dataSource = { transaction: jest.fn(async (work) => work({
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === ExtensionProject) return projects;
        return participants;
      }),
    })) };
    audit = { log: jest.fn() };
    designations = { hasAnyDesignation: jest.fn().mockResolvedValue(true) };
    email = { sendProjectEmail: jest.fn() };
    service = new ParticipantsService(
      projects, participants, members, dataSource, designations, audit, email,
      () => new Date('2026-03-05T12:00:00Z'),
    );
  });

  it('rejects joining a full project', async () => {
    participants.count.mockResolvedValue(1);
    await expect(service.join(project.id, member)).rejects.toThrow(ConflictException);
  });

  it('rejects duplicate active membership', async () => {
    participants.findOne.mockResolvedValue({ id: 'participation-1', leftAt: null });
    await expect(service.join(project.id, member)).rejects.toThrow(ConflictException);
  });

  it('allows leaving and joining again', async () => {
    const created = await service.join(project.id, member);
    expect(created.leftAt).toBeNull();

    participants.findOne.mockResolvedValue({ id: 'participation-1', role: 'participant', leftAt: null });
    await service.leave(project.id, member);
    expect(participants.save).toHaveBeenCalledWith(expect.objectContaining({ leftAt: expect.any(Date) }));

    participants.findOne.mockResolvedValue({ id: 'participation-1', role: 'participant', leftAt: new Date() });
    const rejoined = await service.join(project.id, member);
    expect(rejoined.leftAt).toBeNull();
  });

  it('rejects a mentor taking a participant slot', async () => {
    participants.findOne.mockResolvedValue({ id: 'mentor-row', role: 'mentor', leftAt: null });
    await expect(service.join(project.id, member)).rejects.toThrow(ConflictException);
  });

  it('lets a director remove a participant with audit', async () => {
    participants.findOne.mockResolvedValue({ id: 'participation-1', role: 'participant', leftAt: null });
    await service.remove(project.id, member.sub, director);

    expect(participants.save).toHaveBeenCalledWith(expect.objectContaining({ leftAt: expect.any(Date) }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.participant_removed' }));
  });

  it('lists participants with public member labels for the principal mentor', async () => {
    designations.hasDesignation = jest.fn().mockResolvedValue(true);
    participants.find.mockResolvedValue([{ id: 'participation-1', memberId: member.sub, role: 'participant' }]);
    members.find = jest.fn().mockResolvedValue([{ id: member.sub, name: 'Membro', githubHandle: 'member' }]);

    const result = await service.listParticipants(project.id, director);

    expect(result).toEqual([{ id: 'participation-1', memberId: member.sub, role: 'participant', member: { name: 'Membro', handle: 'member' } }]);
  });

  it('includes project lifecycle and report in own memberships', async () => {
    participants.find.mockResolvedValue([{ projectId: project.id, role: 'mentor', joinedAt: new Date('2026-03-01') }]);
    projects.find.mockResolvedValue([{ ...project, status: 'finished', reportDiscussionUrl: 'https://github.com/codaqui/institucional/discussions/42' }]);

    const result = await service.myProjects(member);

    expect(result[0]).toMatchObject({
      projectId: project.id,
      role: 'mentor',
      status: 'finished',
      reportDiscussionUrl: 'https://github.com/codaqui/institucional/discussions/42',
    });
  });
});
