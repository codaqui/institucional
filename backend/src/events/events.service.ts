import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  ManagedEvent,
  ManagedEventStatus,
} from './entities/managed-event.entity';
import { TicketKind, TicketType } from './entities/ticket-type.entity';
import { EventOrder, OrderStatus } from './entities/event-order.entity';
import {
  EventRegistration,
  RegistrationStatus,
} from './entities/event-registration.entity';
import { EventStaff, EventStaffRole } from './entities/event-staff.entity';
import {
  EXTERNAL_EVENT_FEATURES,
  ExternalEventActivation,
} from './entities/external-event-activation.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import { StripeService } from '../stripe/stripe.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountType } from '../ledger/entities/account.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { EmailService } from '../notifications/email.service';
import { EventOrganizerService } from '../event-organizer/event-organizer.service';
import { GitHubDBService } from '../github-db/github-db.service';
import { CsvParseError, parseCsvText, type ParsedCsvRow } from './csv';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import type { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import type {
  AddStaffDto,
  CheckoutDto,
  CreateTicketTypeDto,
  RefundOrderDto,
  RegisterDto,
  UpdateTicketTypeDto,
} from './dto/ticket-operations.dto';
import type { ActivateExternalDto } from './dto/external.dto';
import { CreateReimbursementDto } from '../reimbursements/dto/create-reimbursement.dto';

/**
 * Versão dos termos de compra e política de reembolso de ingressos.
 *
 * Conformidade legal (BR): CDC art. 49 garante arrependimento em até 7 dias
 * corridos para compras online; cancelamento/adiamento do evento gera direito
 * a reembolso integral. Os termos exibidos no checkout precisam bater com esta
 * versão — ao alterar o texto, bump aqui (orders antigas guardam a versão
 * aceita na coluna `termsVersion`).
 */
export const EVENT_TICKET_TERMS_VERSION = '2026-07-v1';

/** Reserva de quota de uma order pending expira após 30 minutos */
const ORDER_EXPIRATION_MINUTES = 30;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Converte uma string vinda de <input type="datetime-local"> (formato
 * `YYYY-MM-DDTHH:mm` ou `YYYY-MM-DDTHH:mm:ss`, sem offset) para um objeto Date
 * em UTC, interpretando o wall-clock no timezone informado.
 *
 * Isso evita o bug de fuso em que o container Node roda em UTC e converte
 * "2026-07-30T15:30" para 15:30 UTC ao invés de 15:30 BRT (18:30 UTC).
 */
function parseDateTimeLocal(value: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!m) {
    return new Date(value);
  }
  const [_, y, mo, d, h, mi, s] = m;
  const naive = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
  const offset = getTimezoneOffsetMinutes(timeZone, new Date(naive));
  return new Date(naive - offset * 60_000);
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const extract = (tz: string) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts: Record<string, number> = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        parts[part.type] = Number(part.value);
      }
    }
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    };
  };
  const utc = extract('UTC');
  const tz = extract(timeZone);
  const utcMs = Date.UTC(
    utc.year,
    utc.month - 1,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second,
  );
  const tzMs = Date.UTC(
    tz.year,
    tz.month - 1,
    tz.day,
    tz.hour,
    tz.minute,
    tz.second,
  );
  return (tzMs - utcMs) / 60_000;
}

