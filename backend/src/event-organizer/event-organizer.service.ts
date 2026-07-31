import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { GitHubDBService } from '../github-db/github-db.service';
import type { FileHistoryEntry } from '../github-db/github-db.service';
import { MembersService } from '../members/members.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { MemberRole } from '../members/entities/member.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import type { CreateOwnershipDto } from './dto/create-ownership.dto';
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

const ORGANIZERS_PATH = 'static/events/organizers.json';
/** Manifesto público de overrides — atualizado NO MESMO PR de cada override */
const OVERRIDES_INDEX_PATH = 'static/events/overrides-index.json';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — docs/EVENT_PLAN.md §Ownership

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
 * Event Organizer — ownership de eventos externos e CRUD de overrides.
 *
 * Tudo é GitHub-as-Database: leituras vão direto ao `main` via
 * raw.githubusercontent.com (cache de 5 min em memória); escritas viram
 * branch + PR **em nome do próprio membro** (token OAuth com scope
 * public_repo — branch no canônico para colaboradores, fork flow para os
 * demais). O workflow do Actions valida e auto-mergeia *.override.json e
 * organizers.json.
 */
@Injectable()
export class EventOrganizerService {
  private organizersCache: { at: number; data: OrganizersFile } | null = null;
  private readonly overrideCache = new Map<
    string,
    { at: number; data: unknown }
  >();

  constructor(
    private readonly githubDb: GitHubDBService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly auditService: AuditService,
  ) {}

  // ── Organizers (ownership) ───────────────────────────────────────────────

  /** Lê organizers.json de `main` com cache de 5 min (usado nas permissões). */
  async getOrganizers(): Promise<OrganizersFile> {
    if (
      this.organizersCache &&
      Date.now() - this.organizersCache.at < CACHE_TTL_MS
    ) {
      return this.organizersCache.data;
    }
    const data = await this.readOrganizersFresh();
    this.organizersCache = { at: Date.now(), data };
    return data;
  }

  /** Leitura sem cache — base obrigatória para escritas (evita lost-update). */
  private async readOrganizersFresh(): Promise<OrganizersFile> {
    const content = await this.githubDb.readFile(ORGANIZERS_PATH);
    if (!content) return { version: 1, ownerships: [] };
    try {
      const parsed = JSON.parse(content) as OrganizersFile;
      if (!Array.isArray(parsed.ownerships)) {
        return { version: 1, ownerships: [] };
      }
      return parsed;
    } catch {
      return { version: 1, ownerships: [] };
    }
  }

  /**
   * Token OAuth do membro para escrever no repositório em nome dele.
   * Sem token (login anterior ao escopo public_repo) → 400 orientando re-login.
   * Público: reutilizado por outros módulos que escrevem via GitHub-as-DB
   * (ex.: force-sync do snapshot internal no EventsService).
   */
  async requireUserToken(memberId: string): Promise<string> {
    const token = await this.membersService.getGithubAccessToken(memberId);
    if (!token) {
      throw new BadRequestException(
        'Autorização do GitHub não encontrada — faça logout e login novamente para autorizar a escrita no repositório.',
      );
    }
    return token;
  }

  /**
   * Scopes de ownership do membro (organizers.json) — match por memberId ou
   * githubHandle. Usado para listar recursos visíveis (ex.: ativações externas).
   */
  async getOwnedScopes(user: JwtPayload): Promise<string[]> {
    const organizers = await this.getOrganizers();
    const handle = user.handle?.toLowerCase();
    return organizers.ownerships
      .filter(
        (o) =>
          o.memberId === user.sub ||
          (handle && o.githubHandle.toLowerCase() === handle),
      )
      .flatMap((o) => o.scope);
  }

  /**
   * GET /events/override/:sourceKey/:eventId/history — histórico de commits
   * do arquivo de override (proxy da commits API do GitHub). Com token do
   * membro quando disponível; [] quando não há commits (nunca 404).
   */
  async getOverrideHistory(
    sourceKey: string,
    eventId: string,
    user: JwtPayload,
  ): Promise<FileHistoryEntry[]> {
    const path = this.overridePath(sourceKey, eventId); // valida formato
    const token = await this.membersService.getGithubAccessToken(user.sub);
    return this.githubDb.getFileHistory(path, token);
  }

