import { BadRequestException, ConflictException } from '@nestjs/common';
import { LessThan } from 'typeorm';
import {
  EMAIL_LOG_RETENTION_DAYS,
  EmailService,
  EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
} from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailStatus } from './entities/email-log.entity';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const makeEvent = () => ({
  id: uuid(10),
  title: 'Evento X',
  startAt: new Date('2026-08-10T13:00:00Z'),
  timezone: 'America/Sao_Paulo',
  location: 'Maringá, PR',
});

const makeRegistration = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(40),
  eventId: uuid(10),
  ticketTypeId: uuid(20),
  attendeeName: 'Ana',
  attendeeEmail: 'ana@x.dev',
  checkinToken: 'token-abc',
  ...overrides,
});

const makeContext = () => ({
  attendeeName: 'Ana',
  eventTitle: 'Evento X',
  eventStartAt: new Date('2026-08-10T13:00:00Z'),
  eventTimeZone: 'America/Sao_Paulo',
});

describe('EmailService', () => {
  let service: EmailService;
  let emailLogRepo: Record<string, jest.Mock>;
  let eventRepo: Record<string, jest.Mock>;
  let activationRepo: Record<string, jest.Mock>;
  let registrationRepo: Record<string, jest.Mock>;
  let ticketTypeRepo: Record<string, jest.Mock>;
  let provider: Record<string, jest.Mock>;
  let templateService: EmailTemplateService;

  beforeEach(() => {
    emailLogRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((l) => Promise.resolve({ id: uuid(80), ...l })),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    eventRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeEvent()),
      findBy: jest.fn().mockResolvedValue([makeEvent()]),
    };
    activationRepo = { findOneBy: jest.fn() };
    registrationRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeRegistration()),
      createQueryBuilder: jest.fn(),
    };
    ticketTypeRepo = {
      findBy: jest.fn().mockResolvedValue([{ id: uuid(20), name: 'Gratuito' }]),
    };
    provider = {
      isConfigured: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(undefined),
    };
    const templateRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    const templateAudit = { log: jest.fn().mockResolvedValue(undefined) };
    templateService = new EmailTemplateService(templateRepo as any, templateAudit as any);

    service = new EmailService(
      emailLogRepo as any,
      eventRepo as any,
      activationRepo as any,
      registrationRepo as any,
      ticketTypeRepo as any,
      provider as any,
      templateService,
    );
  });

  describe('sendTemplate', () => {
    it('grava log sent quando o SMTP envia com sucesso', async () => {
      const log = await service.sendTemplate(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        'ana@x.dev',
        makeContext(),
        { eventId: uuid(10), registrationId: uuid(40) },
      );
      expect(provider.send).toHaveBeenCalledTimes(1);
      const sentMessage = provider.send.mock.calls[0][0];
      expect(sentMessage.html).toContain('<strong>Evento X</strong>');
      expect(sentMessage.text).toContain('Sua inscrição em');
      expect(log.status).toBe(EmailStatus.SENT);
      expect(log.error).toBeNull();
      expect(emailLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('records skipped instead of failed when SMTP is not configured', async () => {
      provider.isConfigured.mockReturnValue(false);
      const log = await service.sendTemplate(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        'person@example.test',
        makeContext(),
      );
      expect(log.status).toBe(EmailStatus.SKIPPED);
      expect(log.error).toBe('SMTP_NOT_CONFIGURED');
      expect(provider.send).not.toHaveBeenCalled();
      expect(emailLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('grava failed quando o SMTP configurado rejeita o envio', async () => {
      provider.send.mockRejectedValue(new Error('SMTP timeout'));
      const log = await service.sendTemplate(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        'ana@x.dev',
        makeContext(),
      );
      expect(log.status).toBe(EmailStatus.FAILED);
      expect(log.error).toBe('SMTP timeout');
      expect(emailLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rejeita template desconhecido', async () => {
      await expect(
        service.sendTemplate('template-inexistente', 'ana@x.dev', makeContext()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendRegistrationCancellation', () => {
    it('usa o contexto real da inscrição e do evento', async () => {
      await service.sendRegistrationCancellation(
        makeRegistration() as any,
        makeEvent() as any,
      );

      const message = provider.send.mock.calls[0][0];
      expect(emailLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          template: EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
          eventId: uuid(10),
          registrationId: uuid(40),
        }),
      );
      expect(message.subject).toContain('Evento X');
      expect(message.text).toContain('Ana');
      expect(message.text).toContain('10 de agosto de 2026');
    });

    it('usa o contexto da ativação externa sem preencher eventId managed', async () => {
      const registration = makeRegistration({
        eventId: null,
        externalActivationId: uuid(70),
      });
      const activation = {
        id: uuid(70),
        eventKey: 'meetup:devpr:1',
        title: 'Meetup externo',
        startAt: new Date('2026-08-10T13:00:00Z'),
      };

      await service.sendRegistrationCancellation(registration as any, activation as any);

      expect(emailLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: null, registrationId: uuid(40) }),
      );
      expect(provider.send.mock.calls[0][0].subject).toContain('Meetup externo');
    });
  });

  describe('resend', () => {
    it('atualiza o MESMO log (não cria novo) e marca sent', async () => {
      const existing = {
        id: uuid(80),
        to: 'ana@x.dev',
        template: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        registrationId: uuid(40),
        status: EmailStatus.FAILED,
        error: 'SMTP timeout',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
      emailLogRepo.findOneBy.mockResolvedValue(existing);

      const result = await service.resend(uuid(80));

      expect(provider.send).toHaveBeenCalledTimes(1);
      const sentMessage = provider.send.mock.calls[0][0];
      expect(sentMessage.text).toContain('Local: Maringá, PR');
      expect(sentMessage.html).toContain('http://localhost:3000/membro');
      expect(result.status).toBe(EmailStatus.SENT);
      expect(result.error).toBeNull();
      expect(result.createdAt.getTime()).toBeGreaterThan(
        new Date('2026-07-01T00:00:00Z').getTime(),
      );
      expect(emailLogRepo.save).toHaveBeenCalledWith(existing);
    });

    it('reenvia um log de inscrição externa usando a ativação', async () => {
      const activation = {
        id: uuid(70),
        eventKey: 'meetup:devpr:1',
        title: 'Meetup externo',
        startAt: new Date('2026-08-10T13:00:00Z'),
      };
      emailLogRepo.findOneBy.mockResolvedValue({
        id: uuid(80),
        to: 'ana@x.dev',
        template: EMAIL_TEMPLATE_REGISTRATION_CANCELLED,
        registrationId: uuid(40),
        status: EmailStatus.FAILED,
        createdAt: new Date(),
      });
      registrationRepo.findOneBy.mockResolvedValue(
        makeRegistration({ eventId: null, externalActivationId: uuid(70) }),
      );
      (service as any).activationRepo = {
        findOneBy: jest.fn().mockResolvedValue(activation),
      };

      const result = await service.resend(uuid(80));

      expect(provider.send.mock.calls[0][0].subject).toContain('Meetup externo');
      expect(result.status).toBe(EmailStatus.SENT);
      expect(eventRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('mantém failed quando o SMTP configurado falha novamente', async () => {
      provider.send.mockRejectedValue(new Error('SMTP timeout'));
      emailLogRepo.findOneBy.mockResolvedValue({
        id: uuid(80),
        to: 'ana@x.dev',
        template: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        registrationId: uuid(40),
        status: EmailStatus.FAILED,
        error: 'SMTP timeout',
        createdAt: new Date(),
      });
      const result = await service.resend(uuid(80));
      expect(result.status).toBe(EmailStatus.FAILED);
      expect(result.error).toBe('SMTP timeout');
    });

    it('retorna 409 amigável sem tentar reenviar quando o SMTP está desligado', async () => {
      provider.isConfigured.mockReturnValue(false);
      await expect(service.resend(uuid(80))).rejects.toThrow(ConflictException);
      await expect(service.resend(uuid(80))).rejects.toThrow(/SMTP.*não está configurado/i);
      expect(provider.send).not.toHaveBeenCalled();
      expect(emailLogRepo.save).not.toHaveBeenCalled();
    });

    it('400 quando o log não tem registrationId', async () => {
      emailLogRepo.findOneBy.mockResolvedValue({
        id: uuid(80),
        registrationId: null,
        template: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      });
      await expect(service.resend(uuid(80))).rejects.toThrow(BadRequestException);
      expect(provider.send).not.toHaveBeenCalled();
    });
  });

  describe('scheduled batches', () => {
    beforeEach(() => {
      registrationRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([makeRegistration()]),
      });
    });

    it('does not let a skipped reminder dedupe a later real delivery', async () => {
      emailLogRepo.find.mockResolvedValue([
        { status: EmailStatus.SKIPPED, registrationId: uuid(40) },
      ]);
      await service.sendDayBeforeReminders();
      expect(provider.send).toHaveBeenCalled();
    });
  });

  describe('listLogs', () => {
    beforeEach(() => {
      emailLogRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { template: 'event-reminder-d1', status: 'sent', count: '3' },
          { template: 'event-reminder-d1', status: 'failed', count: '1' },
          { template: 'event-reminder-d1', status: 'skipped', count: '2' },
          { template: 'event-post-event', status: 'sent', count: '2' },
        ]),
      });
    });

    it('summary agrega os três status por template sem misturar skipped com failed', async () => {
      const result = await service.listLogs({ page: 1, pageSize: 20 });
      expect(result.summary).toEqual({
        sent: 5,
        failed: 1,
        skipped: 2,
        byTemplate: {
          'event-reminder-d1': { sent: 3, failed: 1, skipped: 2 },
          'event-post-event': { sent: 2, failed: 0, skipped: 0 },
        },
      });
    });

    it('aceita filtro skipped', async () => {
      await service.listLogs({ status: 'skipped' });
      expect(emailLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: EmailStatus.SKIPPED } }),
      );
    });

    it('400 para status inválido', async () => {
      await expect(service.listLogs({ status: 'queued' })).rejects.toThrow(
        'Use sent|failed|skipped.',
      );
    });
  });

  describe('status and retention', () => {
    it('expõe se o provider está configurado', () => {
      provider.isConfigured.mockReturnValue(false);
      expect(service.getStatus()).toEqual({ configured: false });
    });

    it('apaga somente logs anteriores a 365 dias', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
      try {
        expect(EMAIL_LOG_RETENTION_DAYS).toBe(365);
        await service.cleanupOldLogs();
        expect(emailLogRepo.delete).toHaveBeenCalledWith({
          createdAt: LessThan(new Date('2025-11-02T12:00:00Z')),
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
