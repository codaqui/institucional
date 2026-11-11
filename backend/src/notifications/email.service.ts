import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  ManagedEvent,
  ManagedEventStatus,
} from '../events/entities/managed-event.entity';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';
import {
  EventRegistration,
  RegistrationStatus,
} from '../events/entities/event-registration.entity';
import { Member } from '../members/entities/member.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { SmtpEmailProvider, type EmailMessage } from './email.provider';
import { renderProjectEmail, type ProjectEmailInput } from './project-email';
import { EmailTemplateService } from './email-template.service';
import {
  EMAIL_TEMPLATE_CERTIFICATE_PENDING,
  EMAIL_TEMPLATE_POST_EVENT,
  EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
  EMAIL_TEMPLATE_REMINDER_D1,
} from './default-templates';
import { EmailLog, EmailStatus } from './entities/email-log.entity';

export type { RenderedEmail } from './email-template.service';

// Re-exportados de default-templates (fonte canônica) para compatibilidade com
// consumidores que importam os IDs de email.service.
export {
  EMAIL_TEMPLATE_CERTIFICATE_PENDING,
  EMAIL_TEMPLATE_POST_EVENT,
  EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
  EMAIL_TEMPLATE_REMINDER_D1,
};

export const EMAIL_LOG_RETENTION_DAYS = 365;

export interface EmailTemplateContext {
  attendeeName: string;
  eventTitle: string;
  eventStartAt: Date;
  eventTimeZone: string;
  ticketTypeName?: string | null;
  checkinToken?: string | null;
  eventLocation?: string | null;
  isGuest?: boolean;
  meetLink?: string | null;
  cancelReason?: string | null;
}

export interface RegistrationEmailEvent {
  title: string | null;
  startAt: Date | null;
  timezone?: string;
  location?: string | null;
  eventKey?: string;
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
  summary: {
    sent: number;
    failed: number;
    skipped: number;
    byTemplate: Record<string, { sent: number; failed: number; skipped: number }>;
  };
}

const CONFIRMED_LIKE: RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING_MATCH,
];

