import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { MembersService } from '../members/members.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import { EventOrganizerOwnershipService } from './event-organizer-ownership.service';
import type {
  ExtendDataDto,
  UpsertOverrideDto,
} from './dto/upsert-override.dto';

export interface OwnershipEntry {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

export interface OrganizersFile {
  version: number;
  ownerships: OwnershipEntry[];
}

// Campos nunca sobrescrevíveis (docs/EVENT_PLAN.md — Schema do Override)
const FORBIDDEN_EXTEND_FIELDS = [
  'id',
  'startAt',
  'endAt',
  'href',
  'source',
  'sourceId',
  'status',
];
const STRING_EXTEND_FIELDS = ['imageUrl', 'summary', 'location', 'title'];
const URL_EXTEND_FIELDS = [
  'registrationUrl',
  'slidesUrl',
  'videoUrl',
  'discussionUrl',
];
const MAX_SUMMARY_LENGTH = 500;
const MAX_TAGS = 10;
const MAX_SPEAKERS = 10;

/**
 * Event Organizer — permissões e validação de overrides.
 *
 * A persistência de ownership foi migrada para o PostgreSQL
 * (EventOrganizerOwnershipService). Este service mantém a interface antiga
 * (getOrganizers, assertCanManage, canManage, getOwnedScopes) como facade
 * para não quebrar consumidores, além da validação de extendData.
 */
@Injectable()
export class EventOrganizerService {
  constructor(
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly ownershipService: EventOrganizerOwnershipService,
  ) {}

  // ── Organizers (ownership) ───────────────────────────────────────────────

  /** Lê ownerships do banco (formato compatível com o antigo organizers.json). */
  async getOrganizers(): Promise<OrganizersFile> {
    return this.ownershipService.getOrganizers();
  }

  /** Scopes de ownership do membro. */
  async getOwnedScopes(user: JwtPayload): Promise<string[]> {
    return this.ownershipService.getOwnedScopes(user);
  }

  /**
   * Token OAuth do membro — ainda necessário para operações GitHub-as-Database
   * remanescentes (force-sync do snapshot internal:codaqui).
   * @throws BadRequestException se o membro não tiver token OAuth do GitHub.
   */
  async requireUserToken(memberId: string): Promise<string> {
    const token = await this.membersService.getGithubAccessToken(memberId);
    if (!token) {
      throw new BadRequestException(
        'Token do GitHub não encontrado. Faça login novamente com o GitHub.',
      );
    }
    return token;
  }

  /**
   * Permissão: admin sempre pode; senão exige role `event_organizer` E uma
   * ownership cujo scope case `<sourceKey>:<eventId>` ou `<sourceKey>:*`.
   */
  async assertCanManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<void> {
    if (user.roles?.includes(MemberRole.ADMIN)) return;
    if (!user.roles?.includes(MemberRole.EVENT_ORGANIZER)) {
      throw new ForbiddenException(
        'Acesso negado: requer role event_organizer.',
      );
    }

    const scopes = await this.ownershipService.getOwnedScopes(user);
    const exactScope = `${sourceKey}:${eventId}`;
    const wildcardScope = `${sourceKey}:*`;
    const owned = scopes.some(
      (s) => s === exactScope || s === wildcardScope,
    );
    if (!owned) {
      throw new ForbiddenException('Sem ownership sobre este evento ou fonte.');
    }
  }

  /**
   * Versão booleana de {@link assertCanManage} para probes de UI.
   */
  async canManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<{ canManage: boolean }> {
    return this.ownershipService.canManage(user, sourceKey, eventId);
  }

  // ── Overrides (validação apenas) ──────────────────────────────────────────

  /**
   * Valida extendData espelhando o schema do override.
   */
  static assertValidExtendData(extendData: ExtendDataDto): void {
    if (!extendData || typeof extendData !== 'object') {
      throw new BadRequestException('"extendData" deve ser um objeto.');
    }
    const ext = extendData as Record<string, unknown>;

    this.assertNoForbiddenFields(ext);
    this.assertStringAndUrlFields(ext);
    this.assertFeaturedField(ext);
    this.assertTagsField(ext);
    this.assertSummaryLength(ext);
    this.assertWorkloadMinutes(ext);
    this.assertSpeakersField(ext);
  }

  private static assertNoForbiddenFields(
    ext: Record<string, unknown>,
  ): void {
    for (const key of FORBIDDEN_EXTEND_FIELDS) {
      if (key in ext) {
        throw new BadRequestException(`Campo proibido: extendData.${key}`);
      }
    }
  }

  private static assertStringAndUrlFields(
    ext: Record<string, unknown>,
  ): void {
    for (const field of [...STRING_EXTEND_FIELDS, ...URL_EXTEND_FIELDS]) {
      if (ext[field] !== undefined && typeof ext[field] !== 'string') {
        throw new BadRequestException(
          `extendData.${field} deve ser uma string.`,
        );
      }
    }
  }

  private static assertFeaturedField(ext: Record<string, unknown>): void {
    if (ext.featured !== undefined && typeof ext.featured !== 'boolean') {
      throw new BadRequestException('extendData.featured deve ser um boolean.');
    }
  }

  private static assertTagsField(ext: Record<string, unknown>): void {
    if (ext.tags === undefined) return;
    if (
      !Array.isArray(ext.tags) ||
      ext.tags.some((tag) => typeof tag !== 'string')
    ) {
      throw new BadRequestException(
        'extendData.tags deve ser um array de strings.',
      );
    }
    if (ext.tags.length > MAX_TAGS) {
      throw new BadRequestException(
        `extendData.tags excede ${MAX_TAGS} itens.`,
      );
    }
  }

  private static assertSummaryLength(ext: Record<string, unknown>): void {
    if (
      typeof ext.summary === 'string' &&
      ext.summary.length > MAX_SUMMARY_LENGTH
    ) {
      throw new BadRequestException(
        `extendData.summary excede ${MAX_SUMMARY_LENGTH} caracteres.`,
      );
    }
  }

  private static assertWorkloadMinutes(ext: Record<string, unknown>): void {
    if (ext.workloadMinutes === undefined) return;
    if (
      typeof ext.workloadMinutes !== 'number' ||
      !Number.isInteger(ext.workloadMinutes) ||
      ext.workloadMinutes < 0 ||
      ext.workloadMinutes > 2880
    ) {
      throw new BadRequestException(
        'extendData.workloadMinutes deve ser um inteiro entre 0 e 2880 (até 48h).',
      );
    }
  }

  private static assertSpeakersField(ext: Record<string, unknown>): void {
    if (ext.speakers === undefined) return;
    if (!Array.isArray(ext.speakers)) {
      throw new BadRequestException('extendData.speakers deve ser um array.');
    }
    if (ext.speakers.length > MAX_SPEAKERS) {
      throw new BadRequestException(
        `extendData.speakers excede ${MAX_SPEAKERS} itens.`,
      );
    }
  }

  parseSegments(
    sourceKey: string,
    eventId: string,
  ): { source: string; sourceId: string } {
    const parts = sourceKey.split(':');
    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1] ||
      parts.some((p) => p.includes('/'))
    ) {
      throw new BadRequestException(
        'sourceKey inválido — formato esperado: <source>:<sourceId>.',
      );
    }
    if (
      !eventId ||
      eventId.includes('/') ||
      eventId.includes(':') ||
      eventId.includes('*') ||
      /\s/.test(eventId)
    ) {
      throw new BadRequestException('eventId inválido.');
    }
    return { source: parts[0], sourceId: parts[1] };
  }
}
