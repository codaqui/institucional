import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { Member, MemberRole } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';
import { ExtensionProject } from './entities/extension-project.entity';
import { ProjectParticipant } from './entities/project-participant.entity';

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectRepository(ExtensionProject)
    private readonly projects: Repository<ExtensionProject>,
    @InjectRepository(ProjectParticipant)
    private readonly participants: Repository<ProjectParticipant>,
    @InjectRepository(Member)
    private readonly members: Repository<Member>,
    private readonly dataSource: DataSource,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    @Optional()
    private readonly now: () => Date = () => new Date(),
  ) {}

  async join(projectId: string, actor: JwtPayload): Promise<ProjectParticipant> {
    const participation = await this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ExtensionProject).findOne({
        where: { id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      const today = this.now().toISOString().slice(0, 10);
      if (project.status !== 'active' || today < project.registrationStartsAt! || today > project.registrationEndsAt!) {
        throw new ConflictException('O projeto está fora da janela de inscrição.');
      }
      const repo = manager.getRepository(ProjectParticipant);
      const existing = await repo.findOne({ where: { projectId, memberId: actor.sub, leftAt: IsNull() } });
      if (existing?.role === 'mentor' && existing.leftAt === null) {
        throw new ConflictException('Mentores não ocupam vaga de participante.');
      }
      if (existing?.leftAt === null) {
        throw new ConflictException('O membro já está inscrito neste projeto.');
      }
      const count = await repo.count({ where: { projectId, role: 'participant', leftAt: IsNull() } });
      if (project.maxParticipants! > 0 && count >= project.maxParticipants!) {
        throw new ConflictException('Vagas esgotadas.');
      }
      const previous = await repo.findOne({ where: { projectId, memberId: actor.sub } });
      if (previous) {
        previous.leftAt = null;
        previous.joinedAt = this.now();
        return repo.save(previous);
      }
      return repo.save(repo.create({ projectId, memberId: actor.sub, role: 'participant', joinedAt: this.now(), leftAt: null }));
    });
    await this.audit.log({
      action: AuditAction.PROJECT_PARTICIPANT_JOINED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: projectId,
      targetType: 'extension_project',
      details: { memberId: actor.sub },
    });
    const member = await this.members.findOneBy({ id: actor.sub });
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (member && project) {
      await this.email.sendProjectEmail({
        template: 'project_registration_confirmed',
        to: member.email,
        memberName: member.name,
        projectName: project.name,
        projectId,
      });
    }
    return participation;
  }

  async leave(projectId: string, actor: JwtPayload): Promise<ProjectParticipant | null> {
    const participation = await this.participants.findOne({
      where: { projectId, memberId: actor.sub, role: 'participant', leftAt: IsNull() },
    });
    if (!participation) return null;
    participation.leftAt = this.now();
    return this.participants.save(participation);
  }

  async remove(projectId: string, memberId: string, actor: JwtPayload): Promise<ProjectParticipant> {
    await this.assertDirector(actor);
    const participation = await this.participants.findOne({
      where: { projectId, memberId, role: 'participant', leftAt: IsNull() },
    });
    if (!participation) throw new NotFoundException('Inscrição ativa não encontrada.');
    participation.leftAt = this.now();
    const updated = await this.participants.save(participation);
    await this.audit.log({
      action: AuditAction.PROJECT_PARTICIPANT_REMOVED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: projectId,
      targetType: 'extension_project',
      details: { memberId },
    });
    return updated;
  }

  async listParticipants(projectId: string, actor: JwtPayload) {
    const isMentor = await this.designations.hasDesignation(actor.sub, {
      targetType: 'extension_project', targetId: projectId, designation: 'mentor',
    });
    if (!actor.roles?.includes(MemberRole.ADMIN) && !isMentor) {
      throw new ForbiddenException('Somente o mentor principal pode listar participantes.');
    }
    const [participations, members] = await Promise.all([
      this.participants.find({ where: { projectId, leftAt: IsNull() }, order: { joinedAt: 'ASC' } }),
      this.members.find(),
    ]);
    const memberMap = new Map(members.map((member) => [member.id, member]));
    return participations.map((participation) => ({
      id: participation.id,
      memberId: participation.memberId,
      role: participation.role,
      member: {
        name: memberMap.get(participation.memberId)?.name ?? 'Membro',
        handle: memberMap.get(participation.memberId)?.githubHandle ?? 'membro',
      },
    }));
  }

  async myProjects(actor: JwtPayload) {
    const [participations, projects] = await Promise.all([
      this.participants.find({ where: { memberId: actor.sub, leftAt: IsNull() }, order: { joinedAt: 'DESC' } }),
      this.projects.find(),
    ]);
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    return participations.map((participation) => {
      const project = projectMap.get(participation.projectId);
      return {
        projectId: participation.projectId,
        projectSlug: project?.slug ?? null,
        projectName: project?.name ?? 'Projeto',
        role: participation.role,
        status: project?.status ?? null,
        reportDiscussionUrl: project?.reportDiscussionUrl ?? null,
        joinedAt: participation.joinedAt,
      };
    });
  }

  private async assertDirector(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasAnyDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!allowed) throw new ForbiddenException('Remoção de participantes requer admin ou diretor ativo.');
  }
}
