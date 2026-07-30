import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { RegistrationStatus } from './entities/event-registration.entity';
import type { JwtPayload } from '../auth/jwt.strategy';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const EVENT_KEY = 'sympla:elasnocodigo:3321444';

const user = (overrides: Partial<JwtPayload> = {}): JwtPayload =>
  ({
    sub: uuid(1),
    githubId: '1',
    handle: 'ana',
    name: 'Ana',
    email: 'ana@x.dev',
    avatarUrl: '',
    roles: ['membro'],
    ...overrides,
  }) as JwtPayload;

const checkerUser = user({ sub: uuid(2), roles: ['membro', 'event_checker'] });

const makeEvent = () => ({
  id: uuid(10),
  slug: 'evento-x',
  title: 'Evento X',
  startAt: new Date('2026-08-10T13:00:00Z'),
  endAt: new Date('2026-08-10T17:00:00Z'),
  timezone: 'America/Sao_Paulo',
  communityProjectKey: 'devparana',
});

const makeActivation = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(70),
  eventKey: EVENT_KEY,
  features: ['checkin'],
  communityProjectKey: 'elasnocodigo',
  title: 'Meetup Elas',
  enabledByMemberId: uuid(1),
  createdAt: new Date(),
  ...overrides,
});

const makeRegistration = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(40),
  eventId: uuid(10),
  externalActivationId: null,
  externalSource: null,
  externalId: null,
  ticketTypeId: uuid(20),
  orderId: null,
  memberId: uuid(1),
  attendeeName: 'Ana',
  attendeeEmail: 'ana@x.dev',
  checkinToken: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  checkedInAt: null,
  checkedInByMemberId: null,
  status: RegistrationStatus.CONFIRMED,
  createdAt: new Date(),
  ...overrides,
});

