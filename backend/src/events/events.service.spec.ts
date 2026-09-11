import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService, EVENT_TICKET_TERMS_VERSION } from './events.service';
import { ManagedEventStatus } from './entities/managed-event.entity';
import { OrderStatus } from './entities/event-order.entity';
import { RegistrationStatus } from './entities/event-registration.entity';
import { EventStaffRole } from './entities/event-staff.entity';
import type { JwtPayload } from '../auth/jwt.strategy';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

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

const adminUser = user({ sub: uuid(90), handle: 'boss', roles: ['admin'] });

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(10),
  slug: 'evento-x',
  title: 'Evento X',
  summary: 'Resumo',
  description: null,
  imageUrl: null,
  location: 'Maringá',
  startAt: new Date(Date.now() + 7 * 24 * 3600_000),
  endAt: null,
  timezone: 'America/Sao_Paulo',
  communityProjectKey: 'devparana',
  status: ManagedEventStatus.PUBLISHED,
  capacity: null,
  createdByMemberId: uuid(90),
  createdAt: new Date(),
  ...overrides,
});

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(20),
  eventId: uuid(10),
  name: 'Gratuito',
  kind: 'free',
  priceCents: 0,
  quantityTotal: 1,
  quantitySold: 0,
  salesStartAt: null,
  salesEndAt: null,
  maxPerOrder: 1,
  isActive: true,
  ...overrides,
});

const makeMember = () => ({
  id: uuid(1),
  githubHandle: 'ana',
  name: 'Ana',
  email: 'ana@x.dev',
  isActive: true,
});

