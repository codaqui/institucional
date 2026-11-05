import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { MembersService } from '../members/members.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { Member, MemberRole } from '../members/entities/member.entity';
import { EventOrganizerOwnership } from './entities/event-organizer-ownership.entity';
import type {
  CreateEventOrganizerOwnershipDto,
  UpdateEventOrganizerOwnershipDto,
} from './dto/event-organizer-ownership.dto';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';
import { dedupeScopes, scopeToDesignation } from './ownership-reconciliation';

export interface OwnershipEntry {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

export interface OrganizersFile {
  version: number;
  ownerships: OwnershipEntry[];
}

@Injectable()
export class EventOrganizerOwnershipService {
  constructor(
    @InjectRepository(EventOrganizerOwnership)
    private readonly repo: Repository<EventOrganizerOwnership>,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly auditService: AuditService,
    @InjectRepository(MemberDesignation)
    private readonly designationsRepo: Repository<MemberDesignation>,
    private readonly dataSource: DataSource,
  ) {}

  async getOrganizers(): Promise<OrganizersFile> {
    const rows = await this.canonicalScopes()
      .orderBy('m."githubHandle"', 'ASC')
      .getRawMany<{ memberId: string; githubHandle: string; scope: string }>();
    const byMember = new Map<string, OwnershipEntry>();
    for (const row of rows) {
      const entry = byMember.get(row.memberId) ?? {
        memberId: row.memberId,
        githubHandle: row.githubHandle,
        scope: [],
      };
      if (!entry.scope.includes(row.scope)) entry.scope.push(row.scope);
      byMember.set(row.memberId, entry);
    }
    return { version: 1, ownerships: [...byMember.values()] };
  }

  findByMemberId(memberId: string): Promise<EventOrganizerOwnership | null> {
    return this.repo.findOne({ where: { memberId } });
  }

  async getOwnedScopes(user: JwtPayload): Promise<string[]> {
    const rows = await this.canonicalScopes()
      .andWhere('(d."memberId" = :memberId OR LOWER(m."githubHandle") = :handle)', {
        memberId: user.sub,
        handle: user.handle?.toLowerCase() ?? '',
      })
      .getRawMany();
    return rows.map((row) => row.scope);
  }

  async canManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<{ canManage: boolean }> {
    if (user.roles?.includes(MemberRole.ADMIN)) return { canManage: true };
    if (!user.roles?.includes(MemberRole.EVENT_ORGANIZER)) return { canManage: false };
    const scopes = await this.getOwnedScopes(user);
    const key = `${sourceKey}:${eventId}`;
    const wildcard = `${sourceKey}:*`;
    return { canManage: scopes.some((scope) => scope === key || scope === wildcard) };
  }

  async assertCanManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<void> {
    const { canManage } = await this.canManage(user, sourceKey, eventId);
    if (!canManage) {
      throw new BadRequestException('Você não tem permissão para gerenciar este evento.');
    }
  }

