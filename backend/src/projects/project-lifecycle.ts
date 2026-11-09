import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertDiscussionUrl } from '../common/discussion-url';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { MemberRole } from '../members/entities/member.entity';
import { assertProjectComplete } from './project.rules';

interface ProjectActor {
  sub: string;
  roles?: string[];
}

export function assertProjectTransition(
  project: any,
  patch: any,
  actor: ProjectActor,
  activeMentor: MemberDesignation | null,
): void {
  const nextStatus = patch.status ?? project.status;
  if (nextStatus === project.status) return;

  if (nextStatus === 'proposed') {
    if (project.status !== 'draft') {
      throw new BadRequestException(`Transição de status inválida: ${project.status} -> ${nextStatus}`);
    }
    return;
  }
  if (!['active', 'finished', 'canceled'].includes(nextStatus)) {
    throw new BadRequestException(`Transição de status inválida: ${project.status} -> ${nextStatus}`);
  }
  if (project.status === 'finished' || project.status === 'canceled') {
    throw new BadRequestException('Projetos finalizados ou cancelados são terminais.');
  }
  if (nextStatus === 'active' && project.status !== 'proposed') {
    throw new BadRequestException('Somente um projeto proposto pode ser ativado.');
  }
  if (nextStatus === 'finished' && project.status !== 'active') {
    throw new BadRequestException('Somente um projeto ativo pode ser finalizado.');
  }
  if (nextStatus === 'canceled' && !['draft', 'proposed', 'active'].includes(project.status)) {
    throw new BadRequestException('Este projeto não pode ser cancelado.');
  }

  const isAdmin = actor.roles?.includes(MemberRole.ADMIN);
  const isOwnerDirector = actor.sub === project.createdById && actor.roles?.includes(MemberRole.DIRETOR);
  const isPrincipalMentor = activeMentor?.memberId === actor.sub;

  if (nextStatus === 'active' || nextStatus === 'canceled') {
    if (!isAdmin && !isOwnerDirector) {
      throw new ForbiddenException('A transição exige admin ou o diretor criador do projeto.');
    }
  }
  if (nextStatus === 'finished' && !isAdmin && !isOwnerDirector && !isPrincipalMentor) {
    throw new ForbiddenException('A finalização exige admin, diretor criador ou mentor principal.');
  }
  if (nextStatus === 'active') {
    assertProjectComplete({ ...project, ...patch, mentorMemberId: patch.mentorMemberId ?? activeMentor?.memberId });
  }
  if (nextStatus === 'finished') {
    assertDiscussionUrl(patch.reportDiscussionUrl ?? project.reportDiscussionUrl);
  }
}
