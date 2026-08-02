import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembersService } from '../members/members.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import { EventOrganizerOwnership } from './entities/event-organizer-ownership.entity';
import type {
  CreateEventOrganizerOwnershipDto,
  UpdateEventOrganizerOwnershipDto,
} from './dto/event-organizer-ownership.dto';

export interface OwnershipEntry {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

export interface OrganizersFile {
  version: number;
  ownerships: OwnershipEntry[];
}

/**
 * Ownership de organizers para eventos externos.
 *
 * Substitui o antigo static/events/organizers.json por persistência em
 * PostgreSQL. Scopes seguem o formato:
 * - "<source>:<sourceId>:<eventId>" → evento específico
 * - "<source>:<sourceId>:*"         → todos os eventos da fonte
 */
@Injectable()
export class EventOrganizerOwnershipService {
  constructor(
    @InjectRepository(EventOrganizerOwnership)
    private readonly repo: Repository<EventOrganizerOwnership>,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly auditService: AuditService,
  ) {}

  /** Lista todas as ownerships (formato compatível com o antigo organizers.json). */
  async getOrganizers(): Promise<OrganizersFile> {
    const ownerships = await this.repo.find({ order: { githubHandle: 'ASC' } });
    return {
      version: 1,
      ownerships: ownerships.map((o) => ({
        memberId: o.memberId,
        githubHandle: o.githubHandle,
        scope: o.scope,
      })),
    };
  }

  /** Busca uma ownership pelo memberId. */
  async findByMemberId(
    memberId: string,
  ): Promise<EventOrganizerOwnership | null> {
    return this.repo.findOne({ where: { memberId } });
  }

  /** Scopes que o usuário possui (match por memberId ou githubHandle). */
  async getOwnedScopes(user: JwtPayload): Promise<string[]> {
    const handle = user.handle?.toLowerCase();
    const ownerships = await this.repo.find({
      where: [{ memberId: user.sub }, { githubHandle: handle ?? '' }],
    });
    return ownerships.flatMap((o) => o.scope);
  }

  /** Verifica se o usuário pode gerenciar um evento externo específico. */
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
    return {
      canManage: scopes.some(
        (s) => s === key || s === wildcard || s === `${sourceKey}:*`,
      ),
    };
  }

  /** Assert de permissão para gerenciar um evento externo. */
  async assertCanManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<void> {
    const { canManage } = await this.canManage(user, sourceKey, eventId);
    if (!canManage) {
      throw new BadRequestException(
        'Você não tem permissão para gerenciar este evento.',
      );
    }
  }

  /** Cria ou atualiza a ownership de um membro. */
  async upsert(
    memberId: string,
    dto: CreateEventOrganizerOwnershipDto | UpdateEventOrganizerOwnershipDto,
    actor: JwtPayload,
  ): Promise<EventOrganizerOwnership> {
    const member = await this.membersService.findOne(memberId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado.');
    }

    const githubHandle =
      'githubHandle' in dto ? dto.githubHandle : member.githubHandle;
    if (member.githubHandle.toLowerCase() !== githubHandle.toLowerCase()) {
      throw new BadRequestException(
        `githubHandle diverge do cadastro do membro (@${member.githubHandle}).`,
      );
    }

    this.assertValidScopes(dto.scope);

    let ownership = await this.repo.findOne({ where: { memberId } });
    if (ownership) {
      ownership.scope = dto.scope;
      ownership.updatedByMemberId = actor.sub;
      ownership = await this.repo.save(ownership);
    } else {
      ownership = this.repo.create({
        memberId,
        githubHandle: member.githubHandle,
        scope: dto.scope,
        createdByMemberId: actor.sub,
        updatedByMemberId: actor.sub,
      });
      ownership = await this.repo.save(ownership);
    }

    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_GRANTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: memberId,
      targetType: 'member',
      details: { scope: dto.scope },
    });

    return ownership;
  }

  /** Remove a ownership de um membro. */
  async remove(memberId: string, actor: JwtPayload): Promise<void> {
    const ownership = await this.repo.findOne({ where: { memberId } });
    if (!ownership) {
      throw new NotFoundException('Ownership não encontrada para este membro.');
    }

    await this.repo.remove(ownership);

    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_REVOKED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: memberId,
      targetType: 'member',
      details: {},
    });
  }

  /** Valida formato dos scopes. */
  private assertValidScopes(scopes: string[]): void {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new BadRequestException('Pelo menos um scope é obrigatório.');
    }
    for (const scope of scopes) {
      const parts = scope.split(':');
      if (parts.length !== 3) {
        throw new BadRequestException(
          `Scope inválido: "${scope}". Use "source:sourceId:eventId" ou "source:sourceId:*".`,
        );
      }
    }
  }
}
