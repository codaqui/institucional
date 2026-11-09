import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProjectCertificatesService } from './project-certificates.service';

const member = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;
const other = { sub: 'other-1', handle: 'other', roles: ['membro'] } as any;
const project = { id: 'project-1', name: 'Projeto', status: 'finished' } as any;

describe('ProjectCertificatesService', () => {
  let service: ProjectCertificatesService;
  let repo: any;
  let projects: any;
  let hours: any;
  let members: any;
  let designations: any;
  let audit: any;
  let email: any;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    projects = { findOne: jest.fn().mockResolvedValue(project) };
    hours = { sum: jest.fn().mockResolvedValue(2) };
    members = { findOneBy: jest.fn().mockResolvedValue({ id: member.sub, name: 'Membro', email: 'member@example.test' }) };
    designations = { findOne: jest.fn().mockResolvedValue({ memberId: 'mentor-1' }) };
    audit = { log: jest.fn() };
    email = { sendProjectEmail: jest.fn() };
    const participants = { findOne: jest.fn().mockResolvedValue({ id: 'participation-1', role: 'participant' }) };
    service = new ProjectCertificatesService(repo, projects, hours, participants, members, designations, audit, email);
  });

  it('reissues the same code and hours for a participant', async () => {
    const first = await service.issue(project.id, 'participant', member);
    repo.findOne.mockResolvedValue(first);
    const second = await service.issue(project.id, 'participant', member);

    expect(second.code).toBe(first.code);
    expect(second.hoursAtIssue).toBe(first.hoursAtIssue);
    expect(email.sendProjectEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects an unfinished project', async () => {
    projects.findOne.mockResolvedValue({ ...project, status: 'active' });
    await expect(service.issue(project.id, 'participant', member)).rejects.toThrow(ConflictException);
  });

  it('rejects a participant without approved hours', async () => {
    hours.sum.mockResolvedValue(0);
    await expect(service.issue(project.id, 'participant', member)).rejects.toThrow(ConflictException);
  });

  it('rejects another member reading the certificate', async () => {
    repo.findOne.mockResolvedValue({ code: 'PRJ-1', memberId: member.sub });
    await expect(service.owned('PRJ-1', other)).rejects.toThrow(ForbiddenException);
  });

  it('verifies only public certificate data', async () => {
    repo.findOne.mockResolvedValue({
      code: 'PRJ-1', kind: 'participant', memberId: member.sub, projectId: project.id,
      hoursAtIssue: 2, issuedAt: new Date('2026-03-10'),
    });

    const result = await service.verify('PRJ-1');

    expect(result).toMatchObject({ valid: true, memberName: 'Membro', projectName: 'Projeto', hoursAtIssue: 2 });
    expect(result).not.toHaveProperty('memberId');
    expect(result).not.toHaveProperty('projectId');
  });
});
