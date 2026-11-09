import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { HourEntry, HourEntrySource, HourEntryStatus } from '../hours/entities/hour-entry.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';
import { ExtensionProject } from './entities/extension-project.entity';
import { ProjectCertificate, ProjectCertificateKind } from './entities/project-certificate.entity';
import { ProjectParticipant } from './entities/project-participant.entity';

@Injectable()
export class ProjectCertificatesService {
  constructor(
    @InjectRepository(ProjectCertificate)
    private readonly repo: Repository<ProjectCertificate>,
    @InjectRepository(ExtensionProject)
    private readonly projects: Repository<ExtensionProject>,
    @InjectRepository(HourEntry)
    private readonly hours: Repository<HourEntry>,
    @InjectRepository(ProjectParticipant)
    private readonly participants: Repository<ProjectParticipant>,
    @InjectRepository(Member)
    private readonly members: Repository<Member>,
    @InjectRepository(MemberDesignation)
    private readonly designations: Repository<MemberDesignation>,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async issue(projectId: string, kind: ProjectCertificateKind, actor: JwtPayload): Promise<ProjectCertificate> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    if (project.status !== 'finished') {
      throw new ConflictException('Comprovantes só podem ser emitidos para projetos finalizados.');
    }
    const memberId = kind === 'mentor_report'
      ? await this.principalMentorId(projectId, actor)
      : actor.sub;
    await this.assertParticipant(projectId, memberId);
    const existing = await this.repo.findOne({ where: { projectId, memberId, kind } });
    if (existing) return existing;

    const hoursAtIssue = kind === 'mentor_report'
      ? await this.approvedHours(projectId)
      : await this.approvedHours(projectId, memberId);
    if (kind === 'participant' && hoursAtIssue <= 0) {
      throw new ConflictException('A declaração exige horas aprovadas no projeto.');
    }
    try {
      const certificate = await this.repo.save(this.repo.create({
        projectId,
        memberId,
        kind,
        code: `PRJ-${randomUUID()}`,
        hoursAtIssue,
        issuedAt: new Date(),
        createdById: actor.sub,
      }));
      await this.audit.log({
        action: AuditAction.PROJECT_CERTIFICATE_ISSUED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: certificate.id,
        targetType: 'project_certificate',
        details: { projectId, memberId, kind, hoursAtIssue },
      });
      const member = await this.members.findOneBy({ id: memberId });
      if (member) {
        await this.email.sendProjectEmail({
          template: 'project_finished',
          to: member.email,
          memberName: member.name,
          projectName: project.name,
          projectId,
          hours: hoursAtIssue,
        });
      }
      return certificate;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const existing = await this.repo.findOne({ where: { projectId, memberId, kind } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async verify(code: string) {
    const certificate = await this.repo.findOne({ where: { code } });
    if (!certificate) throw new NotFoundException('Comprovante não encontrado.');
    const [project, member] = await Promise.all([
      this.projects.findOne({ where: { id: certificate.projectId } }),
      this.members.findOneBy({ id: certificate.memberId }),
    ]);
    return {
      valid: true,
      kind: certificate.kind,
      memberName: member?.name ?? 'Titular',
      projectName: project?.name ?? 'Projeto',
      hoursAtIssue: certificate.hoursAtIssue,
      issuedAt: certificate.issuedAt,
    };
  }

  async owned(code: string, actor: JwtPayload) {
    const certificate = await this.repo.findOne({ where: { code } });
    if (!certificate) throw new NotFoundException('Comprovante não encontrado.');
    if (certificate.memberId !== actor.sub) {
      throw new ForbiddenException('Somente o titular pode acessar este comprovante.');
    }
    return this.verify(code);
  }

  private async approvedHours(projectId: string, memberId?: string): Promise<number> {
    const total = await this.hours.sum('hours', {
      sourceType: HourEntrySource.EXTENSION_PROJECT,
      sourceId: projectId,
      status: HourEntryStatus.APPROVED,
      ...(memberId ? { memberId } : {}),
    });
    return Number(total ?? 0);
  }

  private async principalMentorId(projectId: string, actor: JwtPayload): Promise<string> {
    const designation = await this.designations.findOne({
      where: { targetType: 'extension_project', targetId: projectId, designation: 'mentor', status: 'active' },
    });
    if (!designation) throw new ConflictException('O projeto não possui mentor principal ativo.');
    if (!actor.roles?.includes(MemberRole.ADMIN) && actor.sub !== designation.memberId) {
      throw new ForbiddenException('Somente o mentor principal pode emitir o comprovante de relatório.');
    }
    return designation.memberId;
  }

  private async assertParticipant(projectId: string, memberId: string): Promise<void> {
    const participant = await this.participants.findOne({
      where: { projectId, memberId, role: In(['participant', 'mentor']) },
    });
    if (!participant) throw new ForbiddenException('O titular não possui vínculo com este projeto.');
  }
}