interface ImportContext {
  activation: ExternalEventActivation;
  sourceKey: string;
  seenExternal: Set<string>;
  seenIdentifier: Set<string>;
  existing: EventRegistration[];
  ticketCache: Map<string, TicketType>;
  ticketIncrements: Map<string, number>;
  toSave: EventRegistration[];
  unmatched: Array<{ line: number; email: string }>;
  errors: Array<{ line: number; reason: string }>;
  matched: number;
  healed: number;
  skippedDuplicates: number;
  user: JwtPayload;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(ManagedEvent)
    private readonly eventRepo: Repository<ManagedEvent>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(EventOrder)
    private readonly orderRepo: Repository<EventOrder>,
    @InjectRepository(EventRegistration)
    private readonly registrationRepo: Repository<EventRegistration>,
    @InjectRepository(EventStaff)
    private readonly staffRepo: Repository<EventStaff>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(ExternalEventActivation)
    private readonly activationRepo: Repository<ExternalEventActivation>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly stripeService: StripeService,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly eventOrganizerService: EventOrganizerService,
    private readonly githubDb: GitHubDBService,
    private readonly reimbursementsService: ReimbursementsService,
  ) {}

  // ── Permissões ────────────────────────────────────────────────────────────

  /** event_organizer/admin globais acessam tudo */
  private static canManageAll(user: JwtPayload): boolean {
    return !!user.roles?.some(
      (r) => r === MemberRole.ADMIN || r === MemberRole.EVENT_ORGANIZER,
    );
  }

  /** staff do evento (host/checker/finance) — usado também pela 2c/2d */
  async isStaff(
    eventId: string,
    memberId: string,
    roles?: EventStaffRole[],
  ): Promise<boolean> {
    const staff = await this.staffRepo.findBy({ eventId, memberId });
    if (!roles?.length) return staff.length > 0;
    return staff.some((s) => roles.includes(s.staffRole));
  }

  private static canViewEventGlobally(user: JwtPayload): boolean {
    return (
      EventsService.canManageAll(user) ||
      !!user.roles?.includes(MemberRole.EVENT_FINANCE)
    );
  }

  private async assertCanViewEvent(
    user: JwtPayload,
    eventId: string,
  ): Promise<void> {
    if (EventsService.canViewEventGlobally(user)) return;
    if (await this.isStaff(eventId, user.sub)) return;
    throw new ForbiddenException('Sem permissão para este evento.');
  }

  private async assertCanEditEvent(
    user: JwtPayload,
    eventId: string,
  ): Promise<void> {
    if (EventsService.canManageAll(user)) return;
    // host do evento pode editar dados básicos
    if (await this.isStaff(eventId, user.sub, [EventStaffRole.HOST])) return;
    throw new ForbiddenException('Sem permissão para editar este evento.');
  }

  private static assertGlobalManager(user: JwtPayload): void {
    if (!EventsService.canManageAll(user)) {
      throw new ForbiddenException(
        'Acesso negado: requer role event_organizer ou admin.',
      );
    }
  }

  // ── Quota (reserva atômica anti-oversell) ─────────────────────────────────

  /**
   * Reserva atômica de quota — uma única instrução UPDATE com todas as
   * condições no WHERE. Se não retornar linha, o lote está esgotado (ou fora
   * da janela de vendas) e NENHUMA vaga foi consumida.
   */
  private async reserveQuota(
    ticketTypeId: string,
    quantity: number,
    enforceSalesWindow: boolean,
  ): Promise<boolean> {
    const windowClause = enforceSalesWindow
      ? 'AND ("salesStartAt" IS NULL OR "salesStartAt" <= now()) AND ("salesEndAt" IS NULL OR "salesEndAt" >= now())'
      : '';
    const rows: Array<{ id: string }> = await this.ticketTypeRepo.query(
      `UPDATE ticket_types
          SET "quantitySold" = "quantitySold" + $1
        WHERE id = $2 AND "isActive" ${windowClause}
          AND "quantitySold" + $1 <= "quantityTotal"
        RETURNING id`,
      [quantity, ticketTypeId],
    );
    return rows.length > 0;
  }

  /** Devolução de quota — nunca deixa quantitySold negativo */
  private async releaseQuota(
    ticketTypeId: string,
    quantity: number,
  ): Promise<void> {
    await this.ticketTypeRepo.query(
      `UPDATE ticket_types
          SET "quantitySold" = GREATEST("quantitySold" - $1, 0)
        WHERE id = $2`,
      [quantity, ticketTypeId],
    );
  }

  // ── Serialização pública (pipeline de snapshots) ──────────────────────────

  private static deriveItemStatus(
    event: ManagedEvent,
    now = new Date(),
  ): 'scheduled' | 'active' | 'completed' | 'canceled' {
    if (event.status === ManagedEventStatus.CANCELED) return 'canceled';
    if (event.status === ManagedEventStatus.COMPLETED) return 'completed';
    if (now < new Date(event.startAt)) return 'scheduled';
    if (event.endAt && now > new Date(event.endAt)) return 'completed';
    return 'active';
  }

  private static toEventItem(
    event: ManagedEvent,
    confirmedCount: number,
  ): Record<string, unknown> {
    return {
      id: event.id,
      title: event.title,
      summary: event.summary,
      startAt: new Date(event.startAt).toISOString(),
      ...(event.endAt && { endAt: new Date(event.endAt).toISOString() }),
      timezone: event.timezone,
      platform: 'Site Codaqui',
      host: 'Codaqui',
      location: event.location,
      href: `/eventos/detalhe?source=internal&sourceId=codaqui&id=${event.id}`,
      tags: [],
      ctaLabel: 'Inscrever-se',
      status: EventsService.deriveItemStatus(event),
      ...(event.imageUrl && { imageUrl: event.imageUrl }),
      userCount: confirmedCount,
    };
  }

  /** GET /events/public/managed — somente published, shape EventItem + EventSourceConfig */
  async getPublicManagedEvents(): Promise<{
    source: Record<string, unknown>;
    events: Array<Record<string, unknown>>;
  }> {
    const events = await this.eventRepo.find({
      where: { status: ManagedEventStatus.PUBLISHED },
      order: { startAt: 'ASC' },
    });
    const counts = await this.countConfirmedByEvent(events.map((e) => e.id));
    return {
      source: {
        source: 'internal',
        sourceId: 'codaqui',
        type: 'internal',
        label: 'Codaqui',
        emoji: '🌱',
        description: 'Eventos organizados pela Associação Codaqui.',
        ctaLabel: 'Ver eventos',
        ctaHref: '/eventos',
      },
      events: events.map((e) =>
        EventsService.toEventItem(e, counts.get(e.id) ?? 0),
      ),
    };
  }

  /** GET /events/public/managed/:id — published only (404 caso contrário) */
  async getPublicManagedEvent(id: string): Promise<{
    event: Record<string, unknown>;
    ticketTypes: Array<Record<string, unknown>>;
  }> {
    const event = await this.eventRepo.findOneBy({
      id,
      status: ManagedEventStatus.PUBLISHED,
    });
    if (!event) throw new NotFoundException('Evento não encontrado.');

    const ticketTypes = await this.ticketTypeRepo.find({
      where: { eventId: id, isActive: true },
      order: { priceCents: 'ASC' },
    });
    return {
      event: EventsService.serializeEvent(event),
      ticketTypes: ticketTypes.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        priceCents: t.priceCents,
        quantityTotal: t.quantityTotal,
        quantitySold: t.quantitySold,
        salesStartAt: t.salesStartAt,
        salesEndAt: t.salesEndAt,
        maxPerOrder: t.maxPerOrder,
      })),
    };
  }

  private static serializeEvent(event: ManagedEvent): Record<string, unknown> {
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      imageUrl: event.imageUrl,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      communityProjectKey: event.communityProjectKey,
      status: event.status,
      capacity: event.capacity,
      createdAt: event.createdAt,
    };
  }

  private async countConfirmedByEvent(
    eventIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (eventIds.length === 0) return map;
    const rows: Array<{ eventId: string; count: string }> =
      await this.registrationRepo
        .createQueryBuilder('r')
        .select('r."eventId"', 'eventId')
        .addSelect('COUNT(*)', 'count')
        .where('r."eventId" IN (:...ids)', { ids: eventIds })
        .andWhere('r.status = :status', {
          status: RegistrationStatus.CONFIRMED,
        })
        .groupBy('r."eventId"')
        .getRawMany();
    for (const row of rows) {
      map.set(row.eventId, Number.parseInt(row.count, 10));
    }
    return map;
  }

  /**
   * Verifica se o comprador já possui ingresso CONFIRMED/PENDING_MATCH para o
   * evento. Se sim, só permite prosseguir quando os participantes informados
   * forem todos diferentes do comprador (compra nominada a terceiros).
   * Retorna { wouldDuplicateSelf: true } quando o próprio comprador constaria
   * como participante — o frontend pode exibir modal oferecendo "comprar para
   * outra pessoa".
   */
  private async assertNotDuplicateTicketForBuyer(
    target: {
      eventId: string | null;
      externalActivationId: string | null;
    },
    dto: CheckoutDto,
    buyer: Member,
  ): Promise<void> {
    const hasTicketForSelf = target.eventId
      ? await this.registrationRepo.findOneBy({
          eventId: target.eventId,
          memberId: buyer.id,
          status: In([
            RegistrationStatus.CONFIRMED,
            RegistrationStatus.PENDING_MATCH,
          ]),
        })
      : await this.registrationRepo.findOneBy({
          externalActivationId: target.externalActivationId!,
          memberId: buyer.id,
          status: In([
            RegistrationStatus.CONFIRMED,
            RegistrationStatus.PENDING_MATCH,
          ]),
        });
    if (!hasTicketForSelf) return;

    // Se informou attendees e NENHUM é o comprador, permite (está comprando para outros)
    const buyerEmail = (buyer.email ?? '').toLowerCase().trim();
    const attendeesForSelf = (dto.attendees ?? []).filter(
      (a) => (a.email ?? '').toLowerCase().trim() === buyerEmail,
    );
    if (dto.attendees && dto.attendees.length > 0 && attendeesForSelf.length === 0) {
      return;
    }

    throw new ConflictException(
      'Você já possui um ingresso para este evento. Se quiser comprar outro, ' +
        'informe os dados de outra pessoa (nome e e-mail) nos participantes.',
    );
  }

  // ── Gestão (organizer/admin/staff) ────────────────────────────────────────

  private async withRelations(event: ManagedEvent) {
    const [ticketTypes, staff] = await Promise.all([
      this.ticketTypeRepo.find({
        where: { eventId: event.id },
        order: { priceCents: 'ASC' },
      }),
      this.staffRepo.findBy({ eventId: event.id }),
    ]);
    return {
      ...EventsService.serializeEvent(event),
      createdByMemberId: event.createdByMemberId,
      ticketTypes,
      staff: staff.map((s) => ({
        id: s.id,
        memberId: s.memberId,
        staffRole: s.staffRole,
      })),
    };
  }

  /** GET /events — todos os eventos (qualquer status) */
  async listEvents(
    user: JwtPayload,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      community?: string;
    },
  ) {
    if (!EventsService.canManageAll(user) && !user.roles?.includes(MemberRole.EVENT_FINANCE)) {
      throw new ForbiddenException(
        'Acesso negado: requer role admin, event_organizer ou event_finance.',
      );
    }

    const qb = this.eventRepo.createQueryBuilder('e').orderBy('e."startAt"', 'DESC');

    if (query?.search?.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(lower(e.title) LIKE :q OR lower(e.summary) LIKE :q)', { q });
    }
    if (query?.community?.trim()) {
      qb.andWhere('e."communityProjectKey" = :community', {
        community: query.community.trim(),
      });
    }

    const page = query?.page ?? 0;
    const limit = query?.limit ?? 0;
    const isPaginated = page > 0 && limit > 0;

    if (isPaginated) {
      const total = await qb.getCount();
      qb.skip((page - 1) * limit).take(limit);
      const events = await qb.getMany();
      const data = await Promise.all(events.map((e) => this.withRelations(e)));
      return { events: data, total, page, limit };
    }

    const events = await qb.getMany();
    return Promise.all(events.map((e) => this.withRelations(e)));
  }

  /**
   * GET /events/checkin-scope
   *
   * Retorna os eventos que o usuário logado pode acessar no contexto de
   * check-in, separando eventos próprios (managed) e externos ativados.
   *
   * Regras de acesso:
   * - admin / event_organizer global: todos os eventos, lista habilitada.
   * - event_checker global: todos os eventos, somente scanner (lista bloqueada).
   * - Demais membros: apenas eventos onde são staff (host/checker) ou onde são
   *   owner/ativador de evento externo.
   *
   * A flag `canUseList` indica se o usuário pode ver a lista de inscritos e
   * buscar manualmente (admin/organizer/host/owner/ativador); caso contrário,
   * fica restrito ao scanner de QR Code.
   */
  async getCheckinScope(user: JwtPayload): Promise<{
    managed: Array<{
      id: string;
      title: string;
      startAt: string;
      status: string;
      canUseList: boolean;
    }>;
    external: Array<{
      eventKey: string;
      title: string | null;
      features: string[];
      canUseList: boolean;
    }>;
  }> {
    const isManager = EventsService.canManageAll(user);
    const isGlobalChecker = !!user.roles?.includes(MemberRole.EVENT_CHECKER);

    // ── Eventos próprios ─────────────────────────────────────────────────────
    let managedEvents: ManagedEvent[];
    if (isManager || isGlobalChecker) {
      managedEvents = await this.eventRepo.find({
        order: { startAt: 'DESC' },
      });
    } else {
      const staffEventIds = await this.staffRepo.findBy({ memberId: user.sub });
      const ids = staffEventIds.map((s) => s.eventId);
      managedEvents =
        ids.length > 0
          ? await this.eventRepo.findBy({ id: In(ids) })
          : [];
    }

    const staffRows = await this.staffRepo.findBy({ memberId: user.sub });
    const staffRoleByEventId = new Map(
      staffRows.map((s) => [s.eventId, s.staffRole]),
    );

    const managed = managedEvents.map((e) => {
      const staffRole = staffRoleByEventId.get(e.id);
      const canUseList =
        isManager || staffRole === EventStaffRole.HOST;
      return {
        id: e.id,
        title: e.title,
        startAt: new Date(e.startAt).toISOString(),
        status: e.status,
        canUseList,
      };
    });

    // ── Eventos externos ativados ────────────────────────────────────────────
    const allActivations = await this.activationRepo.find({
      order: { createdAt: 'DESC' },
    });
    const ownedScopes = isManager ? [] : await this.eventOrganizerService.getOwnedScopes(user);

    const external = allActivations
      .filter((a) => a.features.includes('checkin'))
      .map((a) => {
        const { sourceKey } = EventsService.parseEventKey(a.eventKey);
        const isOwner =
          isManager ||
          ownedScopes.some(
            (s) => s === a.eventKey || s === `${sourceKey}:*`,
          );
        const isActivator = a.enabledByMemberId === user.sub;
        const canUseList = isOwner || isActivator;
        return {
          eventKey: a.eventKey,
          title: a.title ?? null,
          features: a.features,
          canUseList,
        };
      })
      .filter((a) => a.canUseList || isGlobalChecker);

    return { managed, external };
  }

  /** GET /events/:id — detalhe + contagens */
  async getEvent(id: string, user: JwtPayload) {
    const event = await this.findEventOrFail(id);
    await this.assertCanViewEvent(user, id);
    const [confirmedRegistrations, paidOrders] = await Promise.all([
      this.registrationRepo.countBy({
        eventId: id,
        status: RegistrationStatus.CONFIRMED,
      }),
      this.orderRepo.countBy({ eventId: id, status: OrderStatus.PAID }),
    ]);
    return {
      ...(await this.withRelations(event)),
      counts: { confirmedRegistrations, paidOrders },
    };
  }

  private async findEventOrFail(id: string): Promise<ManagedEvent> {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) throw new NotFoundException('Evento não encontrado.');
    return event;
  }

  /** POST /events — cria draft */
  async createEvent(dto: CreateEventDto, user: JwtPayload) {
    EventsService.assertGlobalManager(user);
    if (!SLUG_REGEX.test(dto.slug)) {
      throw new BadRequestException('slug deve ser kebab-case.');
    }
    const existing = await this.eventRepo.findOneBy({ slug: dto.slug });
    if (existing) {
      throw new ConflictException(`Slug já em uso: ${dto.slug}.`);
    }
    const tz = dto.timezone ?? 'America/Sao_Paulo';
    const event = await this.eventRepo.save(
      this.eventRepo.create({
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary,
        imageUrl: dto.imageUrl ?? null,
        location: dto.location,
        startAt: parseDateTimeLocal(dto.startAt, tz),
        endAt: dto.endAt ? parseDateTimeLocal(dto.endAt, tz) : null,
        timezone: tz,
        communityProjectKey: dto.communityProjectKey,
        capacity: dto.capacity ?? null,
        status: ManagedEventStatus.DRAFT,
        createdByMemberId: user.sub,
      }),
    );
    return this.withRelations(event);
  }

  /** PATCH /events/:id — organizer/admin; host edita dados básicos */
  async updateEvent(id: string, dto: UpdateEventDto, user: JwtPayload) {
    const event = await this.findEventOrFail(id);
    await this.assertCanEditEvent(user, id);

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.summary !== undefined) event.summary = dto.summary;
    if (dto.imageUrl !== undefined) event.imageUrl = dto.imageUrl;
    if (dto.location !== undefined) event.location = dto.location;
    const tz = dto.timezone ?? event.timezone;
    if (dto.startAt !== undefined)
      event.startAt = parseDateTimeLocal(dto.startAt, tz);
    if (dto.endAt !== undefined)
      event.endAt = dto.endAt
        ? parseDateTimeLocal(dto.endAt, tz)
        : null;
    if (dto.timezone !== undefined) event.timezone = dto.timezone;
    if (dto.communityProjectKey !== undefined)
      event.communityProjectKey = dto.communityProjectKey;
    if (dto.capacity !== undefined) event.capacity = dto.capacity;

    await this.eventRepo.save(event);
    return this.withRelations(event);
  }

  /** POST /events/:id/publish — draft → published */
  async publishEvent(id: string, user: JwtPayload) {
    const event = await this.findEventOrFail(id);
    EventsService.assertGlobalManager(user);
    if (event.status !== ManagedEventStatus.DRAFT) {
      throw new BadRequestException(
        `Somente eventos em draft podem ser publicados (atual: ${event.status}).`,
      );
    }
    // Campos mínimos para ir ao ar
    if (!event.title?.trim() || !event.location?.trim() || !event.startAt) {
      throw new BadRequestException(
        'Preencha título, local e data de início antes de publicar.',
      );
    }
    event.status = ManagedEventStatus.PUBLISHED;
    await this.eventRepo.save(event);

    void this.auditService.log({
      action: AuditAction.EVENT_PUBLISHED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: id,
      targetType: 'event',
      details: { slug: event.slug, title: event.title },
    });
    return this.withRelations(event);
  }

  /** POST /events/:id/cancel → canceled */
  async cancelEvent(id: string, user: JwtPayload) {
    const event = await this.findEventOrFail(id);
    EventsService.assertGlobalManager(user);
    if (
      event.status === ManagedEventStatus.CANCELED ||
      event.status === ManagedEventStatus.COMPLETED
    ) {
      throw new BadRequestException(`Evento já está ${event.status}.`);
    }
    event.status = ManagedEventStatus.CANCELED;
    await this.eventRepo.save(event);

    void this.auditService.log({
      action: AuditAction.EVENT_CANCELED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: id,
      targetType: 'event',
      details: { slug: event.slug, title: event.title },
    });
    return this.withRelations(event);
  }

  // ── Ticket types ──────────────────────────────────────────────────────────

  /** POST /events/:id/ticket-types */
  async createTicketType(
    eventId: string,
    dto: CreateTicketTypeDto,
    user: JwtPayload,
  ) {
    const event = await this.findEventOrFail(eventId);
    EventsService.assertGlobalManager(user);
    EventsService.assertPriceMatchesKind(dto.kind, dto.priceCents);

    return this.ticketTypeRepo.save(
      this.ticketTypeRepo.create({
        eventId,
        name: dto.name,
        kind: dto.kind,
        priceCents: dto.priceCents,
        quantityTotal: dto.quantityTotal,
        salesStartAt: dto.salesStartAt
          ? parseDateTimeLocal(dto.salesStartAt, event.timezone)
          : null,
        salesEndAt: dto.salesEndAt
          ? parseDateTimeLocal(dto.salesEndAt, event.timezone)
          : null,
        maxPerOrder: dto.maxPerOrder ?? 1,
      }),
    );
  }

  /** PATCH /events/ticket-types/:id */
  async updateTicketType(
    id: string,
    dto: UpdateTicketTypeDto,
    user: JwtPayload,
  ) {
    const ticketType = await this.ticketTypeRepo.findOneBy({ id });
    if (!ticketType)
      throw new NotFoundException('Tipo de ingresso não encontrado.');
    EventsService.assertGlobalManager(user);

    if (dto.name !== undefined) ticketType.name = dto.name;
    if (dto.priceCents !== undefined) {
      EventsService.assertPriceMatchesKind(ticketType.kind, dto.priceCents);
      ticketType.priceCents = dto.priceCents;
    }
    if (dto.quantityTotal !== undefined) {
      if (dto.quantityTotal < ticketType.quantitySold) {
        throw new BadRequestException(
          `quantityTotal não pode ser menor que o já vendido/reservado (${ticketType.quantitySold}).`,
        );
      }
      ticketType.quantityTotal = dto.quantityTotal;
    }
    if (!ticketType.eventId) {
      throw new BadRequestException(
        'Tipo de ingresso interno deve estar vinculado a um evento.',
      );
    }
    const event = await this.findEventOrFail(ticketType.eventId);
    if (dto.salesStartAt !== undefined) {
      ticketType.salesStartAt = dto.salesStartAt
        ? parseDateTimeLocal(dto.salesStartAt, event.timezone)
        : null;
    }
    if (dto.salesEndAt !== undefined) {
      ticketType.salesEndAt = dto.salesEndAt
        ? parseDateTimeLocal(dto.salesEndAt, event.timezone)
        : null;
    }
    if (dto.maxPerOrder !== undefined) ticketType.maxPerOrder = dto.maxPerOrder;
    if (dto.isActive !== undefined) ticketType.isActive = dto.isActive;

    return this.ticketTypeRepo.save(ticketType);
  }

  private static assertPriceMatchesKind(
    kind: TicketKind,
    priceCents: number,
  ): void {
    if (kind === TicketKind.FREE && priceCents !== 0) {
      throw new BadRequestException('Ingresso free deve ter priceCents = 0.');
    }
    if (kind === TicketKind.PAID && priceCents <= 0) {
      throw new BadRequestException('Ingresso paid deve ter priceCents > 0.');
    }
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  /** POST /events/:id/staff */
  async addStaff(eventId: string, dto: AddStaffDto, user: JwtPayload) {
    await this.findEventOrFail(eventId);
    EventsService.assertGlobalManager(user);

    const member = await this.memberRepo.findOneBy({
      id: dto.memberId,
      isActive: true,
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');

    const existing = await this.staffRepo.findOneBy({
      eventId,
      memberId: dto.memberId,
      staffRole: dto.staffRole,
    });
    if (existing) {
      throw new ConflictException(
        'Membro já é staff deste evento com este papel.',
      );
    }
    const staff = await this.staffRepo.save(
      this.staffRepo.create({
        eventId,
        memberId: dto.memberId,
        staffRole: dto.staffRole,
      }),
    );
    return {
      id: staff.id,
      memberId: staff.memberId,
      staffRole: staff.staffRole,
    };
  }

  /** DELETE /events/:id/staff/:staffId */
  async removeStaff(eventId: string, staffId: string, user: JwtPayload) {
    EventsService.assertGlobalManager(user);
    const staff = await this.staffRepo.findOneBy({ id: staffId, eventId });
    if (!staff) throw new NotFoundException('Staff não encontrado.');
    await this.staffRepo.remove(staff);
    return { removed: true };
  }

  // ── Inscrições (RSVP gratuito) ────────────────────────────────────────────

  /** POST /events/:id/register — conta obrigatória (decisão #2) */
  async register(eventId: string, dto: RegisterDto, user: JwtPayload) {
    const event = await this.findEventOrFail(eventId);
    if (event.status !== ManagedEventStatus.PUBLISHED) {
      throw new BadRequestException('Evento não está publicado.');
    }
    const ticketType = await this.ticketTypeRepo.findOneBy({
      id: dto.ticketTypeId,
      eventId,
    });
    if (!ticketType) {
      throw new NotFoundException('Tipo de ingresso não encontrado.');
    }
    if (ticketType.priceCents > 0) {
      throw new BadRequestException(
        'Ingresso pago: use o checkout (POST /events/:id/checkout).',
      );
    }

    const member = await this.memberRepo.findOneBy({
      id: user.sub,
      isActive: true,
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');

    // Um membro não se inscreve 2× no mesmo evento
    const duplicate = await this.registrationRepo.findOneBy({
      eventId,
      memberId: user.sub,
      status: RegistrationStatus.CONFIRMED,
    });
    if (duplicate) {
      throw new ConflictException('Você já está inscrito neste evento.');
    }

    // Capacity do evento (best-effort — a quota do lote é a trava atômica)
    if (event.capacity !== null) {
      const confirmed = await this.registrationRepo.countBy({
        eventId,
        status: RegistrationStatus.CONFIRMED,
      });
      if (confirmed >= event.capacity) {
        throw new ConflictException('Evento lotado.');
      }
    }

    // Reserva atômica de quota (anti-oversell)
    const reserved = await this.reserveQuota(ticketType.id, 1, false);
    if (!reserved) {
      throw new ConflictException('Lote esgotado.');
    }

    const registration = await this.registrationRepo.save(
      this.registrationRepo.create({
        eventId,
        ticketTypeId: ticketType.id,
        orderId: null,
        memberId: user.sub,
        attendeeName: member.name,
        attendeeEmail: member.email,
        checkinToken: randomUUID(),
        status: RegistrationStatus.CONFIRMED,
      }),
    );
    // E-mail transacional de confirmação (nunca derruba a inscrição)
    void this.emailService
      .sendRegistrationConfirmation(registration, event)
      .catch((error: unknown) =>
        this.logger.warn(
          `Falha ao enviar confirmação da inscrição ${registration.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    return registration;
  }

  /** DELETE /events/registrations/:id — dono, staff do evento ou admin */
  async cancelRegistration(registrationId: string, user: JwtPayload) {
    const registration = await this.registrationRepo.findOneBy({
      id: registrationId,
    });
    if (!registration) throw new NotFoundException('Inscrição não encontrada.');

    const isOwner = registration.memberId === user.sub;
    if (!isOwner) {
      if (registration.eventId) {
        await this.assertCanViewEvent(user, registration.eventId);
      } else if (registration.externalActivationId) {
        const activation = await this.activationRepo.findOneBy({
          id: registration.externalActivationId,
        });
        if (!activation) {
          throw new NotFoundException(
            'Ativação do evento externo não encontrada.',
          );
        }
        await this.assertExternalManager(user, activation, {
          allowActivator: true,
        });
      } else {
        throw new ForbiddenException(
          'Sem permissão para cancelar esta inscrição.',
        );
      }
    }

    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new BadRequestException(
        `Inscrição já está ${registration.status}.`,
      );
    }

    registration.status = RegistrationStatus.CANCELLED;
    await this.registrationRepo.save(registration);
    // Devolve a quota (GREATEST protege contra negativo)
    await this.releaseQuota(registration.ticketTypeId, 1);
    return registration;
  }

  /**
   * GET /events/my-registrations
   *
   * Shape (decisão): inscrições de evento MANAGED trazem `event: {...}` e
   * `activation: null`; inscrições de evento EXTERNO trazem `event: null` e
   * `activation: { eventKey, title }` — o frontend escolhe o título pela
   * chave presente.
   */
  async myRegistrations(user: JwtPayload) {
    const registrations = await this.registrationRepo.find({
      where: [{ memberId: user.sub }, { payerMemberId: user.sub }],
      order: { createdAt: 'DESC' },
    });
    if (registrations.length === 0) return [];

    const eventIds = [
      ...new Set(
        registrations
          .map((r) => r.eventId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const activationIds = [
      ...new Set(
        registrations
          .map((r) => r.externalActivationId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const ticketTypeIds = [
      ...new Set(registrations.map((r) => r.ticketTypeId)),
    ];
    const [events, ticketTypes, activations] = await Promise.all([
      this.eventRepo.findBy({ id: In(eventIds) }),
      this.ticketTypeRepo.findBy({ id: In(ticketTypeIds) }),
      this.activationRepo.findBy({ id: In(activationIds) }),
    ]);
    const eventById = new Map(events.map((e) => [e.id, e]));
    const ticketById = new Map(ticketTypes.map((t) => [t.id, t]));
    const activationById = new Map(activations.map((a) => [a.id, a]));

    return registrations.map((r) => {
      const event = r.eventId ? eventById.get(r.eventId) : undefined;
      const activation = r.externalActivationId
        ? activationById.get(r.externalActivationId)
        : undefined;
      const ticket = ticketById.get(r.ticketTypeId);
      return {
        id: r.id,
        status: r.status,
        checkedInAt: r.checkedInAt,
        checkinToken: r.checkinToken,
        attendeeName: r.attendeeName,
        attendeeEmail: r.attendeeEmail,
        memberId: r.memberId,
        payerMemberId: r.payerMemberId,
        isPayerOnly: r.memberId !== user.sub && r.payerMemberId === user.sub,
        event: r.eventId
          ? {
              id: event?.id ?? r.eventId,
              title: event?.title ?? '',
              startAt: event?.startAt ?? null,
              location: event?.location ?? '',
              status: event?.status ?? '',
            }
          : null,
        activation: r.externalActivationId
          ? {
              eventKey: activation?.eventKey ?? '',
              title: activation?.title ?? activation?.eventKey ?? '',
              startAt: activation?.startAt ?? null,
            }
          : null,
        ticketType: {
          name: ticket?.name ?? '',
          kind: ticket?.kind ?? '',
          priceCents: ticket?.priceCents ?? 0,
        },
      };
    });
  }

  // ── Checkout pago (Stripe) ────────────────────────────────────────────────

  /** POST /events/:id/checkout — reserva quota e cria a sessão Stripe */
  async checkout(eventId: string, dto: CheckoutDto, user: JwtPayload) {
    // Conformidade CDC art. 49: aceite explícito dos termos é obrigatório
    if (dto.acceptTerms !== true) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos de compra e a política de reembolso.',
      );
    }

    const event = await this.findEventOrFail(eventId);
    if (event.status !== ManagedEventStatus.PUBLISHED) {
      throw new BadRequestException('Evento não está publicado.');
    }
    const ticketType = await this.ticketTypeRepo.findOneBy({
      id: dto.ticketTypeId,
      eventId,
    });
    if (!ticketType) {
      throw new NotFoundException('Tipo de ingresso não encontrado.');
    }
    if (ticketType.priceCents <= 0) {
      throw new BadRequestException(
        'Ingresso gratuito: use a inscrição direta (POST /events/:id/register).',
      );
    }
    if (dto.quantity > ticketType.maxPerOrder) {
      throw new BadRequestException(
        `Máximo de ${ticketType.maxPerOrder} ingressos por pedido neste lote.`,
      );
    }

    const member = await this.memberRepo.findOneBy({
      id: user.sub,
      isActive: true,
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');

    await this.assertNotDuplicateTicketForBuyer(
      { eventId, externalActivationId: null },
      dto,
      member,
    );

    return this.executePaidCheckout(
      {
        eventId,
        externalActivationId: null,
        communityProjectKey: event.communityProjectKey,
        eventTitle: event.title,
        eventSlug: event.slug,
      },
      ticketType,
      dto,
      member,
      user,
    );
  }

  /**
   * Núcleo compartilhado do checkout pago (interno e externo): reserva
   * atômica com janela de vendas, order pending (30min) e sessão Stripe.
   * O webhook `checkout.session.completed` baixa por orderId — funciona
   * igual para os dois lados do XOR (eventId/externalActivationId).
   */
  private async executePaidCheckout(
    target: {
      eventId: string | null;
      externalActivationId: string | null;
      communityProjectKey: string;
      eventTitle: string;
      eventSlug?: string | null;
      source?: string;
      sourceId?: string;
    },
    ticketType: TicketType,
    dto: CheckoutDto,
    member: Member,
    user: JwtPayload,
  ): Promise<{ url?: string | null; clientSecret?: string | null }> {
    // Reserva atômica com janela de vendas (SQL do docs/EVENT_PLAN.md §2b)
    const reserved = await this.reserveQuota(ticketType.id, dto.quantity, true);
    if (!reserved) {
      throw new ConflictException('Lote esgotado ou fora da janela de vendas.');
    }

    const attendees = this.normalizeAttendees(dto, member);

    const expiresAt = new Date(
      Date.now() + ORDER_EXPIRATION_MINUTES * 60 * 1000,
    );
    const order = await this.orderRepo.save(
      this.orderRepo.create({
        eventId: target.eventId,
        externalActivationId: target.externalActivationId,
        ticketTypeId: ticketType.id,
        quantity: dto.quantity,
        memberId: user.sub,
        payerMemberId: user.sub,
        attendees: JSON.stringify(attendees),
        totalCents: dto.quantity * ticketType.priceCents,
        status: OrderStatus.PENDING,
        expiresAt,
        termsVersion: EVENT_TICKET_TERMS_VERSION,
      }),
    );

    // Caminho de retorno: página do evento para embedded; /eventos para hosted legado
    const returnPath = this.buildEventReturnPath(target);
    const uiMode: 'hosted' | 'embedded_page' =
      dto.uiMode === 'embedded' ? 'embedded_page' : 'hosted';

    try {
      const session = await this.stripeService.createEventTicketCheckoutSession(
        {
          productName: `${target.eventTitle} — ${ticketType.name}`,
          productDescription: `Ingresso para ${target.eventTitle}`,
          unitAmountCents: ticketType.priceCents,
          quantity: dto.quantity,
          email: member.email,
          metadata: {
            entityType: 'event-ticket',
            ...(target.eventId ? { eventId: target.eventId } : {}),
            orderId: order.id,
            communityId: target.communityProjectKey,
            attendees: JSON.stringify(attendees),
          },
          returnPath,
          uiMode,
        },
      );
      order.stripeSessionId = session.sessionId;
      await this.orderRepo.save(order);
      return uiMode === 'embedded_page'
        ? { clientSecret: session.clientSecret }
        : { url: session.url };
    } catch (error) {
      // Falha no Stripe: desfaz a reserva e cancela a order
      order.status = OrderStatus.CANCELLED;
      await this.orderRepo.save(order);
      await this.releaseQuota(ticketType.id, dto.quantity);
      throw error;
    }
  }

  /**
   * Normaliza a lista de participantes do checkout. Se não informada ou com
   * tamanho diferente de quantity, preenche com os dados do comprador.
   */
  private normalizeAttendees(
    dto: CheckoutDto,
    buyer: Member,
  ): Array<{ name: string; email: string }> {
    const buyerName = buyer.name ?? buyer.githubHandle ?? 'Participante';
    const buyerEmail = buyer.email ?? '';
    if (dto.attendees?.length === dto.quantity) {
      return dto.attendees.map((a) => ({
        name: a.name.trim(),
        email: a.email.trim().toLowerCase(),
      }));
    }
    return Array.from({ length: dto.quantity }, () => ({
      name: buyerName,
      email: buyerEmail,
    }));
  }

  private buildEventReturnPath(target: {
    eventId: string | null;
    externalActivationId: string | null;
    eventSlug?: string | null;
    source?: string;
    sourceId?: string;
  }): string {
    if (target.eventId) {
      return `/eventos/detalhe?source=internal&sourceId=codaqui&id=${target.eventId}`;
    }
    if (target.source && target.sourceId && target.eventSlug) {
      return `/eventos/detalhe?source=${encodeURIComponent(target.source)}&sourceId=${encodeURIComponent(target.sourceId)}&id=${encodeURIComponent(target.eventSlug)}`;
    }
    return '/eventos';
  }

  // ── Refund (admin | event_finance) ────────────────────────────────────────

  /**
   * POST /events/orders/:id/refund
   *
   * - Sem `registrationIds`: estorno TOTAL (Stripe sem `amount` devolve toda a
   *   quantia restante do charge), order → refunded.
   * - Com `registrationIds`: estorno PARCIAL (soma unitária dos ingressos
   *   selecionados). As registrations são marcadas refunded IMEDIATAMENTE e a
   *   quota é devolvida; o webhook `charge.refunded` reconcilia o restante
   *   (status final da order e diferença de ledger, se houver).
   * - O reversal no ledger usa `event-ticket-refund:<orderId>:<ts>`; o webhook
   *   deduz o que já foi lançado aqui para não duplicar.
   */
  async refundOrder(orderId: string, dto: RefundOrderDto, user: JwtPayload) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Somente pedidos pagos podem ser estornados.',
      );
    }
    if (!order.stripePaymentIntentId) {
      throw new BadRequestException('Pedido sem payment intent vinculado.');
    }
    if (!order.eventId) {
      throw new BadRequestException('Pedido sem evento vinculado.');
    }

    const ticketType = await this.ticketTypeRepo.findOneBy({
      id: order.ticketTypeId,
    });
    const unitCents =
      ticketType?.priceCents ?? Math.round(order.totalCents / order.quantity);

    const confirmedRegs = await this.registrationRepo.findBy({
      orderId: order.id,
      status: RegistrationStatus.CONFIRMED,
    });
    if (confirmedRegs.length === 0) {
      throw new BadRequestException(
        'Nenhuma inscrição confirmada para estornar.',
      );
    }

    let targets = confirmedRegs;
    if (dto.registrationIds?.length) {
      const ids = new Set(dto.registrationIds);
      targets = confirmedRegs.filter((r) => ids.has(r.id));
      if (targets.length !== ids.size) {
        throw new BadRequestException(
          'registrationIds inválidos: não pertencem ao pedido ou já foram estornados.',
        );
      }
    }

    const refundingAllRemaining = targets.length === confirmedRegs.length;
    const amountCents = targets.length * unitCents;

    // Sem amount → Stripe devolve toda a quantia restante do charge
    await this.stripeService.createEventTicketRefund(
      order.stripePaymentIntentId,
      refundingAllRemaining ? undefined : amountCents,
    );

    // Marca registrations + devolve quota imediatamente
    await this.registrationRepo.update(
      { id: In(targets.map((t) => t.id)) },
      { status: RegistrationStatus.REFUNDED },
    );
    await this.releaseQuota(order.ticketTypeId, targets.length);

    const remainingConfirmed = confirmedRegs.length - targets.length;
    if (remainingConfirmed === 0) {
      order.status = OrderStatus.REFUNDED;
      await this.orderRepo.save(order);
    }

    // Reversal no ledger (comunidade → conta externa Stripe)
    const event = await this.eventRepo.findOneBy({ id: order.eventId });
    const stripeIncomeAccount =
      await this.ledgerService.getOrCreateCommunityAccount(
        'stripe_income',
        'Stripe Income (External)',
        AccountType.EXTERNAL,
      );
    const communityAccount =
      await this.ledgerService.getOrCreateCommunityAccount(
        event?.communityProjectKey ?? 'tesouro-geral',
        `Comunidade: ${event?.communityProjectKey ?? 'tesouro-geral'}`,
      );
    await this.ledgerService.recordTransaction(
      communityAccount.id,
      stripeIncomeAccount.id,
      amountCents / 100,
      `Estorno de ingressos — ${event?.title ?? order.eventId}`,
      `event-ticket-refund:${order.id}:${Date.now()}`,
      {
        eventId: order.eventId ?? undefined,
        ticketTypeId: order.ticketTypeId,
        orderId: order.id,
        communityProjectKey: event?.communityProjectKey ?? 'tesouro-geral',
        externalActivationId: order.externalActivationId ?? undefined,
      },
    );

    void this.auditService.log({
      action: AuditAction.EVENT_ORDER_REFUNDED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-order',
      details: {
        orderId: order.id,
        eventId: order.eventId,
        registrationIds: targets.map((t) => t.id),
        amountCents,
        full: refundingAllRemaining,
      },
    });

    return {
      refundedRegistrations: targets.length,
      amountCents,
      full: refundingAllRemaining,
      orderStatus: order.status,
    };
  }

  // ── Comprovante ───────────────────────────────────────────────────────────

  /** GET /events/orders/:id/receipt — dono da order ou event_finance/admin */
  async getReceipt(orderId: string, user: JwtPayload) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Pedido não encontrado.');

    const isOwner = order.memberId === user.sub || order.payerMemberId === user.sub;
    const isFinance = !!user.roles?.some(
      (r) => r === MemberRole.ADMIN || r === MemberRole.EVENT_FINANCE,
    );
    if (!isOwner && !isFinance) {
      throw new ForbiddenException('Sem permissão para este comprovante.');
    }
    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Comprovante disponível apenas para pedidos pagos.',
      );
    }

    const [event, ticketType, member] = await Promise.all([
      order.eventId
        ? this.eventRepo.findOneBy({ id: order.eventId })
        : Promise.resolve(null),
      this.ticketTypeRepo.findOneBy({ id: order.ticketTypeId }),
      order.memberId
        ? this.memberRepo.findOneBy({ id: order.memberId })
        : Promise.resolve(null),
    ]);

    const attendees: Array<{ name: string; email: string }> = [];
    if (order.attendees) {
      try {
        const parsed = JSON.parse(order.attendees) as unknown;
        if (Array.isArray(parsed)) {
          attendees.push(
            ...parsed.filter(
              (a): a is { name: string; email: string } =>
                typeof a === 'object' &&
                a !== null &&
                typeof (a as Record<string, unknown>).name === 'string' &&
                typeof (a as Record<string, unknown>).email === 'string',
            ),
          );
        }
      } catch {
        // ignora JSON inválido
      }
    }

    return {
      orderId: order.id,
      eventTitle: event?.title ?? '',
      buyerName: member?.name ?? '',
      buyerEmail: member?.email ?? '',
      attendees,
      items: [
        {
          ticketName: ticketType?.name ?? 'Ingresso',
          quantity: order.quantity,
          unitPriceCents: ticketType?.priceCents ?? 0,
        },
      ],
      totalCents: order.totalCents,
      paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
      termsVersion: order.termsVersion,
      verificationCode: `EVT-${order.id.replaceAll('-', '').slice(0, 10).toUpperCase()}`,
    };
  }

  /** GET /events/:id/orders — admin/organizer/finance/staff do evento */
  async listOrders(eventId: string, user: JwtPayload) {
    await this.assertCanViewEvent(user, eventId);

    const orders = await this.orderRepo.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });

    return this.buildOrderList(orders);
  }

  /** GET /events/external/:eventKey/orders — owner/ativador/admin */
  async listExternalOrders(eventKey: string, user: JwtPayload) {
    const activation = await this.findActivationOrFail(eventKey);

    const canView =
      EventsService.canManageAll(user) ||
      activation.enabledByMemberId === user.sub;
    if (!canView) {
      throw new ForbiddenException('Sem permissão para ver pedidos deste evento.');
    }

    const orders = await this.orderRepo.find({
      where: { externalActivationId: activation.id },
      order: { createdAt: 'DESC' },
    });

    return this.buildOrderList(orders);
  }

  private async buildOrderList(orders: EventOrder[]) {
    const memberIds = [
      ...new Set(orders.map((o) => o.memberId).filter((id): id is string => !!id)),
    ];
    const ticketTypeIds = [
      ...new Set(orders.map((o) => o.ticketTypeId).filter((id): id is string => !!id)),
    ];

    const [members, ticketTypes] = await Promise.all([
      memberIds.length > 0
        ? this.memberRepo.findBy({ id: In(memberIds) })
        : Promise.resolve([]),
      ticketTypeIds.length > 0
        ? this.ticketTypeRepo.findBy({ id: In(ticketTypeIds) })
        : Promise.resolve([]),
    ]);

    const memberById = new Map(members.map((m) => [m.id, m]));
    const ticketById = new Map(ticketTypes.map((t) => [t.id, t]));

    return orders.map((o) => {
      const parsedAttendees: Array<{ name: string; email: string }> = [];
      if (o.attendees) {
        try {
          const parsed = JSON.parse(o.attendees) as unknown;
          if (Array.isArray(parsed)) {
            parsedAttendees.push(
              ...parsed.filter(
                (a): a is { name: string; email: string } =>
                  typeof a === 'object' &&
                  a !== null &&
                  typeof (a as Record<string, unknown>).name === 'string' &&
                  typeof (a as Record<string, unknown>).email === 'string',
              ),
            );
          }
        } catch {
          // ignora JSON inválido
        }
      }
      return {
        id: o.id,
        status: o.status,
        quantity: o.quantity,
        totalCents: o.totalCents,
        paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
        createdAt: new Date(o.createdAt).toISOString(),
        stripePaymentIntentId: o.stripePaymentIntentId,
        member: o.memberId
          ? {
              id: o.memberId,
              name: memberById.get(o.memberId)?.name ?? null,
              email: memberById.get(o.memberId)?.email ?? null,
              handle: memberById.get(o.memberId)?.githubHandle ?? null,
            }
          : null,
        attendees: parsedAttendees,
        ticketType: ticketById.get(o.ticketTypeId)
          ? {
              id: o.ticketTypeId,
              name: ticketById.get(o.ticketTypeId)!.name,
              kind: ticketById.get(o.ticketTypeId)!.kind,
              priceCents: ticketById.get(o.ticketTypeId)!.priceCents,
            }
          : null,
      };
    });
  }

  /**
   * POST /events/orders/reconcile-ledger (admin)
   *
   * Reconcilia orders pagas que não têm transação correspondente no ledger
   * (ex.: webhook falhou silenciosamente antes da correção). Idempotente.
   */
  async reconcilePaidOrdersLedger(user: JwtPayload): Promise<{
    reconciled: number;
    skipped: number;
    errors: string[];
  }> {
    if (!EventsService.canManageAll(user)) {
      throw new ForbiddenException('Apenas admin pode reconciliar o ledger.');
    }

    const paidOrders = await this.orderRepo.find({
      where: { status: OrderStatus.PAID },
      order: { createdAt: 'DESC' },
    });

    let reconciled = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const order of paidOrders) {
      const referenceId = `event-ticket:${order.id}`;
      const existing = await this.txRepo.findOneBy({ referenceId });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        let communityId: string | undefined;
        if (order.eventId) {
          const event = await this.eventRepo.findOneBy({ id: order.eventId });
          communityId = event?.communityProjectKey;
        } else if (order.externalActivationId) {
          const activation = await this.activationRepo.findOneBy({
            id: order.externalActivationId,
          });
          communityId = activation?.communityProjectKey;
        }

        await this.stripeService.recordEventTicketTransaction(
          order,
          communityId,
        );
        reconciled++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`order ${order.id}: ${message}`);
      }
    }

    return { reconciled, skipped, errors };
  }

  // ── Caixa unificado (ledger) ───────────────────────────────────────────────

  /**
   * GET /events/:id/ledger
   *
   * Caixa do evento: transações do ledger filtradas pelo eventId (metadata).
   * Resolve a conta da comunidade pelo communityProjectKey do evento.
   */
  async getEventLedger(
    eventId: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      days?: number;
      search?: string;
      ticketTypeId?: string;
    },
    user: JwtPayload,
  ) {
    const event = await this.findEventOrFail(eventId);
    await this.assertCanViewEvent(user, eventId);

    const account = await this.ledgerService.getAccountByProjectKey(
      event.communityProjectKey ?? 'tesouro-geral',
    );
    if (!account) {
      return { data: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 10, totalPages: 0 };
    }

    return this.ledgerService.getAccountTransactions(
      account.id,
      query.page ?? 1,
      query.limit ?? 10,
      {
        type: query.type,
        days: query.days,
        search: query.search,
        eventId,
        ticketTypeId: query.ticketTypeId,
      },
    );
  }

  /**
   * GET /events/external/:eventKey/ledger
   *
   * Caixa do evento externo: transações do ledger filtradas pela ativação
   * (externalActivationId nos metadados). Resolve a conta pelo communityProjectKey
   * da ativação.
   */
  async getExternalEventLedger(
    eventKey: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      days?: number;
      search?: string;
      ticketTypeId?: string;
    },
    user: JwtPayload,
  ) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation, { allowActivator: true });

    const account = await this.ledgerService.getAccountByProjectKey(
      activation.communityProjectKey ?? 'tesouro-geral',
    );
    if (!account) {
      return { data: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 10, totalPages: 0 };
    }

    return this.ledgerService.getAccountTransactions(
      account.id,
      query.page ?? 1,
      query.limit ?? 10,
      {
        type: query.type,
        days: query.days,
        search: query.search,
        externalActivationId: activation.id,
        ticketTypeId: query.ticketTypeId,
      },
    );
  }

  // ── Reembolso / despesa vinculada a evento ─────────────────────────────────

  /**
   * POST /events/:id/reimbursements
   *
   * Organizer/staff/admin lança uma despesa/reembolso vinculado a um evento
   * próprio. Reutiliza o módulo de reembolsos (mesmo fluxo de aprovação do
   * finance-analyzer/admin). O backend preenche os metadados do evento para
   * rastreamento no ledger.
   */
  async createEventReimbursement(
    eventId: string,
    dto: CreateReimbursementDto,
    user: JwtPayload,
  ): Promise<{ id: string; status: string }> {
    await this.assertCanViewEvent(user, eventId);
    const event = await this.findEventOrFail(eventId);

    const request = await this.reimbursementsService.createEventReimbursement(
      user.sub,
      {
        ...dto,
        eventId,
        eventMetadata: JSON.stringify({
          title: event.title,
          startAt: event.startAt?.toISOString(),
          communityProjectKey: event.communityProjectKey,
        }),
      },
    );
    return { id: request.id, status: request.status };
  }

  /**
   * POST /events/external/:eventKey/reimbursements
   *
   * Owner/ativador/admin lança despesa/reembolso vinculado a um evento externo
   * ativado. O ledger armazena externalActivationId para que a aba "Caixa" do
   * evento externo filtre corretamente.
   */
  async createExternalEventReimbursement(
    eventKey: string,
    dto: CreateReimbursementDto,
    user: JwtPayload,
  ): Promise<{ id: string; status: string }> {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation, { allowActivator: true });

    const request = await this.reimbursementsService.createEventReimbursement(
      user.sub,
      {
        ...dto,
        externalActivationId: activation.id,
        eventMetadata: JSON.stringify({
          title: activation.title ?? eventKey,
          eventKey,
          communityProjectKey: activation.communityProjectKey,
        }),
      },
    );
    return { id: request.id, status: request.status };
  }

  // ── Check-in (2c) ─────────────────────────────────────────────────────────

  /**
   * POST /events/:id/checkin — leitura do QR (checkinToken).
   * Permissão: roles globais admin/event_organizer/event_checker OU staff
   * host/checker do evento. Idempotente: 2ª leitura → already_checked_in.
   */
  async checkin(eventId: string, token: string, user: JwtPayload) {
    const canCheckin =
      EventsService.canManageAll(user) ||
      !!user.roles?.includes(MemberRole.EVENT_CHECKER) ||
      (await this.isStaff(eventId, user.sub, [
        EventStaffRole.HOST,
        EventStaffRole.CHECKER,
      ]));
    if (!canCheckin) {
      throw new ForbiddenException(
        'Sem permissão para fazer check-in neste evento.',
      );
    }
    const registration = await this.registrationRepo.findOneBy({
      eventId,
      checkinToken: token,
    });
    if (!registration) {
      // Token de outro evento também cai aqui — 404 proposital (não vaza existência)
      throw new NotFoundException('Inscrição não encontrada para este evento.');
    }
    return this.performCheckin(registration, user);
  }

  private async performCheckin(
    registration: EventRegistration,
    user: JwtPayload,
  ) {
    const payload = () => ({
      attendeeName: registration.attendeeName,
      attendeeEmail: registration.attendeeEmail,
      checkedInAt: registration.checkedInAt,
    });
    if (registration.checkedInAt) {
      return { status: 'already_checked_in' as const, registration: payload() };
    }
    registration.checkedInAt = new Date();
    registration.checkedInByMemberId = user.sub;
    await this.registrationRepo.save(registration);

    void this.auditService.log({
      action: AuditAction.EVENT_CHECKIN,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: registration.id,
      targetType: 'event-registration',
      details: {
        eventId: registration.eventId,
        externalActivationId: registration.externalActivationId,
        attendeeEmail: registration.attendeeEmail,
      },
    });
    return { status: 'checked_in' as const, registration: payload() };
  }

  /** GET /events/:id/registrations — lista com filtro opcional (nome/e-mail) */
  async listRegistrations(
    eventId: string,
    query: { search?: string },
    user: JwtPayload,
  ) {
    await this.findEventOrFail(eventId);
    await this.assertCanViewEvent(user, eventId);
    const qb = this.registrationRepo
      .createQueryBuilder('r')
      .where('r."eventId" = :eventId', { eventId })
      .orderBy('r."createdAt"', 'ASC');
    if (query.search?.trim()) {
      qb.andWhere(
        '(r."attendeeName" ILIKE :search OR r."attendeeEmail" ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    const rows = await qb.getMany();
    return this.enrichRegistrations(rows);
  }

  private async enrichRegistrations(registrations: EventRegistration[]) {
    const ticketIds = [...new Set(registrations.map((r) => r.ticketTypeId))];
    const orderIds = [
      ...new Set(registrations.map((r) => r.orderId).filter((id): id is string => !!id)),
    ];
    const memberIds = [
      ...new Set(
        registrations
          .flatMap((r) => [r.memberId, r.payerMemberId])
          .filter((id): id is string => !!id),
      ),
    ];
    const [tickets, orders, members] = await Promise.all([
      ticketIds.length ? this.ticketTypeRepo.findBy({ id: In(ticketIds) }) : Promise.resolve([]),
      orderIds.length ? this.orderRepo.findBy({ id: In(orderIds) }) : Promise.resolve([]),
      memberIds.length ? this.memberRepo.findBy({ id: In(memberIds) }) : Promise.resolve([]),
    ]);
    const nameById = new Map(tickets.map((t) => [t.id, t.name]));
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const memberById = new Map(members.map((m) => [m.id, m]));
    return registrations.map((r) => {
      const order = r.orderId ? orderById.get(r.orderId) : undefined;
      const member = r.memberId ? memberById.get(r.memberId) : undefined;
      const payer = r.payerMemberId ? memberById.get(r.payerMemberId) : undefined;
      return {
        ...r,
        ticketType: { name: nameById.get(r.ticketTypeId) ?? null },
        order: order
          ? {
              id: order.id,
              status: order.status,
              totalCents: order.totalCents,
              quantity: order.quantity,
              paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
            }
          : null,
        member: member
          ? {
              id: member.id,
              name: member.name,
              githubHandle: member.githubHandle,
            }
          : null,
        payer: payer
          ? {
              id: payer.id,
              name: payer.name,
              githubHandle: payer.githubHandle,
            }
          : null,
      };
    });
  }

  // ── Certificados (2c) ─────────────────────────────────────────────────────

  private static certificateCode(checkinToken: string): string {
    return `CRT-${checkinToken.slice(0, 12)}`;
  }

  /**
   * GET /events/registrations/:id/certificate — dono da inscrição.
   * Exige check-in feito (403 caso contrário).
   */
  async getCertificate(registrationId: string, user: JwtPayload) {
    const registration = await this.registrationRepo.findOneBy({
      id: registrationId,
    });
    if (!registration) throw new NotFoundException('Inscrição não encontrada.');
    const isOwner =
      registration.memberId !== null && registration.memberId === user.sub;
    if (!isOwner && !EventsService.canManageAll(user)) {
      throw new ForbiddenException('Sem permissão para este certificado.');
    }
    if (!registration.checkedInAt) {
      throw new ForbiddenException(
        'Certificado disponível apenas após o check-in no evento.',
      );
    }

    const details = await this.resolveCertificateEventDetails(registration);

    return {
      attendeeName: registration.attendeeName,
      attendeeEmail: registration.attendeeEmail,
      ...details,
      checkedInAt: registration.checkedInAt,
      issuedAt: new Date().toISOString(),
      verificationCode: EventsService.certificateCode(
        registration.checkinToken,
      ),
    };
  }

  private async resolveCertificateEventDetails(registration: EventRegistration): Promise<{
    eventTitle: string;
    eventStartAt: Date | null;
    eventEndAt: Date | null;
    workloadMinutes: number | null;
    communityProjectKey: string | null;
  }> {
    if (registration.eventId) {
      return this.resolveManagedCertificateDetails(registration.eventId);
    }
    if (registration.externalActivationId) {
      return this.resolveExternalCertificateDetails(
        registration.externalActivationId,
      );
    }
    throw new NotFoundException('Evento da inscrição não encontrado.');
  }

  private async resolveManagedCertificateDetails(eventId: string): Promise<{
    eventTitle: string;
    eventStartAt: Date | null;
    eventEndAt: Date | null;
    workloadMinutes: number | null;
    communityProjectKey: string | null;
  }> {
    const event = await this.eventRepo.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException('Evento não encontrado.');
    const eventStartAt = event.startAt;
    const eventEndAt = event.endAt;
    return {
      eventTitle: event.title,
      eventStartAt,
      eventEndAt,
      // Managed: carga horária = duração do evento
      workloadMinutes: eventEndAt
        ? Math.round((eventEndAt.getTime() - eventStartAt.getTime()) / 60_000)
        : null,
      communityProjectKey: event.communityProjectKey ?? null,
    };
  }

  private async resolveExternalCertificateDetails(
    activationId: string,
  ): Promise<{
    eventTitle: string;
    eventStartAt: Date | null;
    eventEndAt: Date | null;
    workloadMinutes: number | null;
    communityProjectKey: string | null;
  }> {
    const activation = await this.activationRepo.findOneBy({ id: activationId });
    if (!activation) {
      throw new NotFoundException(
        'Ativação do evento externo não encontrada.',
      );
    }
    if (!activation.features.includes('certificates')) {
      throw new ForbiddenException(
        'Este evento não tem a feature de certificados habilitada.',
      );
    }
    return {
      eventTitle: activation.title ?? activation.eventKey,
      eventStartAt: null,
      eventEndAt: null,
      // Externo: sem datas (frontend esconde); carga horária vem do
      // override do eventKey (extendData.workloadMinutes) quando presente
      workloadMinutes: await this.readExternalWorkloadMinutes(
        activation.eventKey,
      ),
      communityProjectKey: activation.communityProjectKey ?? null,
    };
  }

  /**
   * Carga horária de evento externo: lê extendData.workloadMinutes do
   * override do eventKey (branch base). Ausente/inválido → null (nunca
   * derruba a emissão do certificado).
   */
  private async readExternalWorkloadMinutes(
    eventKey: string,
  ): Promise<number | null> {
    try {
      const { sourceKey, eventId } = EventsService.parseEventKey(eventKey);
      const [source, sourceId] = sourceKey.split(':');
      const raw = await this.githubDb.readFile(
        `static/events/${source}/${sourceId}/${eventId}.override.json`,
      );
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        extendData?: { workloadMinutes?: unknown };
      };
      const value = parsed?.extendData?.workloadMinutes;
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 1000
        ? value
        : null;
    } catch {
      return null;
    }
  }

  /** GET /events/certificates/verify/:code — PÚBLICO (autenticidade) */
  async verifyCertificate(code: string) {
    // Sanitiza: só caracteres de uuid/prefixo — evita injection no LIKE
    const sanitized = code
      .replace(/^CRT-/i, '')
      .replaceAll(/[^a-zA-Z0-9-]/g, '');
    if (!sanitized) return { valid: false as const };

    const registration = await this.registrationRepo
      .createQueryBuilder('r')
      .where('r."checkinToken" LIKE :prefix', { prefix: `${sanitized}%` })
      .andWhere('r."checkedInAt" IS NOT NULL')
      .getOne();
    if (!registration) return { valid: false as const };

    let eventTitle = '';
    let eventStartAt: Date | null = null;
    let communityProjectKey: string | null = null;
    if (registration.eventId) {
      const event = await this.eventRepo.findOneBy({
        id: registration.eventId,
      });
      eventTitle = event?.title ?? '';
      eventStartAt = event?.startAt ?? null;
      communityProjectKey = event?.communityProjectKey ?? null;
    } else if (registration.externalActivationId) {
      const activation = await this.activationRepo.findOneBy({
        id: registration.externalActivationId,
      });
      eventTitle = activation?.title ?? activation?.eventKey ?? '';
      communityProjectKey = activation?.communityProjectKey ?? null;
    }
    return {
      valid: true as const,
      attendeeName: registration.attendeeName,
      eventTitle,
      eventStartAt,
      communityProjectKey,
    };
  }

  // ── Relatório do evento (2d) ──────────────────────────────────────────────

  /**
   * GET /events/:id/report — receita vem de event_orders (decisão: soma de
   * paid; refundedCents = soma de refunded). Permissão: global manage OU
   * event_finance OU staff host/finance do evento.
   */
  async getEventReport(eventId: string, user: JwtPayload) {
    await this.findEventOrFail(eventId);
    const allowed =
      EventsService.canManageAll(user) ||
      !!user.roles?.includes(MemberRole.EVENT_FINANCE) ||
      (await this.isStaff(eventId, user.sub, [
        EventStaffRole.HOST,
        EventStaffRole.FINANCE,
      ]));
    if (!allowed) {
      throw new ForbiddenException(
        'Sem permissão para o relatório deste evento.',
      );
    }

    const [registrations, ticketTypes] = await Promise.all([
      this.registrationRepo.findBy({ eventId }),
      this.ticketTypeRepo.findBy({ eventId }),
    ]);
    const revenueRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COALESCE(SUM(o."totalCents"), 0)', 'total')
      .where('o."eventId" = :eventId', { eventId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.PAID, OrderStatus.REFUNDED],
      })
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; total: string }>();

    let revenueCents = 0;
    let refundedCents = 0;
    for (const row of revenueRows) {
      if (row.status === OrderStatus.PAID) revenueCents = Number(row.total);
      if (row.status === OrderStatus.REFUNDED)
        refundedCents = Number(row.total);
    }

    const confirmed = registrations.filter(
      (r) => r.status === RegistrationStatus.CONFIRMED,
    );
    const checkedIn = confirmed.filter((r) => r.checkedInAt !== null);

    const byDayMap = new Map<string, number>();
    for (const r of checkedIn) {
      const day = new Date(r.checkedInAt as Date).toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    }
    const byDay = [...byDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byTicketType = ticketTypes.map((t) => {
      const regs = confirmed.filter((r) => r.ticketTypeId === t.id);
      return {
        ticketTypeId: t.id,
        name: t.name,
        kind: t.kind,
        confirmed: regs.length,
        checkedIn: regs.filter((r) => r.checkedInAt !== null).length,
      };
    });

    return {
      byTicketType,
      byDay,
      revenueCents,
      refundedCents,
      attendance: {
        confirmed: confirmed.length,
        checkedIn: checkedIn.length,
        rate:
          confirmed.length === 0
            ? 0
            : Math.round((checkedIn.length / confirmed.length) * 1000) / 1000,
      },
    };
  }

  /** GET /events/staff-candidates?query= — busca membros para compor staff */
  async searchStaffCandidates(query: string, user: JwtPayload) {
    EventsService.assertGlobalManager(user);
    const trimmed = query?.trim();
    if (!trimmed) return [];
    const members = await this.memberRepo
      .createQueryBuilder('m')
      .select(['m.id', 'm.name', 'm.githubHandle', 'm.avatarUrl', 'm.roles'])
      .where('m."isActive" = true')
      .andWhere('(m.name ILIKE :q OR m."githubHandle" ILIKE :q)', {
        q: `%${trimmed}%`,
      })
      .orderBy('m.name', 'ASC')
      .limit(20)
      .getMany();
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      githubHandle: m.githubHandle,
      avatarUrl: m.avatarUrl,
      roles: m.roles ?? [],
    }));
  }

  // ── Eventos externos à la carte (2d) ──────────────────────────────────────

  /** "<source>:<sourceId>:<eventId>" → { sourceKey, eventId } */
  private static parseEventKey(eventKey: string): {
    sourceKey: string;
    eventId: string;
  } {
    const parts = eventKey.split(':');
    if (parts.length !== 3 || parts.some((p) => !p.trim())) {
      throw new BadRequestException(
        'eventKey inválido — formato esperado: <source>:<sourceId>:<eventId>.',
      );
    }
    return { sourceKey: `${parts[0]}:${parts[1]}`, eventId: parts[2] };
  }

  /**
   * Permissão sobre uma ativação externa: admin/owner do evento (via
   * EventOrganizerOwnership — EventOrganizerService.assertCanManage) ou, se
   * allowActivator, o membro que ativou o evento (staff operacional).
   */
  private async assertExternalManager(
    user: JwtPayload,
    activation: ExternalEventActivation,
    options: { allowActivator?: boolean } = {},
  ): Promise<void> {
    if (options.allowActivator && activation.enabledByMemberId === user.sub) {
      return;
    }
    const { sourceKey, eventId } = EventsService.parseEventKey(
      activation.eventKey,
    );
    await this.eventOrganizerService.assertCanManage(user, sourceKey, eventId);
  }

  private async findActivationOrFail(
    eventKey: string,
  ): Promise<ExternalEventActivation> {
    EventsService.parseEventKey(eventKey); // valida formato
    const activation = await this.activationRepo.findOneBy({ eventKey });
    if (!activation) {
      throw new NotFoundException('Evento externo não ativado.');
    }
    return activation;
  }

  private static assertFeature(
    activation: ExternalEventActivation,
    feature: string,
  ): void {
    if (!activation.features.includes(feature)) {
      throw new ForbiddenException(
        `Feature "${feature}" não habilitada neste evento externo.`,
      );
    }
  }

  /**
   * POST /events/external/:eventKey/activate — upsert da ativação.
   * Auth: owner do evento (EventOrganizerOwnership) ou admin. `certificates`
   * implica `checkin` (adicionado automaticamente — decisão documentada).
   */
  async activateExternal(
    eventKey: string,
    dto: ActivateExternalDto,
    user: JwtPayload,
  ) {
    const { sourceKey, eventId } = EventsService.parseEventKey(eventKey);
    await this.eventOrganizerService.assertCanManage(user, sourceKey, eventId);

    if (!dto.communityProjectKey?.trim()) {
      throw new BadRequestException('communityProjectKey é obrigatório.');
    }
    const invalid = dto.features.filter(
      (f) => !(EXTERNAL_EVENT_FEATURES as readonly string[]).includes(f),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Features inválidas: ${invalid.join(', ')}. Válidas: ${EXTERNAL_EVENT_FEATURES.join(', ')}.`,
      );
    }
    const features = [...new Set(dto.features)];
    // Certificado exige check-in (a emissão depende do checkedInAt)
    if (features.includes('certificates') && !features.includes('checkin')) {
      features.push('checkin');
    }

    const existing = await this.activationRepo.findOneBy({ eventKey });
    const activation = existing ?? this.activationRepo.create({ eventKey });
    activation.features = features;
    activation.communityProjectKey = dto.communityProjectKey;
    // Title/startAt só são atualizados quando enviados (o frontend manda os
    // valores do snapshot; chamadas sem esses campos preservam o anterior)
    if (dto.title !== undefined) activation.title = dto.title;
    if (dto.startAt !== undefined)
      activation.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (!existing) activation.enabledByMemberId = user.sub;
    const saved = await this.activationRepo.save(activation);

    void this.auditService.log({
      action: AuditAction.EVENT_ACTIVATION_SAVED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: saved.id,
      targetType: 'external-event-activation',
      details: {
        eventKey,
        features: saved.features,
        communityProjectKey: saved.communityProjectKey,
        created: !existing,
      },
    });
    return saved;
  }

  /** GET /events/external/:eventKey/activation */
  async getActivation(eventKey: string, user: JwtPayload) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation, {
      allowActivator: true,
    });
    return activation;
  }

  // ── Importação CSV de participantes (2d) ──────────────────────────────────

  /** Match do identificador: com '@' → e-mail; sem '@' → githubHandle. */
  private async findMemberByIdentifier(
    identifier: string,
  ): Promise<Member | null> {
    const value = identifier.trim().toLowerCase();
    if (!value) return null;
    if (value.includes('@')) {
      // 1) E-mail primário (case-insensitive)
      const byPrimary = await this.memberRepo
        .createQueryBuilder('m')
        .where('lower(m.email) = :value', { value })
        .andWhere('m."isActive" = true')
        .getOne();
      if (byPrimary) return byPrimary;

      // 2) Qualquer e-mail secundário verificado do GitHub
      const bySecondary = await this.memberRepo
        .createQueryBuilder('m')
        .where(
          'EXISTS (SELECT 1 FROM unnest(m."secondaryEmails") e WHERE lower(e) = :value)',
          { value },
        )
        .andWhere('m."isActive" = true')
        .getOne();
      if (bySecondary) return bySecondary;

      this.logger.debug(
        `Match de participante: nenhuma conta ativa encontrada para ${value}`,
      );
      return null;
    }
    const rows = await this.memberRepo
      .createQueryBuilder('m')
      .where('lower(m."githubHandle") = :value', { value })
      .andWhere('m."isActive" = true')
      .getMany();
    return rows[0] ?? null;
  }

  /** Ticket type de importação: find-or-create por nome (FREE, quota folgada). */
  private async findOrCreateImportTicketType(
    activationId: string,
    ticketTypeName: string | undefined,
    cache: Map<string, TicketType>,
  ): Promise<TicketType> {
    const name = ticketTypeName ? `Importado — ${ticketTypeName}` : 'Importado';
    const cached = cache.get(name);
    if (cached) return cached;
    let ticketType = await this.ticketTypeRepo.findOneBy({
      externalActivationId: activationId,
      name,
    });
    ticketType ??= await this.ticketTypeRepo.save(
      this.ticketTypeRepo.create({
        eventId: null,
        externalActivationId: activationId,
        name,
        kind: TicketKind.FREE,
        priceCents: 0,
        quantityTotal: 1_000_000,
      }),
    );
    cache.set(name, ticketType);
    return ticketType;
  }

  /**
   * POST /events/external/:eventKey/participants/import — body = CSV cru.
   * Re-upload não duplica: dedupe por (externalSource|externalId) e por
   * e-mail/identificador (case-insensitive).
   */
  async importParticipants(
    eventKey: string,
    csvText: string,
    user: JwtPayload,
  ) {
    const activation = await this.findActivationOrFail(eventKey);
    EventsService.assertFeature(activation, 'checkin');
    await this.assertExternalManager(user, activation, {
      allowActivator: true,
    });

    const rows = await this.parseImportCsv(csvText);
    const { sourceKey } = EventsService.parseEventKey(eventKey);

    const existing = await this.registrationRepo.findBy({
      externalActivationId: activation.id,
    });
    const [seenExternal, seenIdentifier] = this.buildImportDedupeSets(
      existing,
      sourceKey,
    );

    const ctx: ImportContext = {
      activation,
      sourceKey,
      seenExternal,
      seenIdentifier,
      existing,
      ticketCache: new Map<string, TicketType>(),
      ticketIncrements: new Map<string, number>(),
      toSave: [],
      unmatched: [],
      errors: [],
      matched: 0,
      healed: 0,
      skippedDuplicates: 0,
      user,
    };

    for (const row of rows) {
      await this.processImportRow(row, ctx);
    }

    await this.persistImportedRegistrations(ctx.toSave, ctx.ticketIncrements);

    void this.auditService.log({
      action: AuditAction.EVENT_PARTICIPANTS_IMPORTED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: activation.id,
      targetType: 'external-event-activation',
      details: {
        eventKey,
        imported: ctx.toSave.length,
        matched: ctx.matched,
        healed: ctx.healed,
        skippedDuplicates: ctx.skippedDuplicates,
        errors: ctx.errors.length,
      },
    });

    return {
      imported: ctx.toSave.length,
      matched: ctx.matched,
      healed: ctx.healed,
      unmatched: ctx.unmatched,
      skippedDuplicates: ctx.skippedDuplicates,
      errors: ctx.errors,
    };
  }

  private async processImportRow(
    row: ParsedCsvRow,
    ctx: ImportContext,
  ): Promise<void> {
    const validationError = this.validateImportRow(row);
    if (validationError) {
      ctx.errors.push(validationError);
      return;
    }

    const identifier = row.email.toLowerCase();
    if (
      row.externalId &&
      ctx.seenExternal.has(`${ctx.sourceKey}|${row.externalId}`)
    ) {
      ctx.skippedDuplicates += 1;
      return;
    }

    if (ctx.seenIdentifier.has(identifier)) {
      const wasHealed = await this.tryHealDuplicateRegistration(
        row,
        ctx.existing,
      );
      if (wasHealed) {
        ctx.healed += 1;
        return;
      }
      ctx.skippedDuplicates += 1;
      return;
    }

    const member = await this.resolveImportMember(row);
    const ticketType = await this.findOrCreateImportTicketType(
      ctx.activation.id,
      row.ticketType,
      ctx.ticketCache,
    );

    ctx.toSave.push(
      this.registrationRepo.create({
        eventId: null,
        externalActivationId: ctx.activation.id,
        externalSource: ctx.sourceKey,
        externalId: row.externalId ?? null,
        ticketTypeId: ticketType.id,
        orderId: null,
        memberId: member?.id ?? null,
        attendeeName: row.name,
        attendeeEmail: row.email,
        checkinToken: randomUUID(),
        status: member
          ? RegistrationStatus.CONFIRMED
          : RegistrationStatus.PENDING_MATCH,
      }),
    );
    ctx.seenIdentifier.add(identifier);
    if (row.externalId) ctx.seenExternal.add(`${ctx.sourceKey}|${row.externalId}`);
    ctx.ticketIncrements.set(
      ticketType.id,
      (ctx.ticketIncrements.get(ticketType.id) ?? 0) + 1,
    );
    if (member) {
      ctx.matched += 1;
    } else {
      ctx.unmatched.push({ line: row.line, email: row.email });
    }
  }

  private async parseImportCsv(csvText: string): Promise<ParsedCsvRow[]> {
    try {
      return parseCsvText(csvText);
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private buildImportDedupeSets(
    existing: EventRegistration[],
    sourceKey: string,
  ): [Set<string>, Set<string>] {
    const seenExternal = new Set(
      existing
        .filter((r) => r.externalSource && r.externalId)
        .map((r) => `${r.externalSource}|${r.externalId}`),
    );
    const seenIdentifier = new Set(
      existing.map((r) => r.attendeeEmail.toLowerCase()),
    );
    return [seenExternal, seenIdentifier];
  }

  private validateImportRow(
    row: ParsedCsvRow,
  ): { line: number; reason: string } | null {
    if (!row.name) return { line: row.line, reason: 'name vazio' };
    if (!row.email) return { line: row.line, reason: 'email vazio' };
    return null;
  }

  private async tryHealDuplicateRegistration(
    row: ParsedCsvRow,
    existing: EventRegistration[],
  ): Promise<boolean> {
    // Healing: linha já importada e PENDENTE de match — se o novo CSV
    // trouxer a coluna `github` com match, vincula em vez de só ignorar.
    if (!row.github) return false;
    const identifier = row.email.toLowerCase();
    const stuck = existing.find(
      (r) =>
        r.attendeeEmail.toLowerCase() === identifier &&
        r.status === RegistrationStatus.PENDING_MATCH,
    );
    if (!stuck) return false;
    const healer = await this.findMemberByIdentifier(row.github);
    if (!healer) return false;
    stuck.memberId = healer.id;
    stuck.status = RegistrationStatus.CONFIRMED;
    await this.registrationRepo.save(stuck);
    return true;
  }

  private async resolveImportMember(
    row: ParsedCsvRow,
  ): Promise<Member | null> {
    // Match: e-mail da conta; se não achar, tenta a coluna opcional
    // `github` (handle) — decisão de design #2 do docs/EVENT_PLAN.md.
    let member = await this.findMemberByIdentifier(row.email);
    if (!member && row.github) {
      member = await this.findMemberByIdentifier(row.github);
    }
    return member;
  }

  private async persistImportedRegistrations(
    toSave: EventRegistration[],
    ticketIncrements: Map<string, number>,
  ): Promise<void> {
    if (toSave.length === 0) return;
    await this.registrationRepo.save(toSave);
    // quantitySold += n por ticket type (uma query por tipo)
    for (const [ticketTypeId, n] of ticketIncrements) {
      await this.ticketTypeRepo.query(
        `UPDATE ticket_types SET "quantitySold" = "quantitySold" + $1 WHERE id = $2`,
        [n, ticketTypeId],
      );
    }
  }

  /**
   * POST /events/external/:eventKey/participants/rematch — re-tenta o match
   * das inscrições pending_match (depois que participantes se cadastraram).
   */
  async rematchParticipants(eventKey: string, user: JwtPayload) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation, {
      allowActivator: true,
    });

    const pending = await this.registrationRepo.findBy({
      externalActivationId: activation.id,
      status: RegistrationStatus.PENDING_MATCH,
    });
    let rematched = 0;
    for (const registration of pending) {
      const member = await this.findMemberByIdentifier(
        registration.attendeeEmail,
      );
      if (!member) continue;
      registration.memberId = member.id;
      registration.status = RegistrationStatus.CONFIRMED;
      await this.registrationRepo.save(registration);
      rematched += 1;
    }
    return { rematched, stillUnmatched: pending.length - rematched };
  }

  /**
   * Hook chamado pelo MembersService quando um membro é CRIADO: resolve
   * inscrições pending_match cujo identificador bate com o e-mail ou o
   * githubHandle do novo membro. Nunca lança.
   */
  async rematchPendingRegistrationsForMember(member: Member): Promise<number> {
    // Match por e-mail primário, qualquer secundário verificado ou githubHandle
    const identifiers = [
      member.email.toLowerCase(),
      member.githubHandle.toLowerCase(),
      ...(member.secondaryEmails ?? []).map((e) => e.toLowerCase()),
    ];
    const pending = await this.registrationRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: RegistrationStatus.PENDING_MATCH })
      .andWhere('lower(r."attendeeEmail") IN (:...identifiers)', { identifiers })
      .getMany();
    for (const registration of pending) {
      registration.memberId = member.id;
      registration.status = RegistrationStatus.CONFIRMED;
      await this.registrationRepo.save(registration);
    }
    if (pending.length > 0) {
      this.logger.log(
        `Rematch no cadastro: ${pending.length} inscrição(ões) vinculada(s) a @${member.githubHandle}`,
      );
    }
    return pending.length;
  }

  /** GET /events/external/:eventKey/participants */
  async listExternalParticipants(
    eventKey: string,
    query: { search?: string },
    user: JwtPayload,
  ) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation, {
      allowActivator: true,
    });
    const qb = this.registrationRepo
      .createQueryBuilder('r')
      .where('r."externalActivationId" = :activationId', {
        activationId: activation.id,
      })
      .orderBy('r."createdAt"', 'ASC');
    if (query.search?.trim()) {
      qb.andWhere(
        '(r."attendeeName" ILIKE :search OR r."attendeeEmail" ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    const rows = await qb.getMany();
    return this.enrichRegistrations(rows);
  }

  /**
   * POST /events/external/:eventKey/checkin — staff = quem ativou o evento
   * ou admin/owner (EventOrganizerOwnership). Exige feature "checkin".
   */
  async checkinExternal(eventKey: string, token: string, user: JwtPayload) {
    const activation = await this.findActivationOrFail(eventKey);
    EventsService.assertFeature(activation, 'checkin');
    await this.assertExternalManager(user, activation, {
      allowActivator: true,
    });

    const registration = await this.registrationRepo.findOneBy({
      externalActivationId: activation.id,
      checkinToken: token,
    });
    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada para este evento.');
    }
    return this.performCheckin(registration, user);
  }

  // ── Ingressos de evento EXTERNO (feature "payments") ─────────────────────

  private static serializePublicTicketType(t: TicketType) {
    return {
      id: t.id,
      name: t.name,
      kind: t.kind,
      priceCents: t.priceCents,
      quantityTotal: t.quantityTotal,
      quantitySold: t.quantitySold,
      salesStartAt: t.salesStartAt,
      salesEndAt: t.salesEndAt,
      maxPerOrder: t.maxPerOrder,
    };
  }

  /** GET /events/external/:eventKey/ticket-types — PÚBLICO (só ativos) */
  async listExternalTicketTypes(eventKey: string) {
    const activation = await this.findActivationOrFail(eventKey);
    if (!activation.features.includes('payments')) {
      // 404 (não 403): a rota pública não diferencia "não existe" de "sem feature"
      throw new NotFoundException(
        'Evento externo sem venda de ingressos habilitada.',
      );
    }
    const ticketTypes = await this.ticketTypeRepo.find({
      where: { externalActivationId: activation.id, isActive: true },
      order: { priceCents: 'ASC' },
    });
    return ticketTypes.map((t) => EventsService.serializePublicTicketType(t));
  }

  /** GET /events/external/:eventKey/ticket-types/manage — owner/admin (todos) */
  async listExternalTicketTypesManage(eventKey: string, user: JwtPayload) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation);
    return this.ticketTypeRepo.find({
      where: { externalActivationId: activation.id },
      order: { priceCents: 'ASC' },
    });
  }

  /** POST /events/external/:eventKey/ticket-types — owner/admin (exige payments) */
  async createExternalTicketType(
    eventKey: string,
    dto: CreateTicketTypeDto,
    user: JwtPayload,
  ) {
    const activation = await this.findActivationOrFail(eventKey);
    await this.assertExternalManager(user, activation);
    EventsService.assertFeature(activation, 'payments');
    EventsService.assertPriceMatchesKind(dto.kind, dto.priceCents);

    return this.ticketTypeRepo.save(
      this.ticketTypeRepo.create({
        eventId: null,
        externalActivationId: activation.id,
        name: dto.name,
        kind: dto.kind,
        priceCents: dto.priceCents,
        quantityTotal: dto.quantityTotal,
        salesStartAt: dto.salesStartAt
          ? parseDateTimeLocal(dto.salesStartAt, 'America/Sao_Paulo')
          : null,
        salesEndAt: dto.salesEndAt
          ? parseDateTimeLocal(dto.salesEndAt, 'America/Sao_Paulo')
          : null,
        maxPerOrder: dto.maxPerOrder ?? 1,
      }),
    );
  }

  /** PATCH /events/external/ticket-types/:id — owner/admin (parcial) */
  async updateExternalTicketType(
    id: string,
    dto: UpdateTicketTypeDto,
    user: JwtPayload,
  ) {
    const ticketType = await this.ticketTypeRepo.findOneBy({ id });
    if (!ticketType?.externalActivationId) {
      throw new NotFoundException(
        'Tipo de ingresso de evento externo não encontrado.',
      );
    }
    const activation = await this.activationRepo.findOneBy({
      id: ticketType.externalActivationId,
    });
    if (!activation) {
      throw new NotFoundException('Ativação do evento externo não encontrada.');
    }
    await this.assertExternalManager(user, activation);

    if (dto.name !== undefined) ticketType.name = dto.name;
    if (dto.priceCents !== undefined) {
      EventsService.assertPriceMatchesKind(ticketType.kind, dto.priceCents);
      ticketType.priceCents = dto.priceCents;
    }
    if (dto.quantityTotal !== undefined) {
      if (dto.quantityTotal < ticketType.quantitySold) {
        throw new BadRequestException(
          `quantityTotal não pode ser menor que o já vendido/reservado (${ticketType.quantitySold}).`,
        );
      }
      ticketType.quantityTotal = dto.quantityTotal;
    }
    if (dto.salesStartAt !== undefined) {
      ticketType.salesStartAt = dto.salesStartAt
        ? parseDateTimeLocal(dto.salesStartAt, 'America/Sao_Paulo')
        : null;
    }
    if (dto.salesEndAt !== undefined) {
      ticketType.salesEndAt = dto.salesEndAt
        ? parseDateTimeLocal(dto.salesEndAt, 'America/Sao_Paulo')
        : null;
    }
    if (dto.maxPerOrder !== undefined) ticketType.maxPerOrder = dto.maxPerOrder;
    if (dto.isActive !== undefined) ticketType.isActive = dto.isActive;

    return this.ticketTypeRepo.save(ticketType);
  }

  /**
   * POST /events/external/:eventKey/checkout — mesma máquina do checkout
   * interno (executePaidCheckout); ledger cai na conta communityProjectKey
   * DA ATIVAÇÃO (metadata.communityId → webhook).
   */
  async checkoutExternal(eventKey: string, dto: CheckoutDto, user: JwtPayload) {
    if (dto.acceptTerms !== true) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos de compra e a política de reembolso.',
      );
    }
    const activation = await this.findActivationOrFail(eventKey);
    EventsService.assertFeature(activation, 'payments');

    const ticketType = await this.ticketTypeRepo.findOneBy({
      id: dto.ticketTypeId,
      externalActivationId: activation.id,
    });
    if (!ticketType) {
      throw new NotFoundException('Tipo de ingresso não encontrado.');
    }
    if (ticketType.priceCents <= 0) {
      throw new BadRequestException(
        'Ingresso gratuito: use a inscrição/RSVP da fonte do evento.',
      );
    }
    if (dto.quantity > ticketType.maxPerOrder) {
      throw new BadRequestException(
        `Máximo de ${ticketType.maxPerOrder} ingressos por pedido neste lote.`,
      );
    }

    const member = await this.memberRepo.findOneBy({
      id: user.sub,
      isActive: true,
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');

    await this.assertNotDuplicateTicketForBuyer(
      { eventId: null, externalActivationId: activation.id },
      dto,
      member,
    );

    const { sourceKey, eventId: externalEventId } =
      EventsService.parseEventKey(eventKey);
    const [source, sourceId] = sourceKey.split(':');

    return this.executePaidCheckout(
      {
        eventId: null,
        externalActivationId: activation.id,
        communityProjectKey: activation.communityProjectKey,
        eventTitle: activation.title ?? eventKey,
        source,
        sourceId,
        eventSlug: externalEventId,
      },
      ticketType,
      dto,
      member,
      user,
    );
  }

  // ── Histórico PÚBLICO de participações ────────────────────────────────────

  /**
   * GET /events/members/:memberId/registrations — participações públicas do
   * membro (perfil). Só status confirmed/refunded; NUNCA expõe checkinToken,
   * e-mail ou attendeeName (o nome vem do perfil público do membro).
   * verificationCode só quando houve check-in (publicamente verificável).
   */
  async listMemberRegistrations(memberId: string) {
    const registrations = await this.registrationRepo.find({
      where: {
        memberId,
        status: In([
          RegistrationStatus.CONFIRMED,
          RegistrationStatus.REFUNDED,
        ]),
      },
      order: { createdAt: 'DESC' },
    });
    if (registrations.length === 0) return [];

    const eventIds = [
      ...new Set(
        registrations
          .map((r) => r.eventId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const activationIds = [
      ...new Set(
        registrations
          .map((r) => r.externalActivationId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const [events, activations] = await Promise.all([
      this.eventRepo.findBy({ id: In(eventIds) }),
      this.activationRepo.findBy({ id: In(activationIds) }),
    ]);
    const eventById = new Map(events.map((e) => [e.id, e]));
    const activationById = new Map(activations.map((a) => [a.id, a]));

    return registrations
      .map((r) => {
        const event = r.eventId ? eventById.get(r.eventId) : undefined;
        const activation = r.externalActivationId
          ? activationById.get(r.externalActivationId)
          : undefined;
        const eventStartAt =
          event?.startAt ?? activation?.startAt ?? null;
        return {
          id: r.id,
          memberId: r.memberId,
          payerMemberId: r.payerMemberId,
          attendeeName: r.attendeeName,
          eventTitle:
            event?.title ?? activation?.title ?? activation?.eventKey ?? '',
          eventStartAt,
          checkedIn: r.checkedInAt !== null,
          status: r.status,
          verificationCode: r.checkedInAt
            ? EventsService.certificateCode(r.checkinToken)
            : null,
          eventId: r.eventId,
          eventKey: r.externalActivationId ? activation?.eventKey : undefined,
          _sortAt: eventStartAt ?? r.createdAt,
        };
      })
      .sort((a, b) => b._sortAt.getTime() - a._sortAt.getTime())
      .map(({ _sortAt: _, ...entry }) => entry);
  }

  // ── Ativações externas visíveis (2d — tela de check-in) ──────────────────

  /**
   * GET /events/external/activations — admin vê todas; demais membros veem
   * as que ativaram (enabledByMemberId) ou cobertas por ownership
   * (EventOrganizerOwnership).
   */
  async listActivations(user: JwtPayload) {
    const all = await this.activationRepo.find({
      order: { createdAt: 'DESC' },
    });
    let visible = all;
    if (!user.roles?.includes(MemberRole.ADMIN)) {
      const scopes = await this.eventOrganizerService.getOwnedScopes(user);
      visible = all.filter((a) => {
        if (a.enabledByMemberId === user.sub) return true;
        const { sourceKey } = EventsService.parseEventKey(a.eventKey);
        return scopes.some((s) => s === a.eventKey || s === `${sourceKey}:*`);
      });
    }
    return visible.map((a) => ({
      id: a.id,
      eventKey: a.eventKey,
      features: a.features,
      communityProjectKey: a.communityProjectKey,
      title: a.title,
      enabledByMemberId: a.enabledByMemberId,
    }));
  }

  /** GET /events/public/activations — ativações de features para a página pública. */
  async listPublicActivations() {
    const all = await this.activationRepo.find({
      order: { createdAt: 'DESC' },
    });
    return all.map((a) => ({
      eventKey: a.eventKey,
      features: a.features,
      communityProjectKey: a.communityProjectKey,
    }));
  }

  // ── Force-sync do snapshot internal:codaqui (GitHub-as-DB) ───────────────

  /** Diretório da fonte internal no repositório (snapshots estáticos) */
  private static readonly INTERNAL_DIR = 'static/events/internal/codaqui';
  private static readonly INTERNAL_SOURCE_KEY = 'internal:codaqui';
  /** Mesma string do writeSourceOutputs em scripts/sync-events.mjs */
  private static readonly INTERNAL_REFRESH_STRATEGY =
    'Workflow periodico consulta a API da fonte, gera um indice leve para a UI e salva um arquivo por evento para detalhe e cache.';

  /**
   * POST /events/internal/snapshot — força a regeneração dos arquivos da
   * fonte internal:codaqui (sem esperar o sync de hora em hora do workflow).
   * Escreve N arquivos em UM ÚNICO PR (branch event-sync/internal-<ts>):
   * index da fonte + um <id>.json por evento publicado (delete dos órfãos)
   * + o index.json raiz com a seção internal substituída.
   */
  async syncInternalSnapshot(user: JwtPayload) {
    EventsService.assertGlobalManager(user);
    const userToken = await this.eventOrganizerService.requireUserToken(
      user.sub,
    );

    // Mesmo payload de GET /events/public/managed (shape EventSourceConfig + EventItem[])
    const { source, events } = await this.getPublicManagedEvents();
    const generatedAt = new Date().toISOString();

    const dirEntries =
      (await this.githubDb.listDir(EventsService.INTERNAL_DIR, userToken)) ??
      [];
    const overrideIds = new Set(
      dirEntries
        .filter((e) => e.name.endsWith('.override.json'))
        .map((e) => e.name.slice(0, -'.override.json'.length)),
    );
    const existingEventFiles = dirEntries
      .filter(
        (e) =>
          e.name.endsWith('.json') &&
          e.name !== 'index.json' &&
          !e.name.endsWith('.override.json'),
      )
      .map((e) => e.name);

    // Nada publicado e nada no repo → não abre PR
    if (events.length === 0 && dirEntries.length === 0) {
      return { skipped: true as const };
    }

    // sourceMeta/summaries espelham writeSourceOutputs (scripts/sync-events.mjs)
    const sourceMeta = {
      ...source,
      refreshStrategy: EventsService.INTERNAL_REFRESH_STRATEGY,
      generatedAt,
    };
    const summaries = events
      .map(
        (event): Record<string, unknown> => ({
          ...event,
          source: 'internal',
          sourceId: 'codaqui',
          sourceKey: EventsService.INTERNAL_SOURCE_KEY,
          itemPath: `/events/internal/codaqui/${String(event.id)}.json`,
          hasOverride: overrideIds.has(String(event.id)),
        }),
      )
      .sort(
        (a, b) =>
          new Date(a.startAt as string).getTime() -
          new Date(b.startAt as string).getTime(),
      );
    const sourceSummary = {
      ...sourceMeta,
      sourceKey: EventsService.INTERNAL_SOURCE_KEY,
      indexPath: '/events/internal/codaqui/index.json',
      itemCount: summaries.length,
    };

    const files: Array<{ path: string; content: string | null }> = [];
    for (const event of events) {
      files.push({
        path: `${EventsService.INTERNAL_DIR}/${String(event.id)}.json`,
        content: `${JSON.stringify({ generatedAt, source: sourceMeta, event }, null, 2)}\n`,
      });
    }
    files.push({
      path: `${EventsService.INTERNAL_DIR}/index.json`,
      content: `${JSON.stringify({ generatedAt, source: sourceSummary, events: summaries }, null, 2)}\n`,
    });

    // Arquivos de evento que sumiram (despublicados) → delete
    const publishedFiles = new Set(
      events.map((event) => `${String(event.id)}.json`),
    );
    for (const name of existingEventFiles) {
      if (!publishedFiles.has(name)) {
        files.push({
          path: `${EventsService.INTERNAL_DIR}/${name}`,
          content: null,
        });
      }
    }

    // Patch do index.json raiz: preserva as demais fontes
    const rootRaw = await this.githubDb.readFile('static/events/index.json');
    let root: {
      generatedAt?: string;
      sources?: Array<Record<string, unknown>>;
      events?: Array<Record<string, unknown>>;
    } = { sources: [], events: [] };
    if (rootRaw) {
      try {
        root = JSON.parse(rootRaw) as typeof root;
      } catch {
        this.logger.warn(
          'index.json raiz inválido no repositório — regenerando do zero',
        );
      }
    }
    root.generatedAt = generatedAt;
    root.sources = [
      ...(root.sources ?? []).filter(
        (s) => s.sourceKey !== EventsService.INTERNAL_SOURCE_KEY,
      ),
      sourceSummary,
    ];
    root.events = [
      ...(root.events ?? []).filter(
        (e) => e.sourceKey !== EventsService.INTERNAL_SOURCE_KEY,
      ),
      ...summaries,
    ].sort(
      (a, b) =>
        new Date(a.startAt as string).getTime() -
        new Date(b.startAt as string).getTime(),
    );
    files.push({
      path: 'static/events/index.json',
      content: `${JSON.stringify(root, null, 2)}\n`,
    });

    const pr = await this.githubDb.createPRWithFiles({
      branch: `event-sync/internal-${Date.now()}`,
      files,
      commitMessage: `event: sync internal snapshot by @${user.handle}`,
      prTitle: `event: sync internal snapshot by @${user.handle}`,
      actorHandle: user.handle,
      userToken,
      labels: ['event-override'],
    });

    void this.auditService.log({
      action: AuditAction.EVENT_INTERNAL_SYNCED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetType: 'event-sync',
      details: {
        prNumber: pr.prNumber,
        files: files.length,
        events: events.length,
      },
    });

    return { prNumber: pr.prNumber, prUrl: pr.prUrl, events: events.length };
  }

  // ── Cron: expiração de orders pendentes ───────────────────────────────────

  /** A cada 5 min: orders pending vencidas → expired + devolução de quota */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePendingOrders(): Promise<void> {
    const expired = await this.orderRepo.findBy({
      status: OrderStatus.PENDING,
      expiresAt: LessThan(new Date()),
    });
    for (const order of expired) {
      try {
        order.status = OrderStatus.EXPIRED;
        await this.orderRepo.save(order);
        await this.releaseQuota(order.ticketTypeId, order.quantity);
        this.logger.log(
          `⏰ Order ${order.id} expirada — ${order.quantity} vaga(s) devolvida(s) ao lote ${order.ticketTypeId}`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        this.logger.error(`Falha ao expirar order ${order.id}: ${message}`);
      }
    }
  }
}