  async upsert(
    memberId: string,
    dto: CreateEventOrganizerOwnershipDto | UpdateEventOrganizerOwnershipDto,
    actor: JwtPayload,
  ): Promise<EventOrganizerOwnership> {
    const member = await this.membersService.findOne(memberId);
    if (!member) throw new NotFoundException('Membro não encontrado.');
    const githubHandle = 'githubHandle' in dto ? dto.githubHandle : member.githubHandle;
    if (member.githubHandle.toLowerCase() !== githubHandle.toLowerCase()) {
      throw new BadRequestException(
        `githubHandle diverge do cadastro do membro (@${member.githubHandle}).`,
      );
    }
    this.assertValidScopes(dto.scope);
    const scopes = dedupeScopes(dto.scope);

    const ownership = await this.dataSource.transaction(async (manager) => {
      const legacyRepo = manager.getRepository(EventOrganizerOwnership);
      let ownership = await legacyRepo.findOne({ where: { memberId } });
      if (ownership) {
        ownership.scope = scopes;
        ownership.updatedByMemberId = actor.sub;
      } else {
        ownership = legacyRepo.create({
          memberId,
          githubHandle: member.githubHandle,
          scope: scopes,
          createdByMemberId: actor.sub,
          updatedByMemberId: actor.sub,
        });
      }
      const saved = await legacyRepo.save(ownership);
      await this.replaceDesignations(memberId, scopes, actor, manager);
      return saved;
    });

    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_GRANTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: memberId,
      targetType: 'member',
      details: { scope: scopes },
    });
    return ownership;
  }

  async remove(memberId: string, actor: JwtPayload): Promise<void> {
    const ownership = await this.repo.findOne({ where: { memberId } });
    if (!ownership) throw new NotFoundException('Ownership não encontrada para este membro.');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(EventOrganizerOwnership).remove(ownership);
      await manager.getRepository(MemberDesignation).update(
        { memberId, targetType: 'event', designation: 'organizer', status: 'active' },
        { status: 'removed' },
      );
    });
    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_REVOKED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: memberId,
      targetType: 'member',
      details: {},
    });
  }

  reconcile(actor: JwtPayload) {
    if (!actor.roles?.includes(MemberRole.ADMIN)) {
      throw new BadRequestException('Reconciliação de ownership requer admin.');
    }
    return this.dataSource.transaction(async (manager) => {
      const [{ count: totalScopes }] = await manager.query(
        `SELECT COUNT(*)::int AS count FROM "event_organizer_ownerships" AS "o" CROSS JOIN unnest("o"."scope")`,
      );
      await manager.query(`
        UPDATE "member_designations" AS "d"
        SET "status" = 'ended', "endedAt" = now(), "updatedAt" = now()
        FROM "event_organizer_ownerships" AS "o"
        CROSS JOIN unnest("o"."scope") AS "scopeValue"
        JOIN "external_event_activations" AS "a" ON "a"."eventKey" = "scopeValue"
        WHERE "o"."memberId" = "d"."memberId"
          AND "scopeValue" = "d"."targetKey"
          AND "d"."targetType" = 'event'
          AND "d"."designation" = 'organizer'
          AND "d"."status" = 'active'
      `);
      const inserted = await manager.query(`
        INSERT INTO "member_designations" (
          "memberId", "targetType", "targetId", "targetKey", "designation",
          "status", "appointedById", "createdAt", "updatedAt"
        )
        SELECT
          "o"."memberId", 'event', "a"."id",
          CASE WHEN "a"."id" IS NULL THEN "scopeValue" ELSE NULL END,
          'organizer', 'active', "o"."updatedByMemberId", now(), now()
        FROM "event_organizer_ownerships" AS "o"
        CROSS JOIN unnest("o"."scope") AS "scopeValue"
        LEFT JOIN "external_event_activations" AS "a" ON "a"."eventKey" = "scopeValue"
        ON CONFLICT DO NOTHING
        RETURNING "id"
      `);
      const [{ count: orphanedActivations }] = await manager.query(`
        SELECT COUNT(*)::int AS count
        FROM "member_designations" AS "d"
        JOIN "external_event_activations" AS "a" ON "a"."id" = "d"."targetId"
        WHERE "d"."targetType" = 'event'
          AND "d"."designation" = 'organizer'
          AND "d"."status" = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM "event_organizer_ownerships" AS "o"
            WHERE "o"."memberId" = "d"."memberId"
              AND "a"."eventKey" = ANY("o"."scope")
          )
      `);
      return {
        inserted: inserted.length,
        alreadyPresent: Math.max(0, totalScopes - inserted.length),
        orphanedActivations,
      };
    });
  }

  private canonicalScopes() {
    return this.designationsRepo.createQueryBuilder('d')
      .distinct(true)
      .select('d."memberId"', 'memberId')
      .addSelect('m."githubHandle"', 'githubHandle')
      .addSelect('COALESCE("a"."eventKey", d."targetKey")', 'scope')
      .leftJoin(Member, 'm', 'm.id = d."memberId"')
      .leftJoin(ExternalEventActivation, 'a', 'a.id = d."targetId"')
      .where('d."targetType" = :targetType', { targetType: 'event' })
      .andWhere('d."designation" = :designation', { designation: 'organizer' })
      .andWhere('d."status" = :status', { status: 'active' });
  }

  private async replaceDesignations(
    memberId: string,
    scopes: string[],
    actor: JwtPayload,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(MemberDesignation);
    await repo.update(
      { memberId, targetType: 'event', designation: 'organizer', status: 'active' },
      { status: 'removed' },
    );
    const activations = await manager.getRepository(ExternalEventActivation)
      .findBy({ eventKey: In(scopes) });
    const activationsByKey = new Map(activations.map((activation) => [activation.eventKey, activation]));
    await repo.save(scopes.map((scope) => repo.create({
      memberId,
      ...scopeToDesignation(scope, activationsByKey.get(scope) ?? null),
      status: 'active',
      appointedById: actor.sub,
    })));
  }

  private assertValidScopes(scopes: string[]): void {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new BadRequestException('Pelo menos um scope é obrigatório.');
    }
    for (const scope of scopes) {
      if (scope.split(':').length !== 3) {
        throw new BadRequestException(
          `Scope inválido: "${scope}". Use "source:sourceId:eventId" ou "source:sourceId:*".`,
        );
      }
    }
  }
}
