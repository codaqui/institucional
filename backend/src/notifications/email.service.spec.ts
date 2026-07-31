import { BadRequestException } from '@nestjs/common';
import {
  EmailService,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
} from './email.service';
import { EmailStatus } from './entities/email-log.entity';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const makeEvent = () => ({
  id: uuid(10),
  title: 'Evento X',
  startAt: new Date('2026-08-10T13:00:00Z'),
  timezone: 'America/Sao_Paulo',
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

describe('EmailService', () => {
  let service: EmailService;
  let emailLogRepo: Record<string, jest.Mock>;
  let eventRepo: Record<string, jest.Mock>;
  let registrationRepo: Record<string, jest.Mock>;
  let ticketTypeRepo: Record<string, jest.Mock>;
  let provider: Record<string, jest.Mock>;

  beforeEach(() => {
    emailLogRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((l) => Promise.resolve({ id: uuid(80), ...l })),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(),
    };
    eventRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeEvent()),
      findBy: jest.fn().mockResolvedValue([makeEvent()]),
    };
    registrationRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeRegistration()),
      createQueryBuilder: jest.fn(),
    };
    ticketTypeRepo = {
      findBy: jest.fn().mockResolvedValue([{ id: uuid(20), name: 'Gratuito' }]),
    };
    provider = { send: jest.fn().mockResolvedValue(undefined) };

    service = new EmailService(
      emailLogRepo as any,
      eventRepo as any,
      registrationRepo as any,
      ticketTypeRepo as any,
      provider as any,
    );
  });

  describe('sendTemplate', () => {
    it('grava log sent quando o SMTP envia com sucesso', async () => {
      const log = await service.sendTemplate(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        'ana@x.dev',
        {
          attendeeName: 'Ana',
          eventTitle: 'Evento X',
          eventStartAt: new Date('2026-08-10T13:00:00Z'),
          eventTimeZone: 'America/Sao_Paulo',
        },
        { eventId: uuid(10), registrationId: uuid(40) },
      );
      expect(provider.send).toHaveBeenCalledTimes(1);
      expect(log.status).toBe(EmailStatus.SENT);
      expect(log.error).toBeNull();
      expect(emailLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('grava log FAILED quando SMTP não está configurado (nunca lança)', async () => {
      provider.send.mockRejectedValue(new Error('SMTP_NOT_CONFIGURED'));
      const log = await service.sendTemplate(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        'ana@x.dev',
        {
          attendeeName: 'Ana',
          eventTitle: 'Evento X',
          eventStartAt: new Date('2026-08-10T13:00:00Z'),
          eventTimeZone: 'America/Sao_Paulo',
        },
      );
      expect(log.status).toBe(EmailStatus.FAILED);
      expect(log.error).toBe('SMTP_NOT_CONFIGURED');
      expect(emailLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rejeita template desconhecido', async () => {
      await expect(
        service.sendTemplate('template-inexistente', 'ana@x.dev', {
          attendeeName: 'Ana',
          eventTitle: 'Evento X',
          eventStartAt: new Date(),
          eventTimeZone: 'America/Sao_Paulo',
        }),
      ).rejects.toThrow(BadRequestException);
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
        error: 'SMTP_NOT_CONFIGURED',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
      emailLogRepo.findOneBy.mockResolvedValue(existing);

      const result = await service.resend(uuid(80));

      expect(provider.send).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(EmailStatus.SENT);
      expect(result.error).toBeNull();
      expect(result.createdAt.getTime()).toBeGreaterThan(
        new Date('2026-07-01T00:00:00Z').getTime(),
      );
      // save recebeu o próprio objeto do log (update, não insert)
      expect(emailLogRepo.save).toHaveBeenCalledWith(existing);
    });

    it('mantém failed quando o SMTP continua fora', async () => {
      provider.send.mockRejectedValue(new Error('SMTP_NOT_CONFIGURED'));
      emailLogRepo.findOneBy.mockResolvedValue({
        id: uuid(80),
        to: 'ana@x.dev',
        template: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        registrationId: uuid(40),
        status: EmailStatus.FAILED,
        error: 'SMTP_NOT_CONFIGURED',
        createdAt: new Date(),
      });
      const result = await service.resend(uuid(80));
      expect(result.status).toBe(EmailStatus.FAILED);
      expect(result.error).toBe('SMTP_NOT_CONFIGURED');
    });

    it('400 quando o log não tem registrationId', async () => {
      emailLogRepo.findOneBy.mockResolvedValue({
        id: uuid(80),
        registrationId: null,
        template: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      });
      await expect(service.resend(uuid(80))).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.send).not.toHaveBeenCalled();
    });
  });

  describe('listLogs', () => {
    it('summary agrega sent/failed/byTemplate sobre o conjunto filtrado', async () => {
      const getRawMany = jest.fn().mockResolvedValue([
        { template: 'event-reminder-d1', status: 'sent', count: '3' },
        { template: 'event-reminder-d1', status: 'failed', count: '1' },
        { template: 'event-post-event', status: 'sent', count: '2' },
      ]);
      emailLogRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany,
      });

      const result = await service.listLogs({ page: 1, pageSize: 20 });
      expect(result.summary).toEqual({
        sent: 5,
        failed: 1,
        byTemplate: { 'event-reminder-d1': 4, 'event-post-event': 2 },
      });
    });

    it('400 para status inválido', async () => {
      await expect(service.listLogs({ status: 'queued' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
