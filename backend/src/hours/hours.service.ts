import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, EntityManager, In, IsNull, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import type { EventRegistration } from '../events/entities/event-registration.entity';
import { HourEntry, HourEntrySource, HourEntryStatus } from './entities/hour-entry.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { DesignationsService } from '../designations/designations.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { Member, MemberRole } from '../members/entities/member.entity';
import { resolveProfileVisibility } from '../members/profile-visibility';
import { CreateHourEntryDto } from './dto/create-hour-entry.dto';
import { HourStatementQueryDto } from './dto/list-hours.dto';
import { HourStatement } from './entities/hour-statement.entity';
import { ExtensionProject } from '../projects/entities/extension-project.entity';
import { ProjectParticipant } from '../projects/entities/project-participant.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { EmailService } from '../notifications/email.service';
import { CreateProjectHourDto, UpdateProjectHourDto } from '../projects/dto/project-hour.dto';
import { hoursToCents } from '../projects/project.rules';

@Injectable()
export class HoursService {
  constructor(
    @InjectRepository(HourEntry)
    private readonly repo: Repository<HourEntry>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    @InjectRepository(HourStatement)
    private readonly statementsRepo: Repository<HourStatement>,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    private readonly projects?: Repository<ExtensionProject>,
    @Optional()
    private readonly participants?: Repository<ProjectParticipant>,
    @Optional()
    private readonly email?: EmailService,
  ) {}