  /**
   * Atribui scopes a um organizer (upsert por memberId).
   * O PR de organizers.json é validado e auto-mergeado pelo workflow do
   * Actions (o workflow cobre *.override.json e organizers.json).
   */
  async addOwnership(
    dto: CreateOwnershipDto,
    actor: JwtPayload,
  ): Promise<{
    prNumber: number;
    prUrl: string;
    requiresManualMerge: boolean;
  }> {
    const member = await this.membersService.findOne(dto.memberId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado.');
    }
    if (member.githubHandle.toLowerCase() !== dto.githubHandle.toLowerCase()) {
      throw new BadRequestException(
        `githubHandle diverge do cadastro do membro (@${member.githubHandle}).`,
      );
    }

    const doc = await this.readOrganizersFresh();
    doc.ownerships = doc.ownerships.filter((o) => o.memberId !== dto.memberId);
    doc.ownerships.push({
      memberId: dto.memberId,
      githubHandle: member.githubHandle,
      scope: dto.scope,
    });

    const message = `event: organizers set @${member.githubHandle} by @${actor.handle}`;
    const result = await this.githubDb.createPRWithFile({
      branch: `organizers/${dto.memberId}-${Date.now()}`,
      path: ORGANIZERS_PATH,
      content: `${JSON.stringify(doc, null, 2)}\n`,
      commitMessage: message,
      prTitle: message,
      actorHandle: actor.handle,
      userToken: await this.requireUserToken(actor.sub),
      labels: ['event-override'],
    });

    this.organizersCache = null;
    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_GRANTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: dto.memberId,
      targetType: 'member',
      details: { scope: dto.scope, prNumber: result.prNumber },
    });

    return { ...result, requiresManualMerge: false };
  }

  /** Remove a ownership de um membro via PR (auto-mergeado — ver acima). */
  async removeOwnership(
    memberId: string,
    actor: JwtPayload,
  ): Promise<{
    prNumber: number;
    prUrl: string;
    requiresManualMerge: boolean;
  }> {
    const doc = await this.readOrganizersFresh();
    const before = doc.ownerships.length;
    doc.ownerships = doc.ownerships.filter((o) => o.memberId !== memberId);
    if (doc.ownerships.length === before) {
      throw new NotFoundException('Ownership não encontrada para este membro.');
    }

    const message = `event: organizers remove ${memberId} by @${actor.handle}`;
    const result = await this.githubDb.createPRWithFile({
      branch: `organizers/remove-${memberId}-${Date.now()}`,
      path: ORGANIZERS_PATH,
      content: `${JSON.stringify(doc, null, 2)}\n`,
      commitMessage: message,
      prTitle: message,
      actorHandle: actor.handle,
      userToken: await this.requireUserToken(actor.sub),
      labels: ['event-override'],
    });

    this.organizersCache = null;
    void this.auditService.log({
      action: AuditAction.EVENT_ORGANIZER_REVOKED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: memberId,
      targetType: 'member',
      details: { prNumber: result.prNumber },
    });

    return { ...result, requiresManualMerge: false };
  }

  // ── Overrides ─────────────────────────────────────────────────────────────

  /** Override atual em `main` (público, cache de 5 min). 404 se não existir. */
  async getOverride(sourceKey: string, eventId: string): Promise<unknown> {
    const path = this.overridePath(sourceKey, eventId);

    const cached = this.overrideCache.get(path);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data;
    }

    const content = await this.githubDb.readFile(path);
    if (!content) {
      throw new NotFoundException('Override não encontrado.');
    }
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new NotFoundException('Override inválido no repositório.');
    }
    this.overrideCache.set(path, { at: Date.now(), data });
    return data;
  }

  /**
   * Lê o manifesto de overrides da branch base. Ausente/inválido → manifesto
   * vazio (o sync-events.mjs regenera do zero a cada run — correção de drift).
   */
  private async readOverridesIndex(): Promise<{
    version: number;
    updatedAt?: string;
    overrides: Record<
      string,
      { extendData: unknown; ownerHandle: string; updatedAt: string }
    >;
  }> {
    const raw = await this.githubDb.readFile(OVERRIDES_INDEX_PATH);
    if (!raw) return { version: 1, overrides: {} };
    try {
      const parsed = JSON.parse(raw) as {
        version?: number;
        updatedAt?: string;
        overrides?: Record<
          string,
          { extendData: unknown; ownerHandle: string; updatedAt: string }
        >;
      };
      if (parsed && typeof parsed === 'object' && parsed.overrides) {
        return {
          version: parsed.version ?? 1,
          updatedAt: parsed.updatedAt,
          overrides: parsed.overrides,
        };
      }
    } catch {
      /* cai no manifesto vazio */
    }
    return { version: 1, overrides: {} };
  }

  /** Cria/atualiza override — valida tudo ANTES de chamar o GitHub. */
  async upsertOverride(
    sourceKey: string,
    eventId: string,
    dto: UpsertOverrideDto,
    user: JwtPayload,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const path = this.overridePath(sourceKey, eventId);
    EventOrganizerService.assertValidExtendData(dto.extendData);
    await this.assertCanManage(user, sourceKey, eventId);

    const override = {
      eventId,
      sourceKey,
      extendData: dto.extendData,
      ownerId: user.sub,
      ownerHandle: user.handle,
      updatedAt: new Date().toISOString(),
      ...(dto.reason ? { reason: dto.reason } : {}),
    };

    const reason = dto.reason?.trim() || 'sem motivo informado';
    const message = `event: override ${eventId} by @${user.handle} — ${reason}`;

    // Manifesto público: mesma entrada upsertada, NO MESMO PR (a listagem
    // pública mescla pelo manifesto, sem depender do sync de hora em hora)
    const manifest = await this.readOverridesIndex();
    manifest.overrides[`${sourceKey}:${eventId}`] = {
      extendData: dto.extendData,
      ownerHandle: user.handle,
      updatedAt: override.updatedAt,
    };
    manifest.updatedAt = override.updatedAt;

    const result = await this.githubDb.createPRWithFiles({
      branch: this.overrideBranch(sourceKey, eventId),
      files: [
        { path, content: `${JSON.stringify(override, null, 2)}\n` },
        {
          path: OVERRIDES_INDEX_PATH,
          content: `${JSON.stringify(manifest, null, 2)}\n`,
        },
      ],
      commitMessage: message,
      prTitle: message,
      actorHandle: user.handle,
      userToken: await this.requireUserToken(user.sub),
      labels: ['event-override'],
    });

    this.overrideCache.delete(path);
    void this.auditService.log({
      action: AuditAction.EVENT_OVERRIDE_UPSERTED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-override',
      details: {
        sourceKey,
        eventId,
        reason: dto.reason ?? null,
        prNumber: result.prNumber,
      },
    });

    return result;
  }

  /** Remove override — PR de delete (bot valida e auto-mergeia). */
  async deleteOverride(
    sourceKey: string,
    eventId: string,
    user: JwtPayload,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const path = this.overridePath(sourceKey, eventId);
    await this.assertCanManage(user, sourceKey, eventId);

    const existing = await this.githubDb.readFile(path);
    if (!existing) {
      throw new NotFoundException('Override não encontrado.');
    }

    const message = `event: remove override ${eventId} by @${user.handle}`;

    // Remove a entrada do manifesto NO MESMO PR de delete
    const manifest = await this.readOverridesIndex();
    delete manifest.overrides[`${sourceKey}:${eventId}`];
    manifest.updatedAt = new Date().toISOString();

    const result = await this.githubDb.createPRWithFiles({
      branch: this.overrideBranch(sourceKey, eventId),
      files: [
        { path, content: null },
        {
          path: OVERRIDES_INDEX_PATH,
          content: `${JSON.stringify(manifest, null, 2)}\n`,
        },
      ],
      commitMessage: message,
      prTitle: message,
      actorHandle: user.handle,
      userToken: await this.requireUserToken(user.sub),
      labels: ['event-override'],
    });

    this.overrideCache.delete(path);
    void this.auditService.log({
      action: AuditAction.EVENT_OVERRIDE_DELETED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-override',
      details: { sourceKey, eventId, prNumber: result.prNumber },
    });

    return result;
  }

  /** PR aberto para o override (polling de status pelo organizer/admin). */
  async getOverridePR(sourceKey: string, eventId: string, user: JwtPayload) {
    this.parseSegments(sourceKey, eventId); // valida formato
    await this.assertCanManage(user, sourceKey, eventId);

    const pr = await this.githubDb.findOpenPRByBranchPrefix(
      `event-override/${sourceKey.replaceAll(':', '-')}-${eventId}-`,
      await this.requireUserToken(user.sub),
    );
    if (!pr) {
      throw new NotFoundException('Nenhum PR aberto para este override.');
    }
    return pr;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Permissão: admin sempre pode; senão exige role `event_organizer` E uma
   * ownership cujo scope case `<sourceKey>:<eventId>` ou `<sourceKey>:*`
   * (match por memberId — `sub` do JWT — ou githubHandle do usuário logado).
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

    const organizers = await this.getOrganizers();
    const exactScope = `${sourceKey}:${eventId}`;
    const wildcardScope = `${sourceKey}:*`;
    const handle = user.handle?.toLowerCase();
    const owned = organizers.ownerships.some(
      (o) =>
        (o.memberId === user.sub ||
          (handle && o.githubHandle.toLowerCase() === handle)) &&
        o.scope.some((s) => s === exactScope || s === wildcardScope),
    );
    if (!owned) {
      throw new ForbiddenException('Sem ownership sobre este evento ou fonte.');
    }
  }

  /**
   * Versão booleana de {@link assertCanManage} para probes de UI (ex.: botão
   * "Editar metadados" na página pública de detalhe). Nunca lança — qualquer
   * falha de permissão/validação vira `canManage: false`.
   */
  async canManage(
    user: JwtPayload,
    sourceKey: string,
    eventId: string,
  ): Promise<{ canManage: boolean }> {
    try {
      this.parseSegments(sourceKey, eventId);
      await this.assertCanManage(user, sourceKey, eventId);
      return { canManage: true };
    } catch {
      return { canManage: false };
    }
  }

  /**
   * Valida extendData espelhando scripts/validate-overrides.mjs (o bot valida
   * de novo no PR — aqui falhamos rápido, antes de abrir branch no GitHub).
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

  private parseSegments(
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

  private overridePath(sourceKey: string, eventId: string): string {
    const { source, sourceId } = this.parseSegments(sourceKey, eventId);
    return `static/events/${source}/${sourceId}/${eventId}.override.json`;
  }

  private overrideBranch(sourceKey: string, eventId: string): string {
    return `event-override/${sourceKey.replaceAll(':', '-')}-${eventId}-${Date.now()}`;
  }
}
