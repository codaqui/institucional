import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertProjectTransition } from './project-lifecycle';

const project = {
  id: 'project-1', createdById: 'director-owner', status: 'proposed',
  kind: 'projeto', name: 'Projeto', entityId: 'entity-1', summary: 'Resumo',
  startsAt: '2026-03-10', endsAt: '2026-04-10',
  registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-09',
  odsPrimary: 4, odsSecondary: [], targetCommunity: 'Comunidade',
  justification: 'J', objective: 'O', skillsDeveloped: 'S', methodology: 'PjBL',
  totalHours: 1, schedule: [{ numero: 1, descricao: 'Encontro', carga: 1 }],
  maxParticipants: 5,
} as any;
const otherDirector = { sub: 'other', handle: 'other', roles: ['diretor'] } as any;
const mentorActor = { sub: 'mentor-1', handle: 'mentor', roles: ['mentor'] } as any;
const activeMentor = { memberId: 'mentor-1' } as any;

describe('project-lifecycle', () => {
  it('rejects activation by a director who does not own the project', () => {
    expect(() => assertProjectTransition(project, { status: 'active' }, otherDirector, activeMentor))
      .toThrow(ForbiddenException);
  });

  it('allows the principal mentor to finish with a report', () => {
    expect(() => assertProjectTransition({ ...project, status: 'active' }, {
      status: 'finished',
      reportDiscussionUrl: 'https://github.com/codaqui/institucional/discussions/123',
    }, mentorActor, activeMentor)).not.toThrow();
  });

  it('requires a valid report URL to finish', () => {
    expect(() => assertProjectTransition({ ...project, status: 'active' }, {
      status: 'finished', reportDiscussionUrl: 'https://github.com/codaqui/other/discussions/123',
    }, mentorActor, activeMentor)).toThrow(BadRequestException);
  });
});
