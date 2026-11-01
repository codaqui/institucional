import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryRunner, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import {
  Designation,
  DesignationStatus,
  MemberDesignation,
  TargetType,
} from './entities/member-designation.entity';

export const DERIVED_ROLE_RULES = {
  diretor: [{ targetType: 'directorate', designation: 'director' }],
  voluntario: [
    { targetType: 'directorate', designation: 'volunteer' },
    { targetType: 'directorate', designation: 'director' },
  ],
  mentor: [
    { targetType: 'program', targetKey: 'mentoria', designation: 'mentor' },
    { targetType: 'extension_project', designation: 'mentor' },
  ],
  gestor_universitario: [
    {
      targetType: 'program',
      targetKey: 'universitario',
      designation: 'manager',
    },
  ],
} as const;

export interface DesignationActor {
  actorId: string;
  actorHandle: string;
}

export interface GrantDesignationInput {
  memberId: string;
  targetType: TargetType;
  targetId?: string;
  targetKey?: string;
  designation: Designation;
  appointedById: string;
  status?: DesignationStatus;
}

export interface DesignationQuery {
  targetType: TargetType;
  targetId?: string;
  targetKey?: string;
  designation: Designation;
}

type DerivedRole = keyof typeof DERIVED_ROLE_RULES;

export const DERIVED_ROLES = Object.keys(DERIVED_ROLE_RULES) as DerivedRole[];
const CACHE_TTL_MS = 60_000;
const SINGLE_TARGET_RULES = [
  { targetType: 'community', designation: 'responsible' },
  { targetType: 'ies', designation: 'ambassador' },
  { targetType: 'directorate', designation: 'director' },
  { targetType: 'extension_project', designation: 'mentor' },
  { targetType: 'company', designation: 'responsible' },
] as const;

@Injectable()
export class DesignationsService {
  private readonly cache = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();

