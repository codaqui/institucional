import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
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
import {
  CreateProjectDto,
  ProjectQueryDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ExtensionProject } from './entities/extension-project.entity';
import { ProjectParticipant } from './entities/project-participant.entity';
import {
  assertCanonicalUrl,
  isPublicCatalogProject,
} from './project-category';
import { assertProjectTransition } from './project-lifecycle';
import {
  assertProjectComplete,
  normalizeProjectName,
  projectSlug,
} from './project.rules';

export interface ProjectMemberOption {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string | null;
}

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
    @Optional()
    @InjectRepository(ProjectParticipant)
    private readonly participantsRepo?: Repository<ProjectParticipant>,
  ) {}

  async create(
    dto: CreateProjectDto,
    actor: JwtPayload,
  ): Promise<ExtensionProject> {
    await this.assertDirector(actor);
    await this.assertRelations(dto.entityId, dto.partnershipId);
    this.assertAttachments(dto.attachments ?? []);
    assertCanonicalUrl(dto.canonicalUrl);
    const status = dto.status ?? 'draft';
    if (['proposed', 'active'].includes(status) && (dto.category ?? 'extension') === 'extension') {
      assertProjectComplete(dto as any);
    }
    if (
      ['proposed', 'active'].includes(status) &&
      (dto.category ?? 'extension') !== 'extension' &&
      !dto.summary?.trim()
    ) {
      throw new BadRequestException('O resumo é obrigatório para publicar o projeto.');
    }

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
        await this.syncMentorAndCoMentors(
          manager,
          saved,
          mentorMemberId,
          coMentors ?? [],
          actor,
        );
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
    if (dto.mentorMemberId)
      await this.notifyMentor(dto.mentorMemberId, created);
    return created;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actor: JwtPayload,
  ): Promise<ExtensionProject> {
    const isDirector =
      actor.roles?.includes(MemberRole.ADMIN) ||
      (await this.designations.hasAnyDesignation(actor.sub, {
        targetType: 'directorate',
        designation: 'director',
      }));
    const isMentorFinish =
      dto.status === 'finished' &&
      Object.keys(dto).every((field) =>
        ['status', 'reportDiscussionUrl'].includes(field),
      ) &&
      (await this.designations.hasDesignation(actor.sub, {
        targetType: 'extension_project',
        targetId: id,
        designation: 'mentor',
      }));
    if (!isDirector && !isMentorFinish) {
      throw new ForbiddenException(
        'Gestão de projetos requer admin ou diretor ativo.',
      );
    }
    const updated = await this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ExtensionProject).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      if (dto.entityId && dto.entityId !== project.entityId) {
        throw new BadRequestException('A entidade do projeto é imutável.');
      }
      if (dto.category && dto.category !== project.category) {
        throw new BadRequestException('A categoria do projeto é imutável.');
      }
      assertCanonicalUrl(dto.canonicalUrl);
      await this.assertRelations(
        project.entityId,
        dto.partnershipId ?? project.partnershipId,
      );
      this.assertAttachments(dto.attachments ?? []);
      const activeMentor = await manager
        .getRepository(MemberDesignation)
        .findOne({
          where: {
            targetType: 'extension_project',
            targetId: id,
            designation: 'mentor',
            status: 'active',
          },
        });
      const before = { ...project };
      assertProjectTransition(project, dto, actor, activeMentor);
      if (
        dto.status === 'proposed' &&
        project.status === 'draft' &&
        (project.category ?? 'extension') === 'extension'
      ) {
        assertProjectComplete({ ...project, ...dto } as any);
      }
      const { mentorMemberId, coMentors, ...fields } = dto;
      Object.assign(project, fields);
      if (dto.name !== undefined) {
        project.normalizedName = normalizeProjectName(dto.name);
        project.slug = projectSlug(dto.name);
      }
      if (
        ['proposed', 'active'].includes(project.status) &&
        (project.category ?? 'extension') === 'extension'
      ) {
        assertProjectComplete({
          ...project,
          mentorMemberId: mentorMemberId ?? activeMentor?.memberId,
        } as any);
      }
      const saved = await manager.getRepository(ExtensionProject).save(project);
      let principalChanged = false;
      if (mentorMemberId !== undefined) {
        ({ principalChanged } = await this.syncMentorAndCoMentors(
          manager,
          saved,
          mentorMemberId,
          coMentors ?? [],
          actor,
        ));
      }
      return { before, saved, principalChanged };
    });
    await this.audit.log({
      action:
        dto.status && dto.status !== updated.before.status
          ? AuditAction.PROJECT_STATUS_CHANGED
          : AuditAction.PROJECT_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'extension_project',
      details: { before: updated.before, after: { ...updated.saved } },
    });
    if (dto.mentorMemberId && updated.principalChanged) {
      await this.notifyMentor(dto.mentorMemberId, updated.saved);
    }
    if (
      updated.saved.status === 'finished' &&
      updated.before.status !== 'finished'
    ) {
      await this.notifyProjectFinished(updated.saved);
    }
    return updated.saved;
  }

  async listManage(
    query: ProjectQueryDto,
    actor: JwtPayload,
  ): Promise<
    PaginatedResultDto<
      ExtensionProject & {
        mentor: ProjectMemberOption | null;
        coMentors: ProjectMemberOption[];
      }
    >
  > {
    await this.assertDirector(actor);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const [projects, total] = await this.repo.findAndCount({
      where: {
        ...(query.category !== 'all' ? { category: query.category ?? 'extension' } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    if (projects.length === 0) {
      return {
        data: [],
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    }

    const projectIds = projects.map((project) => project.id);
    const participantsQuery: Promise<ProjectParticipant[]> = this
      .participantsRepo
      ? this.participantsRepo.find({
          where: {
            projectId: In(projectIds),
            role: 'mentor',
            leftAt: IsNull(),
          },
        })
      : Promise.resolve([]);
    const [mentorDesignations, mentorParticipants] = await Promise.all([
      this.designationRepo.find({
        where: {
          targetType: 'extension_project',
          targetId: In(projectIds),
          designation: 'mentor',
          status: 'active',
        },
      }),
      participantsQuery,
    ]);
    const principalByProject = new Map(
      mentorDesignations.map((designation) => [
        designation.targetId,
        designation.memberId,
      ]),
    );
    const memberIds = [
      ...new Set([
        ...mentorDesignations.map((designation) => designation.memberId),
        ...mentorParticipants.map((participant) => participant.memberId),
      ]),
    ];
    const members =
      memberIds.length > 0
        ? await this.membersRepo.findBy({ id: In(memberIds) })
        : [];
    const memberMap = new Map(members.map((member) => [member.id, member]));
    const toOption = (memberId: string): ProjectMemberOption | null => {
      const member = memberMap.get(memberId);
      return member
        ? {
            id: member.id,
            name: member.name,
            githubHandle: member.githubHandle,
            avatarUrl: member.avatarUrl,
          }
        : null;
    };

    const data = projects.map((project) => {
      const principalId = principalByProject.get(project.id) ?? null;
      return {
        ...project,
        mentor: principalId ? toOption(principalId) : null,
        coMentors: mentorParticipants.flatMap((participant) => {
          if (
            participant.projectId !== project.id ||
            participant.memberId === principalId
          ) {
            return [];
          }
          const option = toOption(participant.memberId);
          return option ? [option] : [];
        }),
      };
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async listPublic() {
    const projects = await this.repo.find({
      where: { isPublic: true },
      order: { startsAt: 'ASC' },
    });
    return this.toPublicCollection(projects.filter(isPublicCatalogProject));
  }

  async publicBySlug(slug: string) {
    const project = await this.repo.findOne({
      where: { slug, isPublic: true },
    });
    if (!project || !isPublicCatalogProject(project))
      throw new NotFoundException('Projeto público não encontrado.');
    const [result] = await this.toPublicCollection([project]);
    return result;
  }

  private async toPublicCollection(projects: ExtensionProject[]) {
    const [entities, designations, members] = await Promise.all([
      this.entities.find({ where: { isActive: true } }),
      this.designationRepo.find({
        where: {
          targetType: 'extension_project',
          designation: 'mentor',
          status: 'active',
        },
      }),
      this.membersRepo.find(),
    ]);
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
    const memberMap = new Map(members.map((member) => [member.id, member]));
    return projects.flatMap((project) => {
      const entity = entityMap.get(project.entityId);
      if (!entity) return [];
      const mentorDesignation = designations.find(
        (item) => item.targetId === project.id,
      );
      const mentor = mentorDesignation
        ? memberMap.get(mentorDesignation.memberId)
        : null;
      return [
        {
          id: project.id,
          kind: project.kind,
          category: project.category ?? 'extension',
          canonicalUrl: project.canonicalUrl,
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
          mentor: mentor
            ? { name: mentor.name, handle: mentor.githubHandle }
            : null,
        },
      ];
    });
  }

  private async notifyProjectFinished(
    project: ExtensionProject,
  ): Promise<void> {
    if (!this.participantsRepo) return;
    const participations = await this.participantsRepo.find({
      where: { projectId: project.id },
    });
    const memberIds = [...new Set(participations.map((item) => item.memberId))];
    if (memberIds.length === 0) return;
    const members = await this.membersRepo.findBy({ id: In(memberIds) });
    await Promise.all(
      members.map((member) =>
        this.email.sendProjectEmail({
          template: 'project_finished',
          to: member.email,
          memberName: member.name,
          projectName: project.name,
          projectId: project.id,
        }),
      ),
    );
  }

  private async assertRelations(
    entityId: string,
    partnershipId?: string | null,
  ): Promise<void> {
    const entity = await this.entities.findOneBy({
      id: entityId,
      isActive: true,
    });
    if (!entity) throw new NotFoundException('Entidade ativa não encontrada.');
    if (partnershipId) {
      const partnership = await this.partnerships.findOneBy({
        id: partnershipId,
        entityId,
        status: 'active',
      });
      if (!partnership)
        throw new BadRequestException(
          'A parceria deve estar ativa e pertencer à mesma entidade.',
        );
    }
  }

  private assertAttachments(attachments: string[]): void {
    for (const url of attachments) {
      try {
        this.storage.validateReceiptUrl(url);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'URL de comprovante inválida.';
        throw new BadRequestException(message);
      }
    }
  }

  private async assertDirector(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasAnyDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!allowed)
      throw new ForbiddenException(
        'Gestão de projetos requer admin ou diretor ativo.',
      );
  }

  private async syncMentorAndCoMentors(
    manager: any,
    project: ExtensionProject,
    mentorMemberId: string,
    coMentors: string[],
    actor: JwtPayload,
  ): Promise<{ principalChanged: boolean; membershipChanged: boolean }> {
    const designationRepo = manager.getRepository(MemberDesignation);
    const participantRepo = manager.getRepository(ProjectParticipant);
    const [existing, currentParticipants] = await Promise.all([
      designationRepo.findOne({
        where: {
          targetType: 'extension_project',
          targetId: project.id,
          designation: 'mentor',
          status: 'active',
        },
      }),
      participantRepo.find({
        where: { projectId: project.id, role: 'mentor', leftAt: IsNull() },
      }),
    ]);

    const principalChanged = existing?.memberId !== mentorMemberId;
    const currentMemberIds = new Set(
      currentParticipants.map(
        (participant: ProjectParticipant) => participant.memberId,
      ),
    );
    const desiredMemberIds = new Set([mentorMemberId, ...coMentors]);
    const participantsChanged =
      currentMemberIds.size !== desiredMemberIds.size ||
      [...desiredMemberIds].some((memberId) => !currentMemberIds.has(memberId));
    const membershipChanged = principalChanged || participantsChanged;
    if (!membershipChanged) {
      return { principalChanged: false, membershipChanged: false };
    }

    if (existing && principalChanged) {
      existing.status = 'ended';
      existing.endedAt = new Date();
      await designationRepo.save(existing);
    }
    if (principalChanged) {
      await this.designations.grant(
        {
          memberId: mentorMemberId,
          targetType: 'extension_project',
          targetId: project.id,
          designation: 'mentor',
          appointedById: actor.sub,
        },
        { actorId: actor.sub, actorHandle: actor.handle },
      );
    }

    const now = new Date();
    await Promise.all(
      currentParticipants
        .filter(
          (participant: ProjectParticipant) =>
            !desiredMemberIds.has(participant.memberId),
        )
        .map((participant: ProjectParticipant) =>
          participantRepo.update(participant.id, { leftAt: now }),
        ),
    );
    const addedMemberIds = [...desiredMemberIds].filter(
      (memberId) => !currentMemberIds.has(memberId),
    );
    await Promise.all(
      addedMemberIds.map((memberId) =>
        participantRepo.save(
          participantRepo.create({
            projectId: project.id,
            memberId,
            role: 'mentor',
            leftAt: null,
          }),
        ),
      ),
    );
    await this.audit.log({
      action: AuditAction.PROJECT_MENTOR_DESIGNATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: project.id,
      targetType: 'extension_project',
      details: {
        mentorMemberId,
        beforeMemberIds: [...currentMemberIds],
        afterMemberIds: [...desiredMemberIds],
      },
    });
    return { principalChanged, membershipChanged };
  }

  private async notifyMentor(
    memberId: string,
    project: ExtensionProject,
  ): Promise<void> {
    const mentor = await this.membersRepo.findOneBy({
      id: memberId,
      isActive: true,
    });
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
