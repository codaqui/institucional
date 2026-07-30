import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ManagedEvent,
  ManagedEventStatus,
} from '../events/entities/managed-event.entity';
import {
  EventRegistration,
  RegistrationStatus,
} from '../events/entities/event-registration.entity';
import { Member } from '../members/entities/member.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { SmtpEmailProvider } from './email.provider';
import { EmailLog, EmailStatus } from './entities/email-log.entity';

export const EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION =
  'event-registration-confirmation';
export const EMAIL_TEMPLATE_REMINDER_D1 = 'event-reminder-d1';
export const EMAIL_TEMPLATE_POST_EVENT = 'event-post-event';

export interface EmailTemplateContext {
  attendeeName: string;
  eventTitle: string;
  eventStartAt: Date;
  eventTimeZone: string;
  ticketTypeName?: string | null;
  checkinToken?: string | null;
}

interface RenderedEmail {
  subject: string;
  text: string;
}

export interface ListEmailLogsQuery {
  status?: string;
  template?: string;
  page?: number;
  pageSize?: number;
}

export interface EmailLogsPage {
  items: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
  summary: { sent: number; failed: number; byTemplate: Record<string, number> };
}

const CONFIRMED_LIKE: RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING_MATCH,
];

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(ManagedEvent)
    private readonly eventRepo: Repository<ManagedEvent>,
    @InjectRepository(EventRegistration)
    private readonly registrationRepo: Repository<EventRegistration>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    private readonly provider: SmtpEmailProvider,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  private formatDate(date: Date, timeZone: string): string {
    return date.toLocaleString('pt-BR', {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });
  }

  private render(template: string, ctx: EmailTemplateContext): RenderedEmail {
    const when = this.formatDate(ctx.eventStartAt, ctx.eventTimeZone);
    switch (template) {
      case EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION: {
        const lines = [
          `Olá, ${ctx.attendeeName}!`,
          '',
          `Sua inscrição em "${ctx.eventTitle}" está confirmada.`,
          `Data: ${when}`,
        ];
        if (ctx.ticketTypeName) lines.push(`Ingresso: ${ctx.ticketTypeName}`);
        if (ctx.checkinToken) {
          lines.push('', `Seu código de check-in: ${ctx.checkinToken}`);
        }
        lines.push(
          '',
          `Acompanhe suas inscrições e certificados em ${this.frontendUrl}/membro`,
          '',
          '— Equipe Codaqui',
        );
        return {
          subject: `Inscrição confirmada — ${ctx.eventTitle}`,
          text: lines.join('\n'),
        };
      }
      case EMAIL_TEMPLATE_REMINDER_D1:
        return {
          subject: `Lembrete: ${ctx.eventTitle} é amanhã`,
          text: [
            `Olá, ${ctx.attendeeName}!`,
            '',
            `Lembrete: "${ctx.eventTitle}" acontece amanhã, ${when}.`,
            '',
            'Nos vemos lá! Qualquer dúvida, fale com a equipe Codaqui.',
            '',
            '— Equipe Codaqui',
          ].join('\n'),
        };
      case EMAIL_TEMPLATE_POST_EVENT:
        return {
          subject: `Obrigado por participar de ${ctx.eventTitle}`,
          text: [
            `Olá, ${ctx.attendeeName}!`,
            '',
            `Obrigado por participar de "${ctx.eventTitle}"!`,
            '',
            `Seus certificados e inscrições ficam disponíveis em ${this.frontendUrl}/membro.`,
            '',
            '— Equipe Codaqui',
          ].join('\n'),
        };
      default:
        throw new BadRequestException(`Template desconhecido: ${template}`);
    }
  }

  private contextFor(
    registration: EventRegistration,
    event: ManagedEvent,
    ticketTypeName: string | null = null,
  ): EmailTemplateContext {
    return {
      attendeeName: registration.attendeeName,
      eventTitle: event.title,
      eventStartAt: event.startAt,
      eventTimeZone: event.timezone,
      ticketTypeName,
      checkinToken: registration.checkinToken,
    };
  }

  /** Nomes de ticket type por id (para o contexto dos templates). */
  private async loadTicketTypeNames(
    registrations: EventRegistration[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(registrations.map((r) => r.ticketTypeId))];
    if (ids.length === 0) return new Map();
    const ticketTypes = await this.ticketTypeRepo.findBy({ id: In(ids) });
    return new Map(ticketTypes.map((t) => [t.id, t.name]));
  }

  /**
   * Renderiza, envia e registra o log. NUNCA lança por falha de SMTP —
   * a falha fica registrada no email_logs (status=failed) para reenvio.
   */
  async sendTemplate(
    template: string,
    to: string,
    ctx: EmailTemplateContext,
    refs: { eventId?: string | null; registrationId?: string | null } = {},
  ): Promise<EmailLog> {
    const rendered = this.render(template, ctx);
    const log = this.emailLogRepo.create({
      to,
      template,
      eventId: refs.eventId ?? null,
      registrationId: refs.registrationId ?? null,
      status: EmailStatus.SENT,
      error: null,
    });
    try {
      await this.provider.send({
        to,
        subject: rendered.subject,
        text: rendered.text,
      });
    } catch (error) {
      log.status = EmailStatus.FAILED;
      log.error = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao enviar ${template} para ${to}: ${log.error}`);
    }
    return this.emailLogRepo.save(log);
  }

  /** E-mail transacional disparado na inscrição (gratuita ou paga). */
  async sendRegistrationConfirmation(
    registration: EventRegistration,
    event: ManagedEvent,
  ): Promise<void> {
    const names = await this.loadTicketTypeNames([registration]);
    await this.sendTemplate(
      EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      registration.attendeeEmail,
      this.contextFor(
        registration,
        event,
        names.get(registration.ticketTypeId) ?? null,
      ),
      { eventId: event.id, registrationId: registration.id },
    );
  }

  /**
   * D-1: varredura diária — eventos published começando entre +12h e +36h
   * (cada evento cai exatamente uma vez na janela). Ignora opt-in
   * (e-mail transacional). Dedupe por email_logs (template + registrationId).
   */
  @Cron('0 9 * * *')
  async sendDayBeforeReminders(): Promise<void> {
    const now = Date.now();
    await this.sendScheduledBatch(EMAIL_TEMPLATE_REMINDER_D1, {
      from: new Date(now + 12 * 3_600_000),
      to: new Date(now + 36 * 3_600_000),
      windowColumn: 'event.startAt',
      onlyOptedInMembers: false,
    });
  }

  /**
   * Pós-evento: varredura diária — eventos cujo COALESCE(endAt, startAt)
   * passou entre 36h e 12h atrás. Só registrations com memberId cujo membro
   * tem eventCommsOptIn = true.
   */
  @Cron('15 9 * * *')
  async sendPostEventFollowups(): Promise<void> {
    const now = Date.now();
    await this.sendScheduledBatch(EMAIL_TEMPLATE_POST_EVENT, {
      from: new Date(now - 36 * 3_600_000),
      to: new Date(now - 12 * 3_600_000),
      windowColumn: 'COALESCE(event.endAt, event.startAt)',
      onlyOptedInMembers: true,
    });
  }

  private async sendScheduledBatch(
    template: string,
    options: {
      from: Date;
      to: Date;
      windowColumn: string;
      onlyOptedInMembers: boolean;
    },
  ): Promise<void> {
    let qb = this.registrationRepo
      .createQueryBuilder('registration')
      .innerJoin(ManagedEvent, 'event', 'event.id = registration.eventId')
      .where('registration.status IN (:...statuses)', {
        statuses: CONFIRMED_LIKE,
      })
      .andWhere('event.status = :eventStatus', {
        eventStatus: ManagedEventStatus.PUBLISHED,
      })
      .andWhere(`${options.windowColumn} BETWEEN :from AND :to`, {
        from: options.from,
        to: options.to,
      });
    if (options.onlyOptedInMembers) {
      qb = qb
        .innerJoin(Member, 'member', 'member.id = registration.memberId')
        .andWhere('member.eventCommsOptIn = true');
    }
    const registrations = await qb.getMany();
    if (registrations.length === 0) return;

    const eventIds = [
      ...new Set(
        registrations
          .map((r) => r.eventId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const events = await this.eventRepo.findBy({ id: In(eventIds) });
    const eventById = new Map(events.map((e) => [e.id, e]));

    // Dedupe: já existe log do template para a registration?
    const existing = await this.emailLogRepo.find({
      where: { template, registrationId: In(registrations.map((r) => r.id)) },
      select: ['registrationId'],
    });
    const alreadySent = new Set(existing.map((l) => l.registrationId));
    const ticketNames = await this.loadTicketTypeNames(registrations);

    let sent = 0;
    for (const registration of registrations) {
      if (alreadySent.has(registration.id)) continue;
      const event = registration.eventId
        ? eventById.get(registration.eventId)
        : undefined;
      if (!event) continue;
      await this.sendTemplate(
        template,
        registration.attendeeEmail,
        this.contextFor(
          registration,
          event,
          ticketNames.get(registration.ticketTypeId) ?? null,
        ),
        { eventId: event.id, registrationId: registration.id },
      );
      sent += 1;
    }
    if (sent > 0) {
      this.logger.log(`${template}: ${sent} e-mail(s) disparado(s)`);
    }
  }

  async listLogs(query: ListEmailLogsQuery): Promise<EmailLogsPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: { status?: EmailStatus; template?: string } = {};
    if (
      query.status === EmailStatus.SENT ||
      query.status === EmailStatus.FAILED
    ) {
      where.status = query.status;
    } else if (query.status) {
      throw new BadRequestException(
        `Status inválido: ${query.status}. Use sent|failed.`,
      );
    }
    if (query.template) where.template = query.template;

    const [items, total] = await this.emailLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Summary respeita o filtro de template (ignora o de status, para dar visão geral).
    const summaryQb = this.emailLogRepo
      .createQueryBuilder('log')
      .select('log.template', 'template')
      .addSelect('log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.template')
      .addGroupBy('log.status');
    if (where.template) {
      summaryQb.where('log.template = :template', {
        template: where.template,
      });
    }
    const rows: { template: string; status: EmailStatus; count: string }[] =
      await summaryQb.getRawMany();
    const summary = {
      sent: 0,
      failed: 0,
      byTemplate: {} as Record<string, number>,
    };
    for (const row of rows) {
      const count = Number(row.count);
      summary[row.status] += count;
      summary.byTemplate[row.template] =
        (summary.byTemplate[row.template] ?? 0) + count;
    }

    return { items, total, page, pageSize, summary };
  }

  /**
   * Reenvia um e-mail já registrado: atualiza o MESMO log (status, error,
   * createdAt). Só suportado para logs com registrationId e template conhecido.
   */
  async resend(logId: string): Promise<EmailLog> {
    const log = await this.emailLogRepo.findOneBy({ id: logId });
    if (!log) throw new NotFoundException('Log de e-mail não encontrado.');
    if (!log.registrationId) {
      throw new BadRequestException(
        'Reenvio só é suportado para e-mails vinculados a uma inscrição.',
      );
    }
    const registration = await this.registrationRepo.findOneBy({
      id: log.registrationId,
    });
    if (!registration?.eventId) {
      throw new BadRequestException(
        'Inscrição vinculada ao log não encontrada.',
      );
    }
    const event = await this.eventRepo.findOneBy({ id: registration.eventId });
    if (!event) {
      throw new BadRequestException('Evento vinculado ao log não encontrado.');
    }
    const names = await this.loadTicketTypeNames([registration]);
    const rendered = this.render(
      log.template,
      this.contextFor(
        registration,
        event,
        names.get(registration.ticketTypeId) ?? null,
      ),
    );
    try {
      await this.provider.send({
        to: log.to,
        subject: rendered.subject,
        text: rendered.text,
      });
      log.status = EmailStatus.SENT;
      log.error = null;
    } catch (error) {
      log.status = EmailStatus.FAILED;
      log.error = error instanceof Error ? error.message : String(error);
    }
    log.createdAt = new Date();
    return this.emailLogRepo.save(log);
  }
}