  constructor(
    @InjectRepository(MemberDesignation)
    private readonly repo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async hasDesignation(
    memberId: string,
    query: DesignationQuery,
  ): Promise<boolean> {
    const key = JSON.stringify([
      memberId,
      query.targetType,
      query.targetId ?? null,
      query.targetKey ?? null,
      query.designation,
    ]);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const designation = await this.repo.findOne({
      where: {
        memberId,
        status: 'active',
        targetType: query.targetType,
        targetId: query.targetId ?? IsNull(),
        targetKey: query.targetKey ?? IsNull(),
        designation: query.designation,
      },
    });
    const value = !!designation;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async grant(
    input: GrantDesignationInput,
    actor: DesignationActor,
  ): Promise<MemberDesignation> {
    let wrote = false;
    const saved = await this.inTransaction(async (queryRunner) => {
      const repo = this.designationRepo(queryRunner);
      const existing = await repo.findOne({
        where: this.activeIdentityWhere(input),
      });
      if (existing?.memberId === input.memberId) return existing;

      if ((input.status ?? 'active') === 'active') {
        await this.assertNoActiveConflict(repo, input);
      }

      const designation = repo.create({
        ...input,
        targetId: input.targetId ?? null,
        targetKey: input.targetKey ?? null,
        status: input.status ?? 'active',
      });
      const created = await repo.save(designation);
      wrote = true;
      await this.syncMemberWithRunner(queryRunner, input.memberId, actor);
      return created;
    });

    if (!wrote) return saved;
    this.cache.clear();
    await this.audit.log({
      action: AuditAction.DESIGNATION_GRANTED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetId: input.memberId,
      targetType: 'member',
      details: {
        designationId: saved.id,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetKey: input.targetKey ?? null,
        designation: input.designation,
        status: saved.status,
      },
    });
    return saved;
  }

  async confirm(
    id: string,
    actor: DesignationActor,
  ): Promise<MemberDesignation> {
    let wrote = false;
    const saved = await this.inTransaction(async (queryRunner) => {
      const repo = this.designationRepo(queryRunner);
      const designation = await this.requireDesignation(repo, id);
      if (designation.status === 'active') return designation;
      if (designation.status !== 'pending') {
        throw new ConflictException(
          'Somente designações pendentes podem ser confirmadas.',
        );
      }

      await this.assertNoActiveConflict(repo, designation, designation.id);
      designation.status = 'active';
      designation.confirmedAt = new Date();
      designation.confirmedById = actor.actorId;
      const confirmed = await repo.save(designation);
      wrote = true;
      await this.syncMemberWithRunner(queryRunner, designation.memberId, actor);
      return confirmed;
    });

    if (!wrote) return saved;
    this.cache.clear();
    await this.audit.log({
      action: AuditAction.DESIGNATION_CONFIRMED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetId: saved.memberId,
      targetType: 'member',
      details: { designationId: saved.id, status: saved.status },
    });
    return saved;
  }

  async revoke(
    id: string,
    actor: DesignationActor,
  ): Promise<MemberDesignation> {
    let wrote = false;
    const saved = await this.inTransaction(async (queryRunner) => {
      const repo = this.designationRepo(queryRunner);
      const designation = await this.requireDesignation(repo, id);
      if (designation.status === 'removed' || designation.status === 'ended') {
        return designation;
      }

      designation.status = 'removed';
      designation.endedAt = new Date();
      const revoked = await repo.save(designation);
      wrote = true;
      await this.syncMemberWithRunner(queryRunner, designation.memberId, actor);
      return revoked;
    });

    if (!wrote) return saved;
    this.cache.clear();
    await this.audit.log({
      action: AuditAction.DESIGNATION_REVOKED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetId: saved.memberId,
      targetType: 'member',
      details: { designationId: saved.id, status: saved.status },
    });
    return saved;
  }

  listActive(memberId: string): Promise<MemberDesignation[]> {
    return this.repo.find({
      where: { memberId, status: 'active' },
      order: { createdAt: 'ASC' },
    });
  }

  async syncMember(memberId: string): Promise<void> {
    await this.inTransaction(async (queryRunner) => {
      await this.syncMemberWithRunner(queryRunner, memberId);
    });
  }

  private async syncMemberWithRunner(
    queryRunner: QueryRunner,
    memberId: string,
    actor?: DesignationActor,
  ): Promise<void> {
    const designations = await this.designationRepo(queryRunner).find({
      where: { memberId, status: 'active' },
    });
    const membersRepo = queryRunner.manager.getRepository(Member);
    const member = await membersRepo.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Membro não encontrado.');

    const derivedRoles = DERIVED_ROLES.filter((role) =>
      DERIVED_ROLE_RULES[role].some((rule) =>
        designations.some(
          (designation) =>
            designation.targetType === rule.targetType &&
            designation.designation === rule.designation &&
            (!('targetKey' in rule) ||
              designation.targetKey === rule.targetKey),
        ),
      ),
    );
    const manualRoles = member.roles.filter(
      (role) => !DERIVED_ROLES.includes(role as DerivedRole),
    );
    const roles = [
      ...manualRoles,
      ...derivedRoles.filter(
        (role) => !manualRoles.includes(role as MemberRole),
      ),
    ] as MemberRole[];

    if (
      roles.length === member.roles.length &&
      roles.every((role, index) => role === member.roles[index])
    ) {
      return;
    }

    const previousRoles = [...member.roles];
    member.roles = roles;
    await membersRepo.save(member);
    const auditActor = actor ?? {
      actorId: member.id,
      actorHandle: member.githubHandle,
    };
    await this.audit.log({
      action: AuditAction.ROLE_DERIVED,
      actorId: auditActor.actorId,
      actorHandle: auditActor.actorHandle,
      targetId: member.id,
      targetType: 'member',
      details: { previousRoles, roles, derivedRoles },
    });
  }

  private activeIdentityWhere(input: GrantDesignationInput) {
    return {
      memberId: input.memberId,
      targetType: input.targetType,
      targetId: input.targetId ?? IsNull(),
      targetKey: input.targetKey ?? IsNull(),
      designation: input.designation,
      status: 'active' as const,
    };
  }

  private async assertNoActiveConflict(
    repo: Repository<MemberDesignation>,
    input: GrantDesignationInput | MemberDesignation,
    excludeId?: string,
  ): Promise<void> {
    const singleTarget = SINGLE_TARGET_RULES.some(
      (rule) =>
        rule.targetType === input.targetType &&
        rule.designation === input.designation,
    );
    if (singleTarget) {
      const existing = await repo.findOne({
        where: {
          targetType: input.targetType,
          targetId: input.targetId ?? IsNull(),
          designation: input.designation,
          status: 'active',
        },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          'Já existe uma designação ativa para este destino.',
        );
      }
    }

    if (
      input.targetType === 'program' &&
      input.targetKey === 'mentoria' &&
      input.designation === 'mentor'
    ) {
      const existing = await repo.findOne({
        where: {
          memberId: input.memberId,
          targetType: 'program',
          targetKey: 'mentoria',
          designation: 'mentor',
          status: 'active',
        },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          'O membro já possui mentoria ativa neste programa.',
        );
      }
    }
  }

  private async requireDesignation(
    repo: Repository<MemberDesignation>,
    id: string,
  ): Promise<MemberDesignation> {
    const designation = await repo.findOne({ where: { id } });
    if (!designation) throw new NotFoundException('Designação não encontrada.');
    return designation;
  }

  private designationRepo(
    queryRunner: QueryRunner,
  ): Repository<MemberDesignation> {
    return queryRunner.manager.getRepository(MemberDesignation);
  }

  private async inTransaction<T>(
    work: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