describe('EventsService', () => {
  let service: EventsService;
  let eventRepo: Record<string, jest.Mock>;
  let ticketTypeRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let registrationRepo: Record<string, jest.Mock>;
  let staffRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let stripeService: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;
  let activationRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let eventOrganizerService: Record<string, jest.Mock>;
  let githubDb: Record<string, jest.Mock>;
  let eventOverridesService: Record<string, jest.Mock>;
  let reimbursementsService: Record<string, jest.Mock>;

  beforeEach(() => {
    eventRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => d),
      save: jest.fn((e) => Promise.resolve({ id: uuid(10), ...e })),
    };
    ticketTypeRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => d),
      save: jest.fn((t) => Promise.resolve(t)),
      query: jest.fn(),
    };
    orderRepo = {
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      countBy: jest.fn().mockResolvedValue(0),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((o) => Promise.resolve({ id: uuid(30), ...o })),
    };
    registrationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      countBy: jest.fn().mockResolvedValue(0),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((r) => Promise.resolve({ id: uuid(40), ...r })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
      // EntityManager transacional: delega para os mesmos mocks dos repos,
      // assim as asserções existentes (ex.: save/query chamados) continuam
      // valendo dentro de manager.transaction.
      manager: {
        transaction: jest.fn((cb: (em: unknown) => unknown) =>
          cb({
            query: (...args: unknown[]) => ticketTypeRepo.query(...args),
            create: (_target: unknown, d: unknown) =>
              registrationRepo.create(d),
            save: (...args: unknown[]) => registrationRepo.save(...args),
          }),
        ),
      } as unknown as jest.Mock,
    };
    staffRepo = {
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((s) => Promise.resolve({ id: uuid(50), ...s })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    memberRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeMember()),
      findBy: jest.fn().mockResolvedValue([]),
    };
    txRepo = { find: jest.fn().mockResolvedValue([]) };
    stripeService = {
      createEventTicketCheckoutSession: jest
        .fn()
        .mockResolvedValue({ sessionId: 'cs_1', url: 'https://checkout/x' }),
      createEventTicketRefund: jest.fn().mockResolvedValue(undefined),
    };
    ledgerService = {
      getOrCreateCommunityAccount: jest
        .fn()
        .mockResolvedValue({ id: uuid(60) }),
      recordTransaction: jest.fn().mockResolvedValue({}),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    activationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((a) => Promise.resolve({ id: uuid(70), ...a })),
    };
    emailService = {
      sendRegistrationConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    eventOrganizerService = {
      assertCanManage: jest.fn().mockResolvedValue(undefined),
      getOwnedScopes: jest.fn().mockResolvedValue([]),
    };
    githubDb = {
      readFile: jest.fn(),
      listDir: jest.fn(),
      createPRWithFiles: jest.fn(),
    };
    eventOverridesService = {
      findByKeys: jest.fn().mockResolvedValue([]),
      findBySourceKey: jest.fn().mockResolvedValue([]),
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
      eventOverridesService as any,
      reimbursementsService as any,
    );
  });

  // ── Endpoint público (snapshots) ─────────────────────────────────────────

  describe('getPublicManagedEvents', () => {
    it('queries only published events (draft nunca aparece)', async () => {
      eventRepo.find.mockResolvedValue([]);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getPublicManagedEvents();

      expect(eventRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ManagedEventStatus.PUBLISHED },
        }),
      );
      expect(result.source).toMatchObject({
        source: 'internal',
        sourceId: 'codaqui',
        type: 'internal',
      });
      expect(result.events).toEqual([]);
    });

    it('maps published event to the EventItem shape', async () => {
      eventRepo.find.mockResolvedValue([makeEvent()]);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ eventId: uuid(10), count: '3' }]),
      });

      const { events } = await service.getPublicManagedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: uuid(10),
        slug: 'evento-x',
        title: 'Evento X',
        platform: 'Site Codaqui',
        href: '/eventos/evento-x',
        status: 'scheduled',
        userCount: 3,
      });
    });

    it('inclui description quando presente e omite quando null', async () => {
      eventRepo.find.mockResolvedValue([
        makeEvent({ description: 'Texto longo\ncom quebras' }),
        makeEvent({ id: uuid(11) }),
      ]);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const { events } = await service.getPublicManagedEvents();

      expect(events[0].description).toBe('Texto longo\ncom quebras');
      expect(events[1]).not.toHaveProperty('description');
    });

    it('evento com 2 hosts → organizers com name/id/photoUrl (sem e-mail)', async () => {
      eventRepo.find.mockResolvedValue([makeEvent()]);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      staffRepo.findBy.mockResolvedValue([
        { eventId: uuid(10), memberId: uuid(1), staffRole: EventStaffRole.HOST },
        { eventId: uuid(10), memberId: uuid(2), staffRole: EventStaffRole.HOST },
      ]);
      memberRepo.findBy.mockResolvedValue([
        {
          id: uuid(1),
          githubHandle: 'ana',
          name: 'Ana',
          email: 'ana@x.dev',
          avatarUrl: 'https://img/ana.png',
        },
        {
          id: uuid(2),
          githubHandle: 'bia',
          name: 'Bia',
          email: 'bia@x.dev',
          avatarUrl: '',
        },
      ]);

      const { events } = await service.getPublicManagedEvents();

      expect(events[0].organizers).toEqual([
        { name: 'Ana', id: 'ana', photoUrl: 'https://img/ana.png' },
        { name: 'Bia', id: 'bia' }, // photoUrl omitido quando vazio
      ]);
      for (const organizer of events[0].organizers as Array<
        Record<string, unknown>
      >) {
        expect(organizer).not.toHaveProperty('email');
      }
      // Uma query de staffs + uma de members (sem N+1)
      expect(staffRepo.findBy).toHaveBeenCalledTimes(1);
      expect(memberRepo.findBy).toHaveBeenCalledTimes(1);
    });

    it('evento sem host → campo organizers omitido', async () => {
      eventRepo.find.mockResolvedValue([makeEvent()]);
      registrationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      staffRepo.findBy.mockResolvedValue([]);

      const { events } = await service.getPublicManagedEvents();

      expect(events[0]).not.toHaveProperty('organizers');
      expect(memberRepo.findBy).not.toHaveBeenCalled();
    });
  });

  describe('getPublicManagedEvent', () => {
    it('404s for non-published events', async () => {
      eventRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getPublicManagedEvent(uuid(10))).rejects.toThrow(
        NotFoundException,
      );
      expect(eventRepo.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({ status: ManagedEventStatus.PUBLISHED }),
      );
    });

    it('serializa description quando presente', async () => {
      eventRepo.findOneBy.mockResolvedValue(
        makeEvent({ description: 'Texto longo do evento' }),
      );

      const { event } = await service.getPublicManagedEvent(uuid(10));

      expect(event.description).toBe('Texto longo do evento');
    });

    it('inclui organizers (hosts) no evento single, sem e-mail', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      staffRepo.findBy.mockResolvedValue([
        { eventId: uuid(10), memberId: uuid(1), staffRole: EventStaffRole.HOST },
      ]);
      memberRepo.findBy.mockResolvedValue([
        {
          id: uuid(1),
          githubHandle: 'ana',
          name: 'Ana',
          email: 'ana@x.dev',
          avatarUrl: 'https://img/ana.png',
        },
      ]);

      const { event } = await service.getPublicManagedEvent(uuid(10));

      expect(event.organizers).toEqual([
        { name: 'Ana', id: 'ana', photoUrl: 'https://img/ana.png' },
      ]);
      expect(
        (event.organizers as Array<Record<string, unknown>>)[0],
      ).not.toHaveProperty('email');
    });
  });

  // ── RSVP gratuito ─────────────────────────────────────────────────────────

  describe('register', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      ticketTypeRepo.findOneBy.mockResolvedValue(makeTicket());
      registrationRepo.findOneBy.mockResolvedValue(null); // sem duplicata
      ticketTypeRepo.query.mockResolvedValue([{ id: uuid(20) }]); // reserva ok
    });

    it('creates a confirmed registration with checkinToken', async () => {
      const result = await service.register(
        uuid(10),
        { ticketTypeId: uuid(20) },
        user(),
      );

      expect(result.status).toBe(RegistrationStatus.CONFIRMED);
      expect(result.checkinToken).toBeTruthy();
      expect(result.attendeeEmail).toBe('ana@x.dev');
      expect(result.orderId).toBeNull();
    });

    it('409: um membro não se inscreve 2× no mesmo evento', async () => {
      registrationRepo.findOneBy.mockResolvedValue({ id: uuid(41) });

      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(ConflictException);
      // Não reserva quota para duplicata
      expect(ticketTypeRepo.query).not.toHaveBeenCalled();
    });

    it('anti-oversell: 2 chamadas concorrentes disputando 1 vaga → exatamente 1 sucesso', async () => {
      // Simula o UPDATE atômico: a 2ª chamada não retorna linha (lote esgotado)
      ticketTypeRepo.query
        .mockResolvedValueOnce([{ id: uuid(20) }])
        .mockResolvedValueOnce([]);

      const results = await Promise.allSettled([
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
        service.register(
          uuid(10),
          { ticketTypeId: uuid(20) },
          user({ sub: uuid(2), handle: 'bia' }),
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain(
        'Lote esgotado',
      );
    });

    it('409 when event capacity is full', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent({ capacity: 1 }));
      registrationRepo.countBy.mockResolvedValue(1);

      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(ConflictException);
    });

    it('400 for paid ticket type (use checkout) and unpublished event', async () => {
      ticketTypeRepo.findOneBy.mockResolvedValue(
        makeTicket({ kind: 'paid', priceCents: 5000 }),
      );
      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(BadRequestException);

      eventRepo.findOneBy.mockResolvedValue(
        makeEvent({ status: ManagedEventStatus.DRAFT }),
      );
      ticketTypeRepo.findOneBy.mockResolvedValue(makeTicket());
      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(BadRequestException);
    });

    it('400 quando o membro não tem e-mail no perfil — quota nunca é reservada', async () => {
      memberRepo.findOneBy.mockResolvedValue({ ...makeMember(), email: '  ' });

      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(
        new BadRequestException(
          'Complete seu e-mail no perfil antes de se inscrever.',
        ),
      );
      expect(registrationRepo.manager.transaction).not.toHaveBeenCalled();
      expect(ticketTypeRepo.query).not.toHaveBeenCalled();
      expect(registrationRepo.save).not.toHaveBeenCalled();
    });

    it('400 quando o membro não tem nome no perfil — quota nunca é reservada', async () => {
      memberRepo.findOneBy.mockResolvedValue({ ...makeMember(), name: '' });

      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow(BadRequestException);
      expect(registrationRepo.manager.transaction).not.toHaveBeenCalled();
      expect(ticketTypeRepo.query).not.toHaveBeenCalled();
    });

    it('reserva quota e salva inscrição na mesma transação', async () => {
      await service.register(uuid(10), { ticketTypeId: uuid(20) }, user());

      expect(registrationRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ticket_types'),
        [1, uuid(20)],
      );
      expect(registrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RegistrationStatus.CONFIRMED }),
      );
    });

    it('falha no save dentro da transação → rollback (quota não vaza)', async () => {
      // Simula o EntityManager "staging" da transação: as escritas só valeriam
      // no commit; como o save falha, nada escapa para os repos reais.
      const stagingEm = {
        query: jest.fn().mockResolvedValue([{ id: uuid(20) }]),
        create: jest.fn((_target: unknown, d: unknown) => ({ ...(d as object) })),
        save: jest.fn().mockRejectedValue(new Error('db down')),
      };
      registrationRepo.manager.transaction.mockImplementationOnce(
        (cb: (em: unknown) => unknown) => cb(stagingEm),
      );

      await expect(
        service.register(uuid(10), { ticketTypeId: uuid(20) }, user()),
      ).rejects.toThrow('db down');
      // O UPDATE de quota rodou apenas dentro da transação que falhou.
      expect(stagingEm.query).toHaveBeenCalled();
      expect(ticketTypeRepo.query).not.toHaveBeenCalled();
      expect(registrationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelRegistration', () => {
    const registration = () => ({
      id: uuid(40),
      eventId: uuid(10),
      ticketTypeId: uuid(20),
      memberId: uuid(1),
      status: RegistrationStatus.CONFIRMED,
    });

    it('owner cancels and quota is returned (GREATEST ≥ 0)', async () => {
      registrationRepo.findOneBy.mockResolvedValue(registration());

      await service.cancelRegistration(uuid(40), user());

      expect(registrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RegistrationStatus.CANCELLED }),
      );
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [1, uuid(20)],
      );
    });

    it('save de cancelamento e release de quota acontecem na mesma transação', async () => {
      registrationRepo.findOneBy.mockResolvedValue(registration());

      await service.cancelRegistration(uuid(40), user());

      expect(registrationRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(registrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RegistrationStatus.CANCELLED }),
      );
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [1, uuid(20)],
      );
    });

    it('403 for non-owner without staff/admin', async () => {
      registrationRepo.findOneBy.mockResolvedValue(registration());
      staffRepo.findBy.mockResolvedValue([]); // não é staff

      await expect(
        service.cancelRegistration(uuid(40), user({ sub: uuid(2) })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('staff do evento pode cancelar inscrição de terceiro', async () => {
      registrationRepo.findOneBy.mockResolvedValue(registration());
      staffRepo.findBy.mockResolvedValue([
        {
          eventId: uuid(10),
          memberId: uuid(2),
          staffRole: EventStaffRole.HOST,
        },
      ]);

      await service.cancelRegistration(uuid(40), user({ sub: uuid(2) }));

      expect(registrationRepo.save).toHaveBeenCalled();
    });

    it('409 quando a inscrição está vinculada a pedido PAGO (usar fluxo de estorno)', async () => {
      registrationRepo.findOneBy.mockResolvedValue({
        ...registration(),
        orderId: uuid(30),
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: uuid(30),
        status: OrderStatus.PAID,
      });

      await expect(
        service.cancelRegistration(uuid(40), user()),
      ).rejects.toThrow(ConflictException);
      expect(registrationRepo.save).not.toHaveBeenCalled();
    });

    it('cancela normalmente quando a order não está paga (ex.: expirada)', async () => {
      registrationRepo.findOneBy.mockResolvedValue({
        ...registration(),
        orderId: uuid(30),
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: uuid(30),
        status: OrderStatus.EXPIRED,
      });

      await service.cancelRegistration(uuid(40), user());

      expect(registrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RegistrationStatus.CANCELLED }),
      );
    });
  });

  // ── Reconciliação de quota ───────────────────────────────────────────────

  describe('reconcileQuota', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
    });

    it('corrige drift de quantitySold (before 2 → after 1) e registra audit', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([makeTicket({ quantitySold: 2 })]);
      registrationRepo.countBy.mockResolvedValue(1); // 1 registration CONFIRMED
      orderRepo.findBy.mockResolvedValue([]); // sem orders pending

      const result = await service.reconcileQuota(uuid(10), adminUser);

      expect(result).toEqual({
        eventId: uuid(10),
        results: [
          {
            ticketTypeId: uuid(20),
            name: 'Gratuito',
            before: 2,
            after: 1,
            adjusted: true,
          },
        ],
      });
      expect(ticketTypeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: uuid(20), quantitySold: 1 }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'event.quota_reconciled',
          targetId: uuid(10),
        }),
      );
    });

    it('sem drift → adjusted=false, sem save e sem audit', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([makeTicket({ quantitySold: 1 })]);
      registrationRepo.countBy.mockResolvedValue(1);
      orderRepo.findBy.mockResolvedValue([]);

      const result = await service.reconcileQuota(uuid(10), adminUser);

      expect(result.results[0]).toMatchObject({
        before: 1,
        after: 1,
        adjusted: false,
      });
      expect(ticketTypeRepo.save).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('soma orders PENDING na quota esperada', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([makeTicket({ quantitySold: 3 })]);
      registrationRepo.countBy.mockResolvedValue(1);
      orderRepo.findBy.mockResolvedValue([
        { id: uuid(30), quantity: 2, status: OrderStatus.PENDING },
      ]);

      const result = await service.reconcileQuota(uuid(10), adminUser);

      expect(result.results[0]).toMatchObject({
        before: 3,
        after: 3,
        adjusted: false,
      });
      expect(ticketTypeRepo.save).not.toHaveBeenCalled();
    });

    it('403 para membro sem papel de gestão', async () => {
      await expect(service.reconcileQuota(uuid(10), user())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── Checkout pago ─────────────────────────────────────────────────────────

  describe('checkout', () => {
    const paidTicket = () =>
      makeTicket({
        id: uuid(21),
        kind: 'paid',
        priceCents: 5000,
        quantityTotal: 10,
      });

    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      ticketTypeRepo.findOneBy.mockResolvedValue(paidTicket());
      ticketTypeRepo.query.mockResolvedValue([{ id: uuid(21) }]);
    });

    it('400 quando acceptTerms não é true (conformidade CDC)', async () => {
      await expect(
        service.checkout(
          uuid(10),
          { ticketTypeId: uuid(21), quantity: 1, acceptTerms: false },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(ticketTypeRepo.query).not.toHaveBeenCalled();
      expect(
        stripeService.createEventTicketCheckoutSession,
      ).not.toHaveBeenCalled();
    });

    it('400 quando quantity excede maxPerOrder', async () => {
      await expect(
        service.checkout(
          uuid(10),
          { ticketTypeId: uuid(21), quantity: 5, acceptTerms: true },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('409 quando a reserva atômica não retorna linha (lote esgotado/janela)', async () => {
      ticketTypeRepo.query.mockResolvedValue([]);

      await expect(
        service.checkout(
          uuid(10),
          { ticketTypeId: uuid(21), quantity: 1, acceptTerms: true },
          user(),
        ),
      ).rejects.toThrow(ConflictException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('creates pending order with termsVersion and returns the Stripe url', async () => {
      const result = await service.checkout(
        uuid(10),
        { ticketTypeId: uuid(21), quantity: 1, acceptTerms: true },
        user(),
      );

      expect(result).toEqual({ url: 'https://checkout/x' });
      const created = orderRepo.create.mock.calls[0][0];
      expect(created).toMatchObject({
        status: OrderStatus.PENDING,
        totalCents: 5000,
        quantity: 1,
        termsVersion: EVENT_TICKET_TERMS_VERSION,
      });
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const sessionArgs =
        stripeService.createEventTicketCheckoutSession.mock.calls[0][0];
      expect(sessionArgs.metadata).toMatchObject({
        entityType: 'event-ticket',
        eventId: uuid(10),
        orderId: uuid(30),
        communityId: 'devparana',
      });
      expect(JSON.parse(sessionArgs.metadata.attendees)).toHaveLength(1);
      expect(sessionArgs.unitAmountCents).toBe(5000);
      expect(sessionArgs.quantity).toBe(1);
    });

    it('rolls back quota and cancels order when Stripe fails', async () => {
      stripeService.createEventTicketCheckoutSession.mockRejectedValue(
        new Error('stripe down'),
      );

      await expect(
        service.checkout(
          uuid(10),
          { ticketTypeId: uuid(21), quantity: 1, acceptTerms: true },
          user(),
        ),
      ).rejects.toThrow('stripe down');

      // devolução com GREATEST
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [1, uuid(21)],
      );
    });
  });

  // ── Cron de expiração ─────────────────────────────────────────────────────

  describe('expirePendingOrders (cron)', () => {
    it('expires pending orders and returns quota', async () => {
      const expired = {
        id: uuid(30),
        ticketTypeId: uuid(21),
        quantity: 3,
        status: OrderStatus.PENDING,
      };
      orderRepo.findBy.mockResolvedValue([expired]);

      await service.expirePendingOrders();

      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.EXPIRED }),
      );
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [3, uuid(21)],
      );
    });
  });

  // ── Refund ────────────────────────────────────────────────────────────────

  describe('refundOrder', () => {
    const paidOrder = () => ({
      id: uuid(30),
      eventId: uuid(10),
      ticketTypeId: uuid(21),
      quantity: 3,
      memberId: uuid(1),
      totalCents: 15000,
      status: OrderStatus.PAID,
      stripePaymentIntentId: 'pi_123',
    });

    beforeEach(() => {
      orderRepo.findOneBy.mockResolvedValue(paidOrder());
      ticketTypeRepo.findOneBy.mockResolvedValue(
        makeTicket({ id: uuid(21), kind: 'paid', priceCents: 5000 }),
      );
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      registrationRepo.findBy.mockResolvedValue([
        { id: uuid(41) },
        { id: uuid(42) },
        { id: uuid(43) },
      ]);
    });

    it('400 quando a order não está paga', async () => {
      orderRepo.findOneBy.mockResolvedValue({
        ...paidOrder(),
        status: OrderStatus.PENDING,
      });

      await expect(
        service.refundOrder(uuid(30), {}, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('refund total: Stripe sem amount, order → refunded, quota devolvida, reversal no ledger', async () => {
      const result = await service.refundOrder(uuid(30), {}, adminUser);

      expect(stripeService.createEventTicketRefund).toHaveBeenCalledWith(
        'pi_123',
        undefined,
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.REFUNDED }),
      );
      expect(registrationRepo.update).toHaveBeenCalledWith(
        { id: expect.anything() },
        { status: RegistrationStatus.REFUNDED },
      );
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [3, uuid(21)],
      );
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(60),
        uuid(60),
        150, // R$ 150,00
        expect.stringContaining('Estorno de ingressos'),
        expect.stringMatching(/^event-ticket-refund:/),
        expect.objectContaining({
          eventId: uuid(10),
          ticketTypeId: uuid(21),
          orderId: uuid(30),
          communityProjectKey: 'devparana',
          externalActivationId: undefined,
        }),
      );
      expect(result.full).toBe(true);
    });

    it('refund parcial: amount = N × unitário, order permanece paid, quota das selecionadas devolvida', async () => {
      const result = await service.refundOrder(
        uuid(30),
        { registrationIds: [uuid(41), uuid(42)] },
        adminUser,
      );

      expect(stripeService.createEventTicketRefund).toHaveBeenCalledWith(
        'pi_123',
        10000, // 2 × R$ 50
      );
      // order NÃO vai para refunded (resta 1 confirmada)
      expect(orderRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.REFUNDED }),
      );
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [2, uuid(21)],
      );
      expect(result).toMatchObject({
        refundedRegistrations: 2,
        amountCents: 10000,
        full: false,
        orderStatus: OrderStatus.PAID,
      });
    });

    it('400 para registrationIds que não pertencem à order', async () => {
      await expect(
        service.refundOrder(
          uuid(30),
          { registrationIds: [uuid(99)] },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('evento externo (eventId null): estorna resolvendo conta pela ativação', async () => {
      orderRepo.findOneBy.mockResolvedValue({
        ...paidOrder(),
        eventId: null,
        externalActivationId: uuid(70),
      });
      activationRepo.findOneBy.mockResolvedValue({
        id: uuid(70),
        communityProjectKey: 'elasnocodigo',
        title: 'Meetup Elas',
      });
      registrationRepo.findBy.mockResolvedValue([
        { id: uuid(41) },
        { id: uuid(42) },
        { id: uuid(43) },
      ]);

      const result = await service.refundOrder(uuid(30), {}, adminUser);

      expect(result.full).toBe(true);
      expect(stripeService.createEventTicketRefund).toHaveBeenCalledWith(
        'pi_123',
        undefined,
      );
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(60),
        uuid(60),
        150,
        expect.stringContaining('Meetup Elas'),
        expect.stringMatching(/^event-ticket-refund:/),
        expect.objectContaining({
          eventId: undefined,
          communityProjectKey: 'elasnocodigo',
          externalActivationId: uuid(70),
        }),
      );
    });

    it('400 quando a order não tem evento nem ativação vinculados', async () => {
      orderRepo.findOneBy.mockResolvedValue({
        ...paidOrder(),
        eventId: null,
        externalActivationId: null,
      });

      await expect(
        service.refundOrder(uuid(30), {}, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('refund parcial usa o valor pago na order, não o preço atual do lote', async () => {
      // Lote subiu para R$ 70 após a compra de 3 × R$ 50 (totalCents 15000)
      ticketTypeRepo.findOneBy.mockResolvedValue(
        makeTicket({ id: uuid(21), kind: 'paid', priceCents: 7000 }),
      );

      const result = await service.refundOrder(
        uuid(30),
        { registrationIds: [uuid(41), uuid(42)] },
        adminUser,
      );

      expect(stripeService.createEventTicketRefund).toHaveBeenCalledWith(
        'pi_123',
        10000, // 2 × R$ 50 (valor pago), NÃO 2 × R$ 70
      );
      expect(result.amountCents).toBe(10000);
    });
  });

  // ── Comprovante ───────────────────────────────────────────────────────────

  describe('getReceipt', () => {
    const paidOrder = () => ({
      id: uuid(30),
      eventId: uuid(10),
      ticketTypeId: uuid(21),
      quantity: 2,
      memberId: uuid(1),
      totalCents: 10000,
      status: OrderStatus.PAID,
      paidAt: new Date('2026-07-01T12:00:00Z'),
      termsVersion: EVENT_TICKET_TERMS_VERSION,
    });

    beforeEach(() => {
      orderRepo.findOneBy.mockResolvedValue(paidOrder());
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      ticketTypeRepo.findOneBy.mockResolvedValue(
        makeTicket({
          id: uuid(21),
          kind: 'paid',
          priceCents: 5000,
          name: 'Lote 1',
        }),
      );
    });

    it('403 para não-dono sem role finance/admin', async () => {
      await expect(
        service.getReceipt(uuid(30), user({ sub: uuid(2) })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('dono recebe o comprovante no shape do contrato', async () => {
      const receipt = await service.getReceipt(uuid(30), user());

      expect(receipt).toMatchObject({
        orderId: uuid(30),
        eventTitle: 'Evento X',
        buyerName: 'Ana',
        buyerEmail: 'ana@x.dev',
        items: [{ ticketName: 'Lote 1', quantity: 2, unitPriceCents: 5000 }],
        totalCents: 10000,
        termsVersion: EVENT_TICKET_TERMS_VERSION,
      });
      expect(receipt.verificationCode).toMatch(/^EVT-/);
    });

    it('event_finance acessa comprovante de terceiro', async () => {
      const finance = user({
        sub: uuid(3),
        roles: ['membro', 'event_finance'],
      });
      const receipt = await service.getReceipt(uuid(30), finance);
      expect(receipt.orderId).toBe(uuid(30));
    });

    it('400 para order não paga', async () => {
      orderRepo.findOneBy.mockResolvedValue({
        ...paidOrder(),
        status: OrderStatus.PENDING,
      });
      await expect(service.getReceipt(uuid(30), user())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Gestão: publish / ticket types / staff ────────────────────────────────

  describe('publishEvent', () => {
    it('draft → published com audit', async () => {
      eventRepo.findOneBy.mockResolvedValue(
        makeEvent({ status: ManagedEventStatus.DRAFT }),
      );

      await service.publishEvent(uuid(10), adminUser);

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ManagedEventStatus.PUBLISHED }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'event.published' }),
      );
    });

    it('400 quando não está em draft', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent()); // published
      await expect(service.publishEvent(uuid(10), adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createTicketType', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
    });

    it('400: free com priceCents > 0 / paid com priceCents = 0', async () => {
      await expect(
        service.createTicketType(
          uuid(10),
          {
            name: 'X',
            kind: 'free' as any,
            priceCents: 100,
            quantityTotal: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createTicketType(
          uuid(10),
          {
            name: 'Y',
            kind: 'paid' as any,
            priceCents: 0,
            quantityTotal: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('400: ingresso pago em evento com capacity (RSVP gratuito)', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent({ capacity: 100 }));

      await expect(
        service.createTicketType(
          uuid(10),
          {
            name: 'Pago',
            kind: 'paid' as any,
            priceCents: 5000,
            quantityTotal: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ingresso gratuito em evento com capacity → ok', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent({ capacity: 100 }));

      await expect(
        service.createTicketType(
          uuid(10),
          {
            name: 'Gratuito',
            kind: 'free' as any,
            priceCents: 0,
            quantityTotal: 10,
          },
          adminUser,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('updateEvent — capacity', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
    });

    it('400: definir capacity com lotes pagos existentes', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([
        makeTicket({ kind: 'paid', priceCents: 5000 }),
      ]);

      await expect(
        service.updateEvent(uuid(10), { capacity: 100 }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('capacity null com lotes pagos existentes → ok', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([
        makeTicket({ kind: 'paid', priceCents: 5000 }),
      ]);

      await expect(
        service.updateEvent(uuid(10), { capacity: null }, adminUser),
      ).resolves.toBeDefined();
    });

    it('definir capacity sem lotes pagos → ok', async () => {
      ticketTypeRepo.findBy.mockResolvedValue([makeTicket()]);

      await expect(
        service.updateEvent(uuid(10), { capacity: 100 }, adminUser),
      ).resolves.toBeDefined();
    });
  });

  describe('createEvent — description', () => {
    const baseDto = {
      slug: 'evento-y',
      title: 'Evento Y',
      summary: 'Resumo',
      location: 'Maringá',
      startAt: '2026-10-01T19:00',
      communityProjectKey: 'devparana',
    };

    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(null); // slug livre
    });

    it('persiste description informada', async () => {
      await service.createEvent(
        { ...baseDto, description: 'Texto longo\ncom quebras' },
        adminUser,
      );

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Texto longo\ncom quebras',
        }),
      );
    });

    it('description ausente → null', async () => {
      await service.createEvent(baseDto, adminUser);

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });
  });

  describe('updateEvent — description', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
    });

    it('altera description', async () => {
      await service.updateEvent(
        uuid(10),
        { description: 'Novo texto longo' },
        adminUser,
      );

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Novo texto longo' }),
      );
    });

    it('string vazia limpa o campo (→ null)', async () => {
      eventRepo.findOneBy.mockResolvedValue(
        makeEvent({ description: 'Texto antigo' }),
      );

      await service.updateEvent(uuid(10), { description: '' }, adminUser);

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it('description omitida no DTO não altera o valor atual', async () => {
      eventRepo.findOneBy.mockResolvedValue(
        makeEvent({ description: 'Texto antigo' }),
      );

      await service.updateEvent(uuid(10), { title: 'Só título' }, adminUser);

      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Texto antigo' }),
      );
    });
  });

  describe('staff', () => {
    beforeEach(() => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
    });

    it('addStaff valida membro e evita duplicata (eventId, memberId, role)', async () => {
      staffRepo.findOneBy.mockResolvedValue(null);

      const result = await service.addStaff(
        uuid(10),
        { memberId: uuid(1), staffRole: EventStaffRole.HOST },
        adminUser,
      );

      expect(result).toMatchObject({
        memberId: uuid(1),
        staffRole: EventStaffRole.HOST,
      });

      staffRepo.findOneBy.mockResolvedValue({ id: uuid(50) });
      await expect(
        service.addStaff(
          uuid(10),
          { memberId: uuid(1), staffRole: EventStaffRole.HOST },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('addStaff 404 quando membro não existe', async () => {
      memberRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.addStaff(
          uuid(10),
          { memberId: uuid(1), staffRole: EventStaffRole.CHECKER },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('permissões de gestão', () => {
    it('membro sem role global não lista eventos', async () => {
      await expect(service.listEvents(user())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('host do evento edita dados básicos; checker não', async () => {
      eventRepo.findOneBy.mockResolvedValue(makeEvent());
      staffRepo.findBy.mockResolvedValue([
        {
          eventId: uuid(10),
          memberId: uuid(1),
          staffRole: EventStaffRole.HOST,
        },
      ]);

      await service.updateEvent(uuid(10), { title: 'Novo título' }, user());
      expect(eventRepo.save).toHaveBeenCalled();

      staffRepo.findBy.mockResolvedValue([
        {
          eventId: uuid(10),
          memberId: uuid(1),
          staffRole: EventStaffRole.CHECKER,
        },
      ]);
      await expect(
        service.updateEvent(uuid(10), { title: 'X' }, user()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCheckinScope', () => {
    const managedEvent = makeEvent({
      id: uuid(10),
      title: 'Evento Próprio',
      status: ManagedEventStatus.PUBLISHED,
    });
    const externalActivation = {
      id: uuid(70),
      eventKey: 'meetup:devparana:abc123',
      title: 'Evento Externo',
      features: ['checkin', 'certificates'],
      communityProjectKey: 'devparana',
      enabledByMemberId: uuid(5),
      startAt: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      eventRepo.find.mockResolvedValue([managedEvent]);
      eventRepo.findBy.mockResolvedValue([managedEvent]);
      activationRepo.find.mockResolvedValue([externalActivation]);
    });

    it('admin vê todos os eventos com canUseList=true', async () => {
      const result = await service.getCheckinScope(adminUser);

      expect(result.managed).toHaveLength(1);
      expect(result.managed[0]).toMatchObject({
        id: uuid(10),
        canUseList: true,
      });
      expect(result.external).toHaveLength(1);
      expect(result.external[0]).toMatchObject({
        eventKey: 'meetup:devparana:abc123',
        canUseList: true,
      });
    });

    it('event_checker global vê todos os eventos, mas canUseList=false', async () => {
      const checker = user({ roles: ['membro', 'event_checker'] });
      const result = await service.getCheckinScope(checker);

      expect(result.managed).toHaveLength(1);
      expect(result.managed[0].canUseList).toBe(false);
      expect(result.external).toHaveLength(1);
      expect(result.external[0].canUseList).toBe(false);
    });

    it('staff host local vê apenas o próprio evento com canUseList=true', async () => {
      const host = user({ sub: uuid(2), handle: 'host' });
      staffRepo.findBy.mockResolvedValue([
        {
          eventId: uuid(10),
          memberId: uuid(2),
          staffRole: EventStaffRole.HOST,
        },
      ]);

      const result = await service.getCheckinScope(host);

      expect(result.managed).toHaveLength(1);
      expect(result.managed[0]).toMatchObject({
        id: uuid(10),
        canUseList: true,
      });
      expect(result.external).toHaveLength(0);
    });

    it('staff checker local vê apenas o próprio evento com canUseList=false', async () => {
      const checker = user({ sub: uuid(2), handle: 'checker' });
      staffRepo.findBy.mockResolvedValue([
        {
          eventId: uuid(10),
          memberId: uuid(2),
          staffRole: EventStaffRole.CHECKER,
        },
      ]);

      const result = await service.getCheckinScope(checker);

      expect(result.managed).toHaveLength(1);
      expect(result.managed[0]).toMatchObject({
        id: uuid(10),
        canUseList: false,
      });
      expect(result.external).toHaveLength(0);
    });

    it('owner externo vê a ativação com canUseList=true', async () => {
      const owner = user({ sub: uuid(5), handle: 'owner' });
      eventOrganizerService.getOwnedScopes.mockResolvedValue([
        'meetup:devparana:*',
      ]);

      const result = await service.getCheckinScope(owner);

      expect(result.managed).toHaveLength(0);
      expect(result.external).toHaveLength(1);
      expect(result.external[0]).toMatchObject({
        eventKey: 'meetup:devparana:abc123',
        canUseList: true,
      });
    });

    it('membro comum sem permissão recebe escopos vazios', async () => {
      staffRepo.findBy.mockResolvedValue([]);
      const result = await service.getCheckinScope(user());

      expect(result.managed).toHaveLength(0);
      expect(result.external).toHaveLength(0);
    });
  });
});