  async create(dto: CreateHourEntryDto, actor: JwtPayload): Promise<HourEntry> {
    const allowed = actor.roles?.includes(MemberRole.ADMIN) || await this.designations.hasDesignation(actor.sub, {
      targetType: 'directorate',
      targetId: dto.sourceId,
      designation: 'director',
    });
    if (!allowed) {
      throw new ForbiddenException('Somente o diretor da diretoria pode lançar esta atividade.');
    }

    const existing = await this.repo.findOne({
      where: { memberId: actor.sub, idempotencyKey: dto.idempotencyKey },
    });
    if (existing) throw new ConflictException('Lançamento já registrado para esta chave de idempotência.');

    try {
      const entry = await this.repo.save(this.repo.create({
        ...dto,
        memberId: actor.sub,
        occurredAt: new Date(dto.occurredAt),
        status: HourEntryStatus.PENDING,
        reportedById: actor.sub,
      }));
      void this.audit.log({
        action: AuditAction.HOUR_CREATED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: entry.id,
        targetType: 'hour-entry',
        details: { sourceType: entry.sourceType, sourceId: entry.sourceId, hours: entry.hours },
      });
      return entry;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Lançamento já registrado para esta chave de idempotência.');
      }
      throw error;
    }
  }

  async recordExtensionProjectEntry(
    projectId: string,
    dto: CreateProjectHourDto,
    actor: JwtPayload,
  ): Promise<HourEntry> {
    const { dataSource } = this.requireProjectDependencies();
    return dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ExtensionProject).findOne({
        where: { id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      if (project.status !== 'active') throw new ConflictException('Horas só podem ser lançadas em projetos ativos.');
      await this.assertPrincipalMentor(manager, projectId, actor);
      await this.assertProjectParticipant(manager, projectId, dto.memberId);
      const repo = manager.getRepository(HourEntry);
      const existing = await repo.findOne({
        where: { memberId: dto.memberId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) throw new ConflictException('Lançamento já registrado para esta chave de idempotência.');
      const used = await repo.sum('hours', {
        memberId: dto.memberId,
        sourceType: HourEntrySource.EXTENSION_PROJECT,
        sourceId: projectId,
        status: In([HourEntryStatus.PENDING, HourEntryStatus.APPROVED]),
      });
      if (hoursToCents(used ?? 0) + hoursToCents(dto.hours) > hoursToCents(project.totalHours!)) {
        throw new ConflictException('Carga horária do projeto excedida.');
      }
      const entry = await repo.save(repo.create({
        memberId: dto.memberId,
        sourceType: HourEntrySource.EXTENSION_PROJECT,
        sourceId: projectId,
        sourceLabel: project.name,
        hours: dto.hours,
        description: dto.description,
        occurredAt: new Date(dto.occurredAt),
        status: HourEntryStatus.PENDING,
        reportedById: actor.sub,
        idempotencyKey: dto.idempotencyKey,
      }));
      await this.audit.log({
        action: AuditAction.HOUR_CREATED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: entry.id,
        targetType: 'hour-entry',
        details: { sourceType: entry.sourceType, sourceId: projectId, hours: entry.hours },
      });
      return entry;
    });
  }

  async updateExtensionProjectEntry(
    projectId: string,
    hourId: string,
    dto: UpdateProjectHourDto,
    actor: JwtPayload,
  ): Promise<HourEntry> {
    const { dataSource } = this.requireProjectDependencies();
    return dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(ExtensionProject).findOne({
        where: { id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      if (project.status !== 'active') throw new ConflictException('Somente projetos ativos permitem edição de horas.');
      await this.assertPrincipalMentor(manager, projectId, actor);
      const repo = manager.getRepository(HourEntry);
      const entry = await repo.findOne({
        where: { id: hourId, sourceType: HourEntrySource.EXTENSION_PROJECT, sourceId: projectId },
      });
      if (!entry) throw new NotFoundException('Lançamento de horas não encontrado.');
      if (entry.reportedById !== actor.sub) throw new ForbiddenException('Somente o mentor autor pode editar o lançamento.');
      if (entry.status !== HourEntryStatus.PENDING) {
        throw new ConflictException('Somente lançamentos pendentes podem ser editados.');
      }
      if (dto.idempotencyKey !== undefined && dto.idempotencyKey !== entry.idempotencyKey) {
        throw new BadRequestException('A chave de idempotência não pode ser alterada.');
      }
      const hours = dto.hours ?? entry.hours;
      const used = await repo.sum('hours', {
        memberId: entry.memberId,
        sourceType: HourEntrySource.EXTENSION_PROJECT,
        sourceId: projectId,
        status: In([HourEntryStatus.PENDING, HourEntryStatus.APPROVED]),
      });
      if (hoursToCents((used ?? 0) - entry.hours) + hoursToCents(hours) > hoursToCents(project.totalHours!)) {
        throw new ConflictException('Carga horária do projeto excedida.');
      }
      Object.assign(entry, dto, { hours });
      if (dto.occurredAt) entry.occurredAt = new Date(dto.occurredAt);
      return repo.save(entry);
    });
  }

  private requireProjectDependencies() {
    if (!this.dataSource || !this.projects || !this.participants) {
      throw new Error('Dependências de projetos não configuradas.');
    }
    return { dataSource: this.dataSource, projects: this.projects, participants: this.participants };
  }

  private async assertPrincipalMentor(manager: EntityManager, projectId: string, actor: JwtPayload) {
    const designation = await manager.getRepository(MemberDesignation).findOne({
      where: { targetType: 'extension_project', targetId: projectId, designation: 'mentor', status: 'active', memberId: actor.sub },
    });
    if (!designation) throw new ForbiddenException('Somente o mentor principal pode lançar horas neste projeto.');
  }

  private async assertProjectParticipant(manager: EntityManager, projectId: string, memberId: string) {
    const participant = await manager.getRepository(ProjectParticipant).findOne({
      where: { projectId, memberId, leftAt: IsNull() },
    });
    if (!participant) throw new ForbiddenException('O titular não possui vínculo ativo com este projeto.');
  }

  async approve(id: string, actor: JwtPayload): Promise<HourEntry> {
    await this.pendingForReview(id, actor);
    const result = await this.repo.update(
      { id, status: HourEntryStatus.PENDING },
      {
        status: HourEntryStatus.APPROVED,
        approvedById: actor.sub,
        approvedAt: new Date(),
        rejectReason: null,
      },
    );
    if (!result.affected) throw new ConflictException('O lançamento já foi revisado.');
    void this.audit.log({
      action: AuditAction.HOUR_APPROVED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'hour-entry',
      details: {},
    });
    const entry = await this.repo.findOneByOrFail({ id });
    await this.notifyHourReview(entry, 'project_hours_approved');
    return entry;
  }

  async reject(id: string, actor: JwtPayload, reason: string): Promise<HourEntry> {
    await this.pendingForReview(id, actor);
    const result = await this.repo.update(
      { id, status: HourEntryStatus.PENDING },
      {
        status: HourEntryStatus.REJECTED,
        rejectReason: reason,
        approvedById: actor.sub,
        approvedAt: new Date(),
      },
    );
    if (!result.affected) throw new ConflictException('O lançamento já foi revisado.');
    void this.audit.log({
      action: AuditAction.HOUR_REJECTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'hour-entry',
      details: { reason },
    });
    const entry = await this.repo.findOneByOrFail({ id });
    await this.notifyHourReview(entry, 'project_hours_rejected', reason);
    return entry;
  }

  private async notifyHourReview(
    entry: HourEntry,
    template: 'project_hours_approved' | 'project_hours_rejected',
    reason?: string,
  ): Promise<void> {
    if (!this.email || entry.sourceType !== HourEntrySource.EXTENSION_PROJECT) return;
    const member = await this.membersRepo.findOneBy({ id: entry.memberId });
    if (!member) return;
    await this.email.sendProjectEmail({
      template,
      to: member.email,
      memberName: member.name,
      projectName: entry.sourceLabel,
      projectId: entry.sourceId,
      hours: entry.hours,
      reason,
    });
  }

  private async pendingForReview(id: string, actor: JwtPayload): Promise<void> {
    if (!actor.roles?.some((role) => [MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER].includes(role as MemberRole))) {
      throw new ForbiddenException('Aprovação de horas requer admin ou finance-analyzer.');
    }
    const entry = await this.repo.findOneBy({ id });
    if (!entry) throw new NotFoundException('Lançamento de horas não encontrado.');
    if (entry.status !== HourEntryStatus.PENDING) {
      throw new ConflictException('Somente lançamentos pendentes podem ser revisados.');
    }
  }

  async recordEventCheckin(
    registration: EventRegistration,
    workloadMinutes: number | null,
    manager: EntityManager,
    sourceLabel = 'Participação em evento',
  ): Promise<void> {
    if (!registration.memberId || !workloadMinutes || workloadMinutes <= 0) return;
    const repo = manager.getRepository(HourEntry);
    await repo.query(`
      INSERT INTO "hour_ledger" (
        "memberId", "sourceType", "sourceId", "sourceLabel", "hours", "description",
        "occurredAt", "status", "reportedById", "approvedById", "approvedAt", "idempotencyKey"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT ("memberId", "sourceType", "sourceId")
      WHERE "sourceType" IN ('event_checkin', 'mentorship_session')
      DO NOTHING
    `, [
      registration.memberId,
      HourEntrySource.EVENT_CHECKIN,
      registration.id,
      sourceLabel,
      Math.round((workloadMinutes / 60) * 100) / 100,
      `Presença confirmada em ${sourceLabel}`,
      registration.checkedInAt ?? new Date(),
      HourEntryStatus.APPROVED,
      null,
      null,
      registration.checkedInAt,
      null,
    ]);
  }

  myEntries(memberId: string): Promise<HourEntry[]> {
    return this.repo.find({
      where: { memberId },
      order: { occurredAt: 'DESC' },
      take: 100,
    });
  }

  async myApprovedSummary(memberId: string) {
    const totalHours = await this.repo.sum('hours', {
      memberId,
      status: HourEntryStatus.APPROVED,
    });
    return { totalHours: Number(totalHours ?? 0) };
  }

  async pending(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [data, total] = await this.repo.findAndCount({
      where: { status: HourEntryStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async publicTotals() {
    const members = await this.membersRepo.find({
      where: { isActive: true },
      select: ['id', 'githubHandle', 'name', 'joinedAt', 'profileVisibility'],
      order: { joinedAt: 'ASC' },
    });
    const visibleMembers = members
      .map((member) => ({ member, visibility: resolveProfileVisibility(member.profileVisibility) }))
      .filter(({ visibility }) => visibility.hours || visibility.badge);
    const hourMemberIds = visibleMembers
      .filter(({ visibility }) => visibility.hours)
      .map(({ member }) => member.id);
    const totals = new Map<string, number>();

    if (hourMemberIds.length > 0) {
      const rows: Array<{ memberId: string; totalHours: string }> = await this.repo
        .createQueryBuilder('entry')
        .select('entry.memberId', 'memberId')
        .addSelect('SUM(entry.hours)', 'totalHours')
        .where('entry.status = :status', { status: HourEntryStatus.APPROVED })
        .andWhere('entry.memberId IN (:...memberIds)', { memberIds: hourMemberIds })
        .groupBy('entry.memberId')
        .getRawMany();
      for (const row of rows) totals.set(row.memberId, Number(row.totalHours));
    }

    return visibleMembers.map(({ member, visibility }) => ({
      memberId: member.id,
      githubHandle: member.githubHandle,
      name: member.name,
      ...(visibility.memberSince ? { joinedAt: member.joinedAt } : {}),
      badge: visibility.badge,
      ...(visibility.hours ? { totalHours: totals.get(member.id) ?? 0 } : {}),
    }));
  }

  async publicSummary(memberId: string) {
    const member = await this.membersRepo.findOneBy({ id: memberId, isActive: true });
    if (!member || !resolveProfileVisibility(member.profileVisibility).hours) {
      return { totalHours: 0, entries: [] };
    }
    const where = { memberId, status: HourEntryStatus.APPROVED };
    const [totalHours, entries] = await Promise.all([
      this.repo.sum('hours', where),
      this.repo.find({ where, order: { occurredAt: 'DESC' }, take: 50 }),
    ]);
    return {
      totalHours: Number(totalHours ?? 0),
      entries: entries.map((entry) => ({
        id: entry.id,
        sourceType: entry.sourceType,
        sourceLabel: entry.sourceLabel,
        hours: Number(entry.hours),
        description: entry.description,
        occurredAt: entry.occurredAt,
      })),
    };
  }

  async statement(memberId: string, query: HourStatementQueryDto) {
    const entries = await this.repo.find({
      where: this.periodWhere(memberId, query),
      order: { occurredAt: 'ASC' },
    });
    const totalHours = entries.reduce((total, entry) => total + Number(entry.hours), 0);
    const saved = await this.statementsRepo.save(this.statementsRepo.create({
      memberId,
      from: query.from ? new Date(query.from) : null,
      to: query.to ? new Date(query.to) : null,
      totalHours,
      entries: entries.map((entry) => ({
        id: entry.id,
        sourceType: entry.sourceType,
        sourceLabel: entry.sourceLabel,
        hours: Number(entry.hours),
        description: entry.description,
        occurredAt: entry.occurredAt,
      })),
    }));
    return {
      memberId,
      from: saved.from,
      to: saved.to,
      totalHours: saved.totalHours,
      entries: saved.entries,
      verificationCode: `HRS-${saved.id}`,
    };
  }

  async verifyStatement(code: string) {
    const id = code.replace(/^HRS-/, '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { valid: false as const };
    const statement = await this.statementsRepo.findOneBy({ id });
    if (!statement) return { valid: false as const };
    const member = await this.membersRepo.findOneBy({ id: statement.memberId, isActive: true });
    if (!member || !resolveProfileVisibility(member.profileVisibility).hours) {
      return { valid: false as const };
    }
    return {
      valid: true as const,
      from: statement.from,
      to: statement.to,
      totalHours: statement.totalHours,
    };
  }

  private periodWhere(memberId: string, query: HourStatementQueryDto) {
    const from = query.from ? new Date(query.from) : new Date(0);
    const to = query.to ? new Date(query.to) : new Date('9999-12-31T23:59:59.999Z');
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new ConflictException('Período inválido para a declaração de horas.');
    }
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return {
      memberId,
      status: HourEntryStatus.APPROVED,
      occurredAt: And(MoreThanOrEqual(from), LessThan(toExclusive)),
    };
  }
}