describe('EventsService — 2c/2d (check-in, certificados, externos)', () => {
  let service: EventsService;
  let eventRepo: Record<string, jest.Mock>;
  let ticketTypeRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let registrationRepo: Record<string, jest.Mock>;
  let staffRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let activationRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let stripeService: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let eventOrganizerService: Record<string, jest.Mock>;
  let githubDb: Record<string, jest.Mock>;
  let reimbursementsService: Record<string, jest.Mock>;

  const mockMemberQb = (members: unknown[]) => {
    memberRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(members),
      getOne: jest.fn().mockResolvedValue(members[0] ?? null),
    });
  };

  beforeEach(() => {
    eventRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeEvent()),
      findBy: jest.fn().mockResolvedValue([makeEvent()]),
    };
    ticketTypeRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findBy: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((t) => Promise.resolve({ id: uuid(21), ...t })),
      query: jest.fn().mockResolvedValue([]),
    };
    orderRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((o) => Promise.resolve({ id: uuid(30), ...o })),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    registrationRepo = {
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((r) =>
        Promise.resolve(Array.isArray(r) ? r : { id: uuid(40), ...r }),
      ),
      createQueryBuilder: jest.fn(),
    };
    staffRepo = { findBy: jest.fn().mockResolvedValue([]) };
    memberRepo = {
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    mockMemberQb([]);
    activationRepo = {
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((a) => Promise.resolve({ id: uuid(70), ...a })),
    };
    txRepo = { find: jest.fn().mockResolvedValue([]) };
    stripeService = {};
    ledgerService = {};
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    emailService = {
      sendRegistrationConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    eventOrganizerService = {
      assertCanManage: jest.fn().mockResolvedValue(undefined),
      requireUserToken: jest.fn().mockResolvedValue('gho_user-token'),
      getOwnedScopes: jest.fn().mockResolvedValue([]),
    };
    githubDb = {
      readFile: jest.fn().mockResolvedValue(null),
      listDir: jest.fn().mockResolvedValue(null),
      createPRWithFiles: jest
        .fn()
        .mockResolvedValue({ prNumber: 88, prUrl: 'https://pr/88' }),
    };
    reimbursementsService = {
      createFromEvent: jest.fn().mockResolvedValue({}),
    };

    service = new EventsService(
      eventRepo as any,
      ticketTypeRepo as any,
      orderRepo as any,
      registrationRepo as any,
      staffRepo as any,
      memberRepo as any,
      activationRepo as any,
      txRepo as any,
      stripeService as any,
      ledgerService as any,
      auditService as any,
      emailService as any,
      eventOrganizerService as any,
      githubDb as any,
      reimbursementsService as any,
    );
  });

  // ── Check-in (2c) ─────────────────────────────────────────────────────────

  describe('checkin', () => {
    it('primeira leitura → checked_in; segunda → already_checked_in (idempotente)', async () => {
      const registration = makeRegistration();
      registrationRepo.findOneBy.mockResolvedValue(registration);

      const first = await service.checkin(
        uuid(10),
        registration.checkinToken,
        checkerUser,
      );
      expect(first.status).toBe('checked_in');
      expect(first.registration.checkedInAt).toBeInstanceOf(Date);
      expect(registration.checkedInByMemberId).toBe(checkerUser.sub);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'event.checkin' }),
      );

      // Segunda leitura: o repo devolve a registration já marcada
      registrationRepo.findOneBy.mockResolvedValue({
        ...registration,
        checkedInAt: registration.checkedInAt,
      });
      const second = await service.checkin(
        uuid(10),
        registration.checkinToken,
        checkerUser,
      );
      expect(second.status).toBe('already_checked_in');
    });

    it('token inválido (ou de outro evento) → 404', async () => {
      registrationRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.checkin(uuid(10), 'token-inexistente', checkerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('membro comum sem staff → 403', async () => {
      await expect(
        service.checkin(uuid(10), 'qualquer', user()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Certificados (2c) ─────────────────────────────────────────────────────

  describe('getCertificate', () => {
    it('403 quando a inscrição ainda não tem check-in', async () => {
      registrationRepo.findOneBy.mockResolvedValue(makeRegistration());
      await expect(service.getCertificate(uuid(40), user())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('dono com check-in recebe certificado com verificationCode e carga horária', async () => {
      registrationRepo.findOneBy.mockResolvedValue(
        makeRegistration({ checkedInAt: new Date('2026-08-10T13:05:00Z') }),
      );
      const cert = await service.getCertificate(uuid(40), user());
      expect(cert.attendeeName).toBe('Ana');
      expect(cert.eventTitle).toBe('Evento X');
      expect(cert.workloadMinutes).toBe(240);
      expect(cert.communityProjectKey).toBe('devparana');
      expect(cert.verificationCode).toBe('CRT-aaaaaaaa-bbb');
    });

    it('outro membro (não dono, não admin) → 403', async () => {
      registrationRepo.findOneBy.mockResolvedValue(
        makeRegistration({ checkedInAt: new Date() }),
      );
      await expect(
        service.getCertificate(uuid(40), user({ sub: uuid(99) })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyCertificate (público)', () => {
    const mockVerifyQb = (found: unknown) => {
      registrationRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(found),
      });
    };

    it('código válido → dados públicos do certificado', async () => {
      mockVerifyQb(makeRegistration({ checkedInAt: new Date() }));
      const result = await service.verifyCertificate('CRT-aaaaaaaa-bb');
      expect(result.valid).toBe(true);
      expect(result.attendeeName).toBe('Ana');
      expect(result.eventTitle).toBe('Evento X');
      expect(result.communityProjectKey).toBe('devparana');
    });

    it('código inexistente → valid: false', async () => {
      mockVerifyQb(null);
      const result = await service.verifyCertificate('CRT-zzzzzzzzzzzz');
      expect(result.valid).toBe(false);
    });
  });

  // ── Ativação externa (2d) ─────────────────────────────────────────────────

  describe('activateExternal', () => {
    const dto = {
      features: ['checkin'],
      communityProjectKey: 'elasnocodigo',
      title: 'Meetup Elas',
    };

    it('não-owner → 403 (assertCanManage rejeita)', async () => {
      eventOrganizerService.assertCanManage.mockRejectedValue(
        new ForbiddenException('Sem ownership sobre este evento ou fonte.'),
      );
      await expect(
        service.activateExternal(EVENT_KEY, dto, user()),
      ).rejects.toThrow(ForbiddenException);
      expect(activationRepo.save).not.toHaveBeenCalled();
    });

    it('sem communityProjectKey → 400', async () => {
      await expect(
        service.activateExternal(
          EVENT_KEY,
          { ...dto, communityProjectKey: '' },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('feature inválida → 400', async () => {
      await expect(
        service.activateExternal(
          EVENT_KEY,
          { ...dto, features: ['streaming'] },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('certificates força checkin automaticamente', async () => {
      activationRepo.findOneBy.mockResolvedValue(null);
      const saved = await service.activateExternal(
        EVENT_KEY,
        { ...dto, features: ['certificates'] },
        user(),
      );
      expect(saved.features).toEqual(
        expect.arrayContaining(['certificates', 'checkin']),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'event.activation_saved' }),
      );
    });

    it('eventKey malformado → 400', async () => {
      await expect(
        service.activateExternal('sympla:elasnocodigo', dto, user()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Importação CSV (2d) ───────────────────────────────────────────────────

  describe('importParticipants', () => {
    beforeEach(() => {
      activationRepo.findOneBy.mockResolvedValue(makeActivation());
    });

    it('match por e-mail → confirmed; sem match → pending_match em unmatched; linhas inválidas reportadas por número', async () => {
      // ana@x.dev existe como membro (e-mail primário); "ghost" não.
      // A função agora faz getOne para primário e, se falhar, getOne para secundário.
      const getOne = jest
        .fn()
        .mockResolvedValueOnce({ id: uuid(1), email: 'ana@x.dev' }) // Ana primário
        .mockResolvedValueOnce(null) // Ghost primário
        .mockResolvedValueOnce(null); // Ghost secundário
      memberRepo.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne,
        getMany: jest.fn().mockResolvedValue([]),
      }));

      const csv = [
        'name,email,ticket_type,external_id',
        'Ana,ana@x.dev,VIP,e1',
        'Ghost,ghost@x.dev,,e2',
        ',sem-nome@x.dev,,e3',
      ].join('\n');

      const result = await service.importParticipants(EVENT_KEY, csv, user());

      expect(result.imported).toBe(2);
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([{ line: 3, email: 'ghost@x.dev' }]);
      expect(result.errors).toEqual([{ line: 4, reason: 'name vazio' }]);

      const saved = registrationRepo.save.mock.calls[0][0];
      expect(saved[0].status).toBe(RegistrationStatus.CONFIRMED);
      expect(saved[0].memberId).toBe(uuid(1));
      expect(saved[1].status).toBe(RegistrationStatus.PENDING_MATCH);
      expect(saved[1].memberId).toBeNull();
      // ticket types: "Importado — VIP" e "Importado" (default)
      expect(ticketTypeRepo.save).toHaveBeenCalledTimes(2);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'event.participants_imported' }),
      );
    });

    it('match por e-mail secundário verificado (secondaryEmails) → confirmed', async () => {
      // primário null → secundário encontra
      const getOne = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: uuid(8),
          email: 'primary@x.dev',
          secondaryEmails: ['secondary@x.dev'],
        });
      memberRepo.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne,
        getMany: jest.fn().mockResolvedValue([]),
      }));

      const csv = 'name,email\nUser,secondary@x.dev';
      const result = await service.importParticipants(EVENT_KEY, csv, user());

      expect(result.imported).toBe(1);
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      const saved = registrationRepo.save.mock.calls[0][0];
      expect(saved[0].status).toBe(RegistrationStatus.CONFIRMED);
      expect(saved[0].memberId).toBe(uuid(8));
    });

    it('re-upload não duplica (skippedDuplicates por external_id e por e-mail)', async () => {
      registrationRepo.findBy.mockResolvedValue([
        makeRegistration({
          externalActivationId: uuid(70),
          externalSource: 'sympla:elasnocodigo',
          externalId: 'e1',
          attendeeEmail: 'ana@x.dev',
        }),
        makeRegistration({
          id: uuid(41),
          externalActivationId: uuid(70),
          attendeeEmail: 'ghost@x.dev',
        }),
      ]);

      const csv = [
        'name,email,external_id',
        'Ana,ana@x.dev,e1', // dupe por external_id
        'Ghost,ghost@x.dev,e9', // dupe por e-mail
      ].join('\n');

      const result = await service.importParticipants(EVENT_KEY, csv, user());
      expect(result.imported).toBe(0);
      expect(result.skippedDuplicates).toBe(2);
      expect(registrationRepo.save).not.toHaveBeenCalled();
    });

    it('re-upload com coluna github cura inscrição pending_match (healing)', async () => {
      const stuck = makeRegistration({
        id: uuid(42),
        externalActivationId: uuid(70),
        attendeeEmail: 'enderson@codaqui.dev',
        status: RegistrationStatus.PENDING_MATCH,
        memberId: null,
      });
      registrationRepo.findBy.mockResolvedValue([stuck]);
      const getOne = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const getMany = jest
        .fn()
        .mockResolvedValue([{ id: uuid(7), githubHandle: 'endersonmenezes' }]);
      memberRepo.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne,
        getMany,
      }));

      const csv =
        'name,email,github\nEnderson,enderson@codaqui.dev,endersonmenezes';
      const result = await service.importParticipants(EVENT_KEY, csv, user());
      expect(result.healed).toBe(1);
      expect(result.skippedDuplicates).toBe(0);
      expect(registrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: uuid(42),
          memberId: uuid(7),
          status: RegistrationStatus.CONFIRMED,
        }),
      );
    });

    it('re-upload de duplicado confirmado NÃO cura nem altera (só pending_match)', async () => {
      registrationRepo.findBy.mockResolvedValue([
        makeRegistration({
          id: uuid(43),
          externalActivationId: uuid(70),
          attendeeEmail: 'ana@x.dev',
          status: RegistrationStatus.CONFIRMED,
          memberId: uuid(1),
        }),
      ]);

      const csv = 'name,email,github\nAna,ana@x.dev,bruna';
      const result = await service.importParticipants(EVENT_KEY, csv, user());
      expect(result.healed).toBe(0);
      expect(result.skippedDuplicates).toBe(1);
      expect(registrationRepo.save).not.toHaveBeenCalled();
    });

    it('match por githubHandle (identificador sem @)', async () => {
      memberRepo.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: uuid(5), githubHandle: 'bruna' }]),
      }));
      const csv = 'name,email\nBruna,bruna';
      const result = await service.importParticipants(EVENT_KEY, csv, user());
      expect(result.matched).toBe(1);
      const saved = registrationRepo.save.mock.calls[0][0];
      expect(saved[0].status).toBe(RegistrationStatus.CONFIRMED);
      expect(saved[0].memberId).toBe(uuid(5));
    });

    it('match via coluna github quando o e-mail não tem conta', async () => {
      const getOne = jest
        .fn()
        .mockResolvedValueOnce(null) // e-mail primário sem conta
        .mockResolvedValueOnce(null); // e-mail secundário sem conta
      const getMany = jest.fn().mockResolvedValue([
        { id: uuid(6), githubHandle: 'endersonmenezes' },
      ]);
      memberRepo.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne,
        getMany,
      }));
      const csv =
        'name,email,github\nEnderson,enderson@codaqui.dev,@endersonmenezes';
      const result = await service.importParticipants(EVENT_KEY, csv, user());
      expect(result.matched).toBe(1);
      const saved = registrationRepo.save.mock.calls[0][0];
      expect(saved[0].status).toBe(RegistrationStatus.CONFIRMED);
      expect(saved[0].memberId).toBe(uuid(6));
    });

    it('sem feature checkin na ativação → 403', async () => {
      activationRepo.findOneBy.mockResolvedValue(
        makeActivation({ features: ['certificates'] }),
      );
      await expect(
        service.importParticipants(EVENT_KEY, 'name,email\nA,a@x.dev', user()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CSV com header inválido → 400', async () => {
      await expect(
        service.importParticipants(EVENT_KEY, 'foo,bar\n1,2', user()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Lista de participantes (2d) ───────────────────────────────────────────

  describe('listExternalParticipants', () => {
    it('retorna participantes com o nome do tipo de ingresso', async () => {
      activationRepo.findOneBy.mockResolvedValue(makeActivation());
      registrationRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeRegistration({ ticketTypeId: uuid(21), attendeeName: 'Ana' }),
          ]),
      });
      ticketTypeRepo.findBy.mockResolvedValue([
        { id: uuid(21), name: 'Importado' },
      ]);

      const result = await service.listExternalParticipants(
        EVENT_KEY,
        {},
        user(),
      );
      expect(result[0].attendeeName).toBe('Ana');
      expect(result[0].ticketType).toEqual({ name: 'Importado' });
    });
  });

  // ── Rematch (2d) ──────────────────────────────────────────────────────────

  describe('rematchParticipants', () => {
    it('resolve pending_match após o participante se cadastrar', async () => {
      activationRepo.findOneBy.mockResolvedValue(makeActivation());
      const pending = makeRegistration({
        id: uuid(42),
        eventId: null,
        externalActivationId: uuid(70),
        memberId: null,
        attendeeEmail: 'ghost@x.dev',
        status: RegistrationStatus.PENDING_MATCH,
      });
      registrationRepo.findBy.mockResolvedValue([pending]);
      mockMemberQb([{ id: uuid(7), email: 'ghost@x.dev' }]);

      const result = await service.rematchParticipants(EVENT_KEY, user());
      expect(result).toEqual({ rematched: 1, stillUnmatched: 0 });
      expect(pending.memberId).toBe(uuid(7));
      expect(pending.status).toBe(RegistrationStatus.CONFIRMED);
      expect(registrationRepo.save).toHaveBeenCalledWith(pending);
    });
  });

  describe('rematchPendingRegistrationsForMember (hook de cadastro)', () => {
    it('vincula inscrições pelo e-mail/handle do novo membro', async () => {
      const pending = makeRegistration({
        eventId: null,
        externalActivationId: uuid(70),
        memberId: null,
        status: RegistrationStatus.PENDING_MATCH,
      });
      registrationRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([pending]),
      });

      const count = await service.rematchPendingRegistrationsForMember({
        id: uuid(8),
        email: 'novo@x.dev',
        githubHandle: 'novo',
      } as any);

      expect(count).toBe(1);
      expect(pending.memberId).toBe(uuid(8));
      expect(pending.status).toBe(RegistrationStatus.CONFIRMED);
    });
  });

  // ── Check-in externo (2d) ─────────────────────────────────────────────────

  describe('checkinExternal', () => {
    it('exige feature checkin na ativação → 403 sem ela', async () => {
      activationRepo.findOneBy.mockResolvedValue(
        makeActivation({ features: ['certificates'] }),
      );
      await expect(
        service.checkinExternal(EVENT_KEY, 'token', user()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ativador faz check-in de participante importado', async () => {
      activationRepo.findOneBy.mockResolvedValue(makeActivation());
      const registration = makeRegistration({
        eventId: null,
        externalActivationId: uuid(70),
        status: RegistrationStatus.PENDING_MATCH,
        memberId: null,
      });
      registrationRepo.findOneBy.mockResolvedValue(registration);

      // user() é o enabledByMemberId (uuid(1)) — staff por ter ativado
      const result = await service.checkinExternal(
        EVENT_KEY,
        registration.checkinToken,
        user(),
      );
      expect(result.status).toBe('checked_in');
      expect(registration.checkedInAt).toBeInstanceOf(Date);
    });

    it('quem não é ativador nem owner → 403', async () => {
      activationRepo.findOneBy.mockResolvedValue(makeActivation());
      eventOrganizerService.assertCanManage.mockRejectedValue(
        new ForbiddenException('Sem ownership sobre este evento ou fonte.'),
      );
      await expect(
        service.checkinExternal(EVENT_KEY, 'token', user({ sub: uuid(99) })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Listagem de ativações visíveis ───────────────────────────────────────

  describe('listActivations', () => {
    const adminUser = user({ sub: uuid(90), handle: 'boss', roles: ['admin'] });
    const mine = makeActivation({ id: uuid(70) });
    const owned = makeActivation({
      id: uuid(71),
      eventKey: 'meetup:devparana:123',
      enabledByMemberId: uuid(55),
    });
    const other = makeActivation({
      id: uuid(72),
      eventKey: 'sympla:elasnocodigo:9',
      enabledByMemberId: uuid(56),
    });

    it('admin vê todas (sem consultar ownership)', async () => {
      activationRepo.find.mockResolvedValue([mine, owned, other]);

      const result = await service.listActivations(adminUser);

      expect(result).toHaveLength(3);
      expect(eventOrganizerService.getOwnedScopes).not.toHaveBeenCalled();
      expect(result[0]).toMatchObject({
        id: mine.id,
        eventKey: mine.eventKey,
        features: mine.features,
        communityProjectKey: mine.communityProjectKey,
        enabledByMemberId: mine.enabledByMemberId,
      });
    });

    it('membro vê as que ativou + as cobertas por ownership', async () => {
      activationRepo.find.mockResolvedValue([mine, owned, other]);
      eventOrganizerService.getOwnedScopes.mockResolvedValue([
        'meetup:devparana:*',
      ]);

      const result = await service.listActivations(user());

      expect(result.map((a) => a.id)).toEqual([mine.id, owned.id]);
    });
  });

  // ── Force-sync do snapshot internal:codaqui ──────────────────────────────

  describe('syncInternalSnapshot', () => {
    const organizerUser = user({
      sub: uuid(1),
      handle: 'ana',
      roles: ['event_organizer'],
    });

    const mockPublicEvents = (events: unknown[]) => {
      eventRepo.find = jest.fn().mockResolvedValue(events);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
    };

    it('monta os arquivos, preserva outras fontes no index raiz e abre 1 PR', async () => {
      mockPublicEvents([makeEvent()]);
      githubDb.listDir.mockResolvedValue([
        {
          name: 'index.json',
          path: 'static/events/internal/codaqui/index.json',
        },
        { name: 'old.json', path: 'static/events/internal/codaqui/old.json' },
        {
          name: `${uuid(10)}.override.json`,
          path: `static/events/internal/codaqui/${uuid(10)}.override.json`,
        },
      ]);
      githubDb.readFile.mockResolvedValue(
        JSON.stringify({
          generatedAt: '2026-07-01T00:00:00.000Z',
          sources: [
            { sourceKey: 'meetup:devparana', itemCount: 3 },
            { sourceKey: 'internal:codaqui', itemCount: 1 },
          ],
          events: [
            {
              sourceKey: 'meetup:devparana',
              id: 'm1',
              startAt: '2026-01-01T00:00:00.000Z',
            },
            {
              sourceKey: 'internal:codaqui',
              id: 'old',
              startAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        }),
      );

      const result = await service.syncInternalSnapshot(organizerUser);

      expect(result).toEqual({
        prNumber: 88,
        prUrl: 'https://pr/88',
        events: 1,
      });
      expect(eventOrganizerService.requireUserToken).toHaveBeenCalledWith(
        organizerUser.sub,
      );

      // UM PR multi-arquivo
      expect(githubDb.createPRWithFiles).toHaveBeenCalledTimes(1);
      const call = githubDb.createPRWithFiles.mock.calls[0][0];
      expect(call.branch).toMatch(/^event-sync\/internal-\d+$/);
      expect(call.labels).toEqual(['event-override']);
      expect(call.userToken).toBe('gho_user-token');
      expect(call.actorHandle).toBe('ana');

      const byPath = new Map(
        (call.files as Array<{ path: string; content: string | null }>).map(
          (f) => [f.path, f.content],
        ),
      );
      // 1 arquivo por evento + index da fonte + delete do órfão + index raiz
      expect(
        byPath.has(`static/events/internal/codaqui/${uuid(10)}.json`),
      ).toBe(true);
      expect(byPath.has('static/events/internal/codaqui/index.json')).toBe(
        true,
      );
      expect(byPath.get('static/events/internal/codaqui/old.json')).toBeNull(); // delete
      expect(byPath.has('static/events/index.json')).toBe(true);

      // Arquivo do evento: shape { generatedAt, source, event }
      const eventFile = JSON.parse(
        byPath.get(`static/events/internal/codaqui/${uuid(10)}.json`) as string,
      );
      expect(eventFile.event.id).toBe(uuid(10));
      expect(eventFile.source.sourceId).toBe('codaqui');

      // Index da fonte: sourceSummary + summaries com hasOverride
      const sourceIndex = JSON.parse(
        byPath.get('static/events/internal/codaqui/index.json') as string,
      );
      expect(sourceIndex.source.sourceKey).toBe('internal:codaqui');
      expect(sourceIndex.source.itemCount).toBe(1);
      expect(sourceIndex.events[0].hasOverride).toBe(true); // tem <id>.override.json
      expect(sourceIndex.events[0].itemPath).toBe(
        `/events/internal/codaqui/${uuid(10)}.json`,
      );

      // Index raiz: preserva meetup, substitui internal, reordena ASC
      const root = JSON.parse(byPath.get('static/events/index.json') as string);
      expect(root.sources.map((s: any) => s.sourceKey).sort()).toEqual([
        'internal:codaqui',
        'meetup:devparana',
      ]);
      expect(root.events.some((e: any) => e.id === 'old')).toBe(false);
      expect(root.events.some((e: any) => e.id === 'm1')).toBe(true);
      expect(root.events.some((e: any) => e.id === uuid(10))).toBe(true);
      const starts = root.events.map((e: any) => new Date(e.startAt).getTime());
      expect([...starts]).toEqual([...starts].sort((a, b) => a - b));
    });

    it('skipped quando não há eventos publicados nem arquivos no repo', async () => {
      mockPublicEvents([]);
      githubDb.listDir.mockResolvedValue(null);

      const result = await service.syncInternalSnapshot(organizerUser);

      expect(result).toEqual({ skipped: true });
      expect(githubDb.createPRWithFiles).not.toHaveBeenCalled();
    });

    it('sem eventos publicados mas com arquivos existentes → limpa órfãos', async () => {
      mockPublicEvents([]);
      githubDb.listDir.mockResolvedValue([
        {
          name: 'index.json',
          path: 'static/events/internal/codaqui/index.json',
        },
        { name: 'old.json', path: 'static/events/internal/codaqui/old.json' },
      ]);
      githubDb.readFile.mockResolvedValue(null); // index raiz inexistente → regenera

      const result = await service.syncInternalSnapshot(organizerUser);

      expect(result).toMatchObject({ prNumber: 88, events: 0 });
      const call = githubDb.createPRWithFiles.mock.calls[0][0];
      const byPath = new Map(
        (call.files as Array<{ path: string; content: string | null }>).map(
          (f) => [f.path, f.content],
        ),
      );
      expect(byPath.get('static/events/internal/codaqui/old.json')).toBeNull();
      const sourceIndex = JSON.parse(
        byPath.get('static/events/internal/codaqui/index.json') as string,
      );
      expect(sourceIndex.source.itemCount).toBe(0);
    });
  });

  // ── Minhas inscrições / ingressos comprados para outros ────────────────────

  describe('myRegistrations', () => {
    it('retorna ingressos próprios e ingressos comprados para outra pessoa (payer)', async () => {
      registrationRepo.find.mockResolvedValue([
        makeRegistration({
          id: uuid(40),
          eventId: uuid(10),
          externalActivationId: null,
          memberId: uuid(1),
          payerMemberId: uuid(1),
          attendeeEmail: 'ana@x.dev',
        }),
        makeRegistration({
          id: uuid(41),
          eventId: null,
          externalActivationId: uuid(70),
          memberId: uuid(5),
          payerMemberId: uuid(1),
          attendeeEmail: 'outra@x.dev',
        }),
      ]);
      eventRepo.findBy.mockResolvedValue([makeEvent()]);
      activationRepo.findBy.mockResolvedValue([
        makeActivation({ id: uuid(70) }),
      ]);
      ticketTypeRepo.findBy.mockResolvedValue([
        { id: uuid(20), name: 'Ingresso', kind: 'free', priceCents: 0 },
      ]);

      const result = await service.myRegistrations(user());

      expect(result).toHaveLength(2);
      expect(result[0].isPayerOnly).toBe(false);
      expect(result[1].isPayerOnly).toBe(true);
      expect(result[1].attendeeEmail).toBe('outra@x.dev');
    });
  });
});
