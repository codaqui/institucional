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
    };
    staffRepo = {
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((s) => Promise.resolve({ id: uuid(50), ...s })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    memberRepo = { findOneBy: jest.fn().mockResolvedValue(makeMember()) };
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
        title: 'Evento X',
        platform: 'Site Codaqui',
        href: `/eventos/detalhe?source=internal&sourceId=codaqui&id=${uuid(10)}`,
        status: 'scheduled',
        userCount: 3,
      });
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
