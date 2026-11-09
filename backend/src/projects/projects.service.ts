import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Institution } from '../entities/entities/institution.entity';
import { Partnership } from '../entities/entities/partnership.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { Member, MemberRole } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { ExtensionProject } from './entities/extension-project.entity';
import { ProjectParticipant } from './entities/project-participant.entity';
import { assertProjectTransition } from './project-lifecycle';
import { assertProjectComplete, normalizeProjectName, projectSlug } from './project.rules';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ExtensionProject)
    private readonly repo: Repository<ExtensionProject>,
    @InjectRepository(Institution)
    private readonly entities: Repository<Institution>,
    @InjectRepository(Partnership)
    private readonly partnerships: Repository<Partnership>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    private readonly dataSource: DataSource,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateProjectDto, actor: JwtPayload): Promise<ExtensionProject> {
    await this.assertDirector(actor);
    await this.assertRelations(dto.entityId, dto.partnershipId);
    this.assertAttachments(dto.attachments ?? []);
    const status = dto.status ?? 'draft';
    if (status === 'proposed') assertProjectComplete(dto as any);

    const created = await this.dataSource.transaction(async (manager) => {
      const { mentorMemberId, coMentors, ...fields } = dto;
      const project = manager.getRepository(ExtensionProject).create({
        ...fields,
        status,
        normalizedName: normalizeProjectName(dto.name),
        slug: projectSlug(dto.name),
        createdById: actor.sub,
        isPublic: dto.isPublic ?? true,
        odsSecondary: dto.odsSecondary ?? [],
        supportPartners: dto.supportPartners ?? [],
        attachments: dto.attachments ?? [],
      });
      const saved = await manager.getRepository(ExtensionProject).save(project);
      if (mentorMemberId) {
        await this.syncMentorAndCoMentors(manager, saved, mentorMemberId, coMentors ?? [], actor);
      }
      return saved;
    });
    await this.audit.log({
      action: AuditAction.PROJECT_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: created.id,
      targetType: 'extension_project',
      details: { after: { ...created } },
    });
    if (dto.mentorMemberId) await this.notifyMentor(dto.mentorMemberId, created);
    return created;
  }

  async update(id: string, dto: UpdateProjectDto, actor: JwtPayload): Promise<ExtensionProject> {
    await this.assertDirector(actor);
    const updated = await this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ExtensionProject).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      if (dto.entityId && dto.entityId !== project.entityId) {
        throw new BadRequestException('A entidade do projeto é imutável.');
      }
      await this.assertRelations(project.entityId, dto.partnershipId ?? project.partnershipId);
      this.assertAttachments(dto.attachments ?? []);
      const activeMentor = await manager.getRepository(MemberDesignation).findOne({
        where: { targetType: 'extension_project', targetId: id, designation: 'mentor', status: 'active' },
      });
      const before = { ...project };
      assertProjectTransition(project, dto, actor, activeMentor);
      if (dto.status === 'proposed' && project.status === 'draft') {
        assertProjectComplete({ ...project, ...dto } as any);
      }
      const { mentorMemberId, coMentors, ...fields } = dto;
      Object.assign(project, fields);
      if (dto.name !== undefined) {
        project.normalizedName = normalizeProjectName(dto.name);
        project.slug = projectSlug(dto.name);
      }
      const saved = await manager.getRepository(ExtensionProject).save(project);
      if (mentorMemberId !== undefined) {
        await this.syncMentorAndCoMentors(manager, saved, mentorMemberId, coMentors ?? [], actor);
      }
      return { before, saved };
    });
    await this.audit.log({
      action: dto.status && dto.status !== updated.before.status
        ? AuditAction.PROJECT_STATUS_CHANGED
        : AuditAction.PROJECT_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'extension_project',
      details: { before: updated.before, after: { ...updated.saved } },
    });
    if (dto.mentorMemberId) await this.notifyMentor(dto.mentorMemberId, updated.saved);
    return updated.saved;
  }

  async listManage(query: ProjectQueryDto, actor: JwtPayload): Promise<PaginatedResultDto<ExtensionProject>> {
    await this.assertDirector(actor);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const [data, total] = await this.repo.findAndCount({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async listPublic() {
    const projects = await this.repo.find({
      where: { status: 'active', isPublic: true },
      order: { startsAt: 'ASC' },
    });
    return this.toPublicCollection(projects);
  }

  async publicBySlug(slug: string) {
    const project = await this.repo.findOne({
      where: { slug, status: 'active', isPublic: true },
    });
    if (!project) throw new NotFoundException('Projeto público não encontrado.');
    const [result] = await this.toPublicCollection([project]);
    return result;
  }

  private async toPublicCollection(projects: ExtensionProject[]) {
    const [entities, designations, members] = await Promise.all([
      this.entities.find({ where: { isActive: true } }),
      this.designationRepo.find({
        where: { targetType: 'extension_project', designation: 'mentor', status: 'active' },
      }),
      this.membersRepo.find(),
    ]);
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
    const memberMap = new Map(members.map((member) => [member.id, member]));
    return projects.flatMap((project) => {
      const entity = entityMap.get(project.entityId);
      if (!entity) return [];
      const mentorDesignation = designations.find((item) => item.targetId === project.id);
      const mentor = mentorDesignation ? memberMap.get(mentorDesignation.memberId) : null;
      return [{
        id: project.id,
        kind: project.kind,
        name: project.name,
        slug: project.slug,
        summary: project.summary,
        status: project.status,
        startsAt: project.startsAt,
        endsAt: project.endsAt,
        registrationStartsAt: project.registrationStartsAt,
        registrationEndsAt: project.registrationEndsAt,
        odsPrimary: project.odsPrimary,
        odsSecondary: project.odsSecondary,
        targetCommunity: project.targetCommunity,
        totalHours: project.totalHours,
        schedule: project.schedule,
        maxParticipants: project.maxParticipants,
        entity: { slug: entity.slug, name: entity.name },
        mentor: mentor ? { name: mentor.name, handle: mentor.githubHandle } : null,
      }];
    });
  }

  private async assertRelations(entityId: string, partnershipId?: string | null): Promise<void> {
    const entity = await this.entities.findOneBy({ id: entityId, isActive: true });
    if (!entity) throw new NotFoundException('Entidade ativa não encontrada.');
    if (partnershipId) {
      const partnership = await this.partnerships.findOneBy({ id: partnershipId, entityId, status: 'active' });
      if (!partnership) throw new BadRequestException('A parceria deve estar ativa e pertencer à mesma entidade.');
    }
  }

  private assertAttachments(attachments: string[]): void {
    for (const url of attachments) this.storage.validateReceiptUrl(url);
  }

  private async assertDirector(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasAnyDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!allowed) throw new ForbiddenException('Gestão de projetos requer admin ou diretor ativo.');
  }

  private async syncMentorAndCoMentors(
    manager: any,
    project: ExtensionProject,
    mentorMemberId: string,
    coMentors: string[],
    actor: JwtPayload,
  ): Promise<void> {
    const designationRepo = manager.getRepository(MemberDesignation);
    const existing = await designationRepo.findOne({
      where: { targetType: 'extension_project', targetId: project.id, designation: 'mentor', status: 'active' },
    });
    if (existing && existing.memberId !== mentorMemberId) {
      existing.status = 'ended';
      existing.endedAt = new Date();
      await designationRepo.save(existing);
    }
    if (!existing || existing.memberId !== mentorMemberId) {
      await this.designations.grant({
        memberId: mentorMemberId,
        targetType: 'extension_project',
        targetId: project.id,
        designation: 'mentor',
        appointedById: actor.sub,
      }, { actorId: actor.sub, actorHandle: actor.handle });
    }

    const participantRepo = manager.getRepository(ProjectParticipant);
    await participantRepo.update(
      { projectId: project.id, role: 'mentor', leftAt: null },
      { leftAt: new Date() },
    );
    for (const memberId of [...new Set([mentorMemberId, ...coMentors])]) {
      await participantRepo.save(participantRepo.create({
        projectId: project.id,
        memberId,
        role: 'mentor',
        leftAt: null,
      }));
    }
    await this.audit.log({
      action: AuditAction.PROJECT_MENTOR_DESIGNATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: project.id,
      targetType: 'extension_project',
      details: { mentorMemberId },
    });
  }

  private async notifyMentor(memberId: string, project: ExtensionProject): Promise<void> {
    const mentor = await this.membersRepo.findOneBy({ id: memberId, isActive: true });
    if (!mentor) return;
    await this.email.sendProjectEmail({
      template: 'project_mentor_assigned',
      to: mentor.email,
      memberName: mentor.name,
      projectName: project.name,
      projectId: project.id,
    });
  }
}