@Injectable()
export class EmailService {
  private static smtpChain: Promise<void> = Promise.resolve();
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(ManagedEvent)
    private readonly eventRepo: Repository<ManagedEvent>,
    @InjectRepository(ExternalEventActivation)
    private readonly activationRepo: Repository<ExternalEventActivation>,
    @InjectRepository(EventRegistration)
    private readonly registrationRepo: Repository<EventRegistration>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    private readonly provider: SmtpEmailProvider,
    private readonly templateService: EmailTemplateService,
  ) {}

  private smtpDelay(): Promise<void> {
    const configured = Number.parseInt(process.env.EMAIL_SEND_INTERVAL_MS ?? '', 10);
    const fallback = process.env.NODE_ENV === 'production' ? 2000 : 0;
    const delay = Number.isFinite(configured) ? Math.max(0, configured) : fallback;
    if (delay === 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async sendWithPostgresLock(message: EmailMessage): Promise<void> {
    const queryRunner = this.emailLogRepo.manager.connection.createQueryRunner();
    const lockParams = [0x436f6461, 1];
    let locked = false;
    try {
      await queryRunner.connect();
      await queryRunner.query('SELECT pg_advisory_lock($1, $2)', lockParams);
      locked = true;
      try {
        await this.provider.send(message);
      } finally {
        await this.smtpDelay();
      }
    } finally {
      try {
        if (locked) {
          await queryRunner.query(
            'SELECT pg_advisory_unlock($1, $2)',
            lockParams,
          );
        }
      } finally {
        await queryRunner.release();
      }
    }
  }

  private scheduleSmtpSend(message: EmailMessage): Promise<void> {
    const run = EmailService.smtpChain.then(() =>
      this.sendWithPostgresLock(message),
    );
    EmailService.smtpChain = run.catch(() => undefined);
    return run;
  }

  sanitizeOperationalError(rawError: unknown): string {
    const raw =
      rawError instanceof Error ? rawError.message : String(rawError ?? '');
    const firstLine = raw.split(/\r?\n/)[0] ?? 'Erro operacional de envio';
    const redacted = firstLine
      .replace(/token=[^&\s"']+/gi, 'token=[REDACTED]')
      .replace(/(password|pass|secret|key)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
      .replace(/(Bearer|Basic)\s+\S+/gi, '$1 [REDACTED]')
      .replace(/\b(plain|enc):[^\s"']+/gi, '[REDACTED]')
      .trim();
    return (redacted || 'Erro operacional de envio').slice(0, 240);
  }

  async sendCampaignEmail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    template: string;
    campaignId: string;
    campaignRecipientId?: string | null;
  }): Promise<EmailLog> {
    const configured = this.provider.isConfigured();
    const log = this.emailLogRepo.create({
      to: input.to,
      template: input.template,
      eventId: null,
      registrationId: null,
      campaignId: input.campaignId,
      campaignRecipientId: input.campaignRecipientId ?? null,
      status: configured ? EmailStatus.SENT : EmailStatus.SKIPPED,
      error: configured ? null : 'SMTP_NOT_CONFIGURED',
    });
    if (!configured) return this.emailLogRepo.save(log);
    try {
      await this.scheduleSmtpSend({
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      log.status = EmailStatus.FAILED;
      log.error = this.sanitizeOperationalError(error);
      this.logger.warn(
        `Falha ao enviar campanha ${input.campaignId} para ${input.to}: ${log.error}`,
      );
    }
    return this.emailLogRepo.save(log);
  }

  private contextFor(
    registration: EventRegistration,
    event: RegistrationEmailEvent,
    ticketTypeName: string | null = null,
  ): EmailTemplateContext {
    return {
      attendeeName: registration.attendeeName!,
      eventTitle: event.title ?? event.eventKey ?? 'Evento',
      eventStartAt: event.startAt ?? registration.createdAt,
      eventTimeZone: event.timezone ?? 'America/Sao_Paulo',
      ticketTypeName,
      checkinToken: registration.checkinToken,
      eventLocation: event.location,
      isGuest: registration.isGuest,
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
   * indisponibilidade de configuração vira skipped; falha real vira failed.
   */
  async sendTemplate(
    template: string,
    to: string,
    ctx: EmailTemplateContext,
    refs: { eventId?: string | null; registrationId?: string | null } = {},
  ): Promise<EmailLog> {
    const rendered = await this.templateService.render(template, ctx);
    const configured = this.provider.isConfigured();
    const log = this.emailLogRepo.create({
      to,
      template,
      eventId: refs.eventId ?? null,
      registrationId: refs.registrationId ?? null,
      status: configured ? EmailStatus.SENT : EmailStatus.SKIPPED,
      error: configured ? null : 'SMTP_NOT_CONFIGURED',
    });
    if (!configured) return this.emailLogRepo.save(log);
    try {
      await this.scheduleSmtpSend({
        to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } catch (error) {
      log.status = EmailStatus.FAILED;
      log.error = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao enviar ${template} para ${to}: ${log.error}`);
    }
    return this.emailLogRepo.save(log);
  }

  async sendProjectEmail(input: ProjectEmailInput): Promise<EmailLog> {
    const rendered = renderProjectEmail(input);
    const configured = this.provider.isConfigured();
    const log = this.emailLogRepo.create({
      to: input.to,
      template: input.template,
      eventId: null,
      registrationId: null,
      status: configured ? EmailStatus.SENT : EmailStatus.SKIPPED,
      error: configured ? null : 'SMTP_NOT_CONFIGURED',
    });
    if (!configured) return this.emailLogRepo.save(log);
    try {
      await this.scheduleSmtpSend({
        to: input.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } catch (error) {
      log.status = EmailStatus.FAILED;
      log.error = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao enviar ${input.template} para ${input.to}: ${log.error}`);
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
      registration.attendeeEmail!,
      this.contextFor(
        registration,
        event,
        names.get(registration.ticketTypeId) ?? null,
      ),
      { eventId: event.id, registrationId: registration.id },
    );
  }

  async sendCertificatePendingRegistration(
    registration: EventRegistration,
    event: RegistrationEmailEvent,
  ): Promise<EmailLog> {
    return this.sendTemplate(
      EMAIL_TEMPLATE_CERTIFICATE_PENDING,
      registration.attendeeEmail!,
      this.contextFor(registration, event),
      { eventId: registration.eventId, registrationId: registration.id },
    );
  }

  async sendRegistrationCancellation(
    registration: EventRegistration,
    event: RegistrationEmailEvent,
  ): Promise<void> {
    await this.sendTemplate(
      EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
      registration.attendeeEmail!,
      this.contextFor(registration, event),
      { eventId: registration.eventId, registrationId: registration.id },
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
      .andWhere('registration.attendeeEmail IS NOT NULL')
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

    // Apenas tentativas reais deduplicam; skipped pode ser entregue depois.
    const existing = await this.emailLogRepo.find({
      where: {
        template,
        registrationId: In(registrations.map((r) => r.id)),
        status: In([EmailStatus.SENT, EmailStatus.FAILED]),
      },
      select: ['registrationId', 'status'],
    });
    const alreadyAttempted = new Set(
      existing
        .filter(
          (log) =>
            log.status === EmailStatus.SENT || log.status === EmailStatus.FAILED,
        )
        .map((log) => log.registrationId),
    );
    const ticketNames = await this.loadTicketTypeNames(registrations);

    let sent = 0;
    for (const registration of registrations) {
      if (alreadyAttempted.has(registration.id)) continue;
      const event = registration.eventId
        ? eventById.get(registration.eventId)
        : undefined;
      if (!event) continue;
      await this.sendTemplate(
        template,
        registration.attendeeEmail!,
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
      query.status === EmailStatus.FAILED ||
      query.status === EmailStatus.SKIPPED
    ) {
      where.status = query.status;
    } else if (query.status) {
      throw new BadRequestException(
        `Status inválido: ${query.status}. Use sent|failed|skipped.`,
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
      skipped: 0,
      byTemplate: {} as Record<
        string,
        { sent: number; failed: number; skipped: number }
      >,
    };
    for (const row of rows) {
      const count = Number(row.count);
      summary[row.status] += count;
      const templateSummary = (summary.byTemplate[row.template] ??= {
        sent: 0,
        failed: 0,
        skipped: 0,
      });
      templateSummary[row.status] += count;
    }

    return { items, total, page, pageSize, summary };
  }

  getStatus(): { configured: boolean } {
    return { configured: this.provider.isConfigured() };
  }

  @Cron('45 2 * * *')
  async cleanupOldLogs(): Promise<number> {
    const cutoff = new Date(
      Date.now() - EMAIL_LOG_RETENTION_DAYS * 24 * 3_600_000,
    );
    const result = await this.emailLogRepo.delete({
      createdAt: LessThan(cutoff),
    });
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Email cleanup: ${deleted} registros removidos (> ${EMAIL_LOG_RETENTION_DAYS} dias)`,
      );
    }
    return deleted;
  }

  /**
   * Reenvia um e-mail já registrado: atualiza o MESMO log (status, error,
   * createdAt). Só suportado para logs com registrationId e template conhecido.
   */
  async resend(logId: string): Promise<EmailLog> {
    if (!this.provider.isConfigured()) {
      throw new ConflictException(
        'Reenvio indisponível: SMTP não está configurado. Configure o módulo de e-mail antes de tentar novamente.',
      );
    }
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
    if (!registration) {
      throw new BadRequestException(
        'Inscrição vinculada ao log não encontrada.',
      );
    }
    let event: RegistrationEmailEvent | null = null;
    if (registration.eventId) {
      event = await this.eventRepo.findOneBy({ id: registration.eventId });
    } else if (registration.externalActivationId) {
      event = await this.activationRepo.findOneBy({
        id: registration.externalActivationId,
      });
    }
    if (!event) {
      throw new BadRequestException('Evento vinculado ao log não encontrado.');
    }
    const names = await this.loadTicketTypeNames([registration]);
    const rendered = await this.templateService.render(
      log.template,
      this.contextFor(
        registration,
        event,
        names.get(registration.ticketTypeId) ?? null,
      ),
    );
    try {
      await this.scheduleSmtpSend({
        to: log.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
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
