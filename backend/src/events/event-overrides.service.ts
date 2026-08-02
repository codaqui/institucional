import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventOrganizerService } from '../event-organizer/event-organizer.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventOverride } from './entities/event-override.entity';
import type {
  CreateEventOverrideDto,
  UpdateEventOverrideDto,
} from './dto/event-override.dto';

/**
 * Service de overrides de eventos persistidos no PostgreSQL.
 *
 * Substitui o antigo GitHub-as-Database (arquivos *.override.json):
 * - leitura/escrita direta no banco via TypeORM;
 * - payload armazenado como texto JSON (leve, sem schema relacional);
 * - permissões usam EventOrganizerOwnership (PostgreSQL) para ownership.
 */
@Injectable()
export class EventOverridesService {
  constructor(
    @InjectRepository(EventOverride)
    private readonly repo: Repository<EventOverride>,
    private readonly organizerService: EventOrganizerService,
    private readonly auditService: AuditService,
  ) {}

  /** Busca um override específico (público). */
  async findOne(sourceKey: string, eventId: string): Promise<EventOverride> {
    const override = await this.repo.findOne({ where: { sourceKey, eventId } });
    if (!override) {
      throw new NotFoundException('Override não encontrado.');
    }
    return override;
  }

  /** Lista todos os overrides (usado pelo endpoint público de sync). */
  async findAll(): Promise<EventOverride[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  /** Lista overrides por sourceKey (útil para sync e admin). */
  async findBySourceKey(sourceKey: string): Promise<EventOverride[]> {
    return this.repo.find({ where: { sourceKey }, order: { updatedAt: 'DESC' } });
  }

  /** Lista múltiplos overrides por chaves (útil para o sync de snapshots). */
  async findByKeys(keys: { sourceKey: string; eventId: string }[]): Promise<EventOverride[]> {
    if (keys.length === 0) return [];
    const qb = this.repo.createQueryBuilder('o');
    const conditions = keys.map(
      (_, i) => `(o.sourceKey = :sourceKey${i} AND o.eventId = :eventId${i})`,
    );
    qb.where(conditions.join(' OR '));
    keys.forEach((k, i) => {
      qb.setParameter(`sourceKey${i}`, k.sourceKey);
      qb.setParameter(`eventId${i}`, k.eventId);
    });
    return qb.getMany();
  }

  /** Cria ou atualiza um override (owner/admin). */
  async upsert(
    sourceKey: string,
    eventId: string,
    dto: CreateEventOverrideDto | UpdateEventOverrideDto,
    user: JwtPayload,
  ): Promise<EventOverride> {
    await this.organizerService.assertCanManage(user, sourceKey, eventId);

    const extendData =
      'sourceKey' in dto && 'eventId' in dto
        ? (dto as CreateEventOverrideDto).payload.extendData
        : (dto as UpdateEventOverrideDto).payload.extendData;
    EventOrganizerService.assertValidExtendData(extendData);

    const payloadJson = JSON.stringify(extendData);
    const existing = await this.repo.findOne({ where: { sourceKey, eventId } });

    let override: EventOverride;
    if (existing) {
      existing.payload = payloadJson;
      existing.reason = dto.reason ?? null;
      existing.updatedByMemberId = user.sub;
      override = await this.repo.save(existing);
    } else {
      override = this.repo.create({
        sourceKey,
        eventId,
        ownerMemberId: user.sub,
        ownerHandle: user.handle,
        payload: payloadJson,
        reason: dto.reason ?? null,
        createdByMemberId: user.sub,
        updatedByMemberId: user.sub,
      });
      override = await this.repo.save(override);
    }

    void this.auditService.log({
      action: AuditAction.EVENT_OVERRIDE_UPSERTED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-override',
      details: {
        sourceKey,
        eventId,
        reason: dto.reason ?? null,
        overrideId: override.id,
      },
    });

    return override;
  }

  /** Remove um override (owner/admin). */
  async remove(
    sourceKey: string,
    eventId: string,
    user: JwtPayload,
  ): Promise<void> {
    await this.organizerService.assertCanManage(user, sourceKey, eventId);

    const override = await this.repo.findOne({ where: { sourceKey, eventId } });
    if (!override) {
      throw new NotFoundException('Override não encontrado.');
    }

    await this.repo.remove(override);

    void this.auditService.log({
      action: AuditAction.EVENT_OVERRIDE_DELETED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-override',
      details: { sourceKey, eventId, overrideId: override.id },
    });
  }

  /** Verifica se o usuário pode gerenciar o override (para UI pública). */
  async canManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<{ canManage: boolean }> {
    return this.organizerService.canManage(user, sourceKey, eventId);
  }
}
