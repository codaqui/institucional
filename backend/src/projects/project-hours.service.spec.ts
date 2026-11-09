import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HourEntrySource, HourEntryStatus } from '../hours/entities/hour-entry.entity';
import { HoursService } from '../hours/hours.service';

const mentor = { sub: 'mentor-1', handle: 'mentor', roles: ['mentor'] } as any;
const participant = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;
const dto = { memberId: participant.sub, hours: 2, occurredAt: '2026-03-05', description: 'Encontro', idempotencyKey: 'hour-1' } as any;
const project = { id: 'project-1', name: 'Projeto', status: 'active', totalHours: 3 } as any;

describe('HoursService — extension projects', () => {
  let service: HoursService;
  let hourRepo: any;
  let projects: any;
  let participants: any;
  let designations: any;
  let audit: any;
  let email: any;

  beforeEach(() => {
    hourRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'hour-1', ...value })),
      sum: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneByOrFail: jest.fn(),
      findOneBy: jest.fn(),
    };
    projects = { findOne: jest.fn().mockResolvedValue(project) };
    participants = { findOne: jest.fn().mockResolvedValue({ id: 'participation-1', role: 'participant', leftAt: null }) };
    designations = { findOne: jest.fn().mockResolvedValue({ memberId: mentor.sub }) };
    audit = { log: jest.fn() };
    email = { sendProjectEmail: jest.fn() };
    const dataSource = { transaction: jest.fn(async (work) => work({
      getRepository: jest.fn().mockImplementation((entity) => {
        const name = typeof entity === 'function' ? entity.name : '';
        if (name === 'ExtensionProject') return projects;
        if (name === 'ProjectParticipant') return participants;
        if (name === 'MemberDesignation') return designations;
        return hourRepo;
      }),
    })) };
    const membersRepo = { findOneBy: jest.fn().mockResolvedValue({ id: participant.sub, name: 'Membro', email: 'member@example.test' }) };
    service = new HoursService(
      hourRepo, membersRepo, { hasDesignation: jest.fn() } as any, audit, {} as any,
      dataSource, projects, participants, email,
    );
  });

  it('creates a pending entry for a participant', async () => {
    const result = await service.recordExtensionProjectEntry(project.id, dto, mentor);

    expect(result).toMatchObject({ sourceType: HourEntrySource.EXTENSION_PROJECT, status: HourEntryStatus.PENDING, reportedById: mentor.sub });
  });

  it('deduplicates by member and idempotency key', async () => {
    hourRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.recordExtensionProjectEntry(project.id, dto, mentor)).rejects.toThrow(ConflictException);
  });

  it('rejects hours above the project total', async () => {
    hourRepo.sum.mockResolvedValue(2);
    await expect(service.recordExtensionProjectEntry(project.id, dto, mentor)).rejects.toThrow(ConflictException);
  });

  it('rejects a co-mentor without principal designation', async () => {
    designations.findOne.mockResolvedValue(null);
    await expect(service.recordExtensionProjectEntry(project.id, dto, mentor)).rejects.toThrow(ForbiddenException);
  });

  it('allows the principal mentor to record their own hours', async () => {
    participants.findOne.mockResolvedValue({ id: 'mentor-row', role: 'mentor', leftAt: null });
    const result = await service.recordExtensionProjectEntry(project.id, { ...dto, memberId: mentor.sub }, mentor);

    expect(result.memberId).toBe(mentor.sub);
  });

  it('edits only pending entries and notifies review decisions', async () => {
    const entry = {
      id: 'hour-1', memberId: participant.sub, sourceType: 'extension_project', sourceId: project.id,
      sourceLabel: project.name, hours: 1, description: 'Encontro', occurredAt: new Date('2026-03-05'), status: 'pending', reportedById: mentor.sub,
    };
    hourRepo.findOneByOrFail.mockResolvedValue(entry);
    hourRepo.findOneBy.mockResolvedValue(entry);
    const admin = { sub: 'admin-1', handle: 'admin', roles: ['admin'] } as any;
    await service.approve('hour-1', admin);

    expect(email.sendProjectEmail).toHaveBeenCalledWith(expect.objectContaining({ template: 'project_hours_approved', hours: 1 }));
  });
});
