import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';

const user: JwtPayload = {
  sub: 'cb624416-77e3-4f8f-a6be-70e7487eec65',
  githubId: '11020807',
  handle: 'endersonmenezes',
  name: 'Enderson Menezes',
  email: 'enderson@codaqui.dev',
  avatarUrl: 'https://example.com/avatar.png',
  roles: ['admin'],
};

describe('EventsController', () => {
  let controller: EventsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      getPublicManagedEvents: jest.fn().mockResolvedValue({ source: {}, events: [] }),
      getPublicManagedEvent: jest.fn().mockResolvedValue({ event: {}, ticketTypes: [] }),
      listEvents: jest.fn().mockResolvedValue([]),
      getCheckinScope: jest.fn().mockResolvedValue({ managed: [], external: [] }),
      createEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      getEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      updateEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      publishEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      cancelEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      createTicketType: jest.fn().mockResolvedValue({ id: 'tt-1' }),
      addStaff: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      removeStaff: jest.fn().mockResolvedValue(undefined),
      myRegistrations: jest.fn().mockResolvedValue([]),
      getCertificate: jest.fn().mockResolvedValue({ code: 'CRT-1' }),
      verifyCertificate: jest.fn().mockResolvedValue({ valid: true }),
      getReceipt: jest.fn().mockResolvedValue({ orderId: 'order-1' }),
      refundOrder: jest.fn().mockResolvedValue({ full: true }),
      cancelRegistration: jest.fn().mockResolvedValue(undefined),
      updateTicketType: jest.fn().mockResolvedValue({ id: 'tt-1' }),
      checkin: jest.fn().mockResolvedValue({ status: 'checked_in' }),
      listRegistrations: jest.fn().mockResolvedValue([]),
      getEventReport: jest.fn().mockResolvedValue({}),
      listOrders: jest.fn().mockResolvedValue([]),
      getEventLedger: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      createEventReimbursement: jest.fn().mockResolvedValue({ id: 'r-1' }),
      createExternalEventReimbursement: jest.fn().mockResolvedValue({ id: 'r-1' }),
      syncInternalSnapshot: jest.fn().mockResolvedValue({ prNumber: 1 }),
      listActivations: jest.fn().mockResolvedValue([]),
      listMemberRegistrations: jest.fn().mockResolvedValue([]),
      listExternalTicketTypes: jest.fn().mockResolvedValue([]),
      listExternalTicketTypesManage: jest.fn().mockResolvedValue([]),
      createExternalTicketType: jest.fn().mockResolvedValue({ id: 'tt-ext-1' }),
      updateExternalTicketType: jest.fn().mockResolvedValue({ id: 'tt-ext-1' }),
      checkoutExternal: jest.fn().mockResolvedValue({ url: 'https://checkout' }),
      activateExternal: jest.fn().mockResolvedValue({ id: 'act-1' }),
      getActivation: jest.fn().mockResolvedValue({ id: 'act-1' }),
      listExternalOrders: jest.fn().mockResolvedValue([]),
      getExternalEventLedger: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      importParticipants: jest.fn().mockResolvedValue({ imported: 0 }),
      rematchParticipants: jest.fn().mockResolvedValue({ rematched: 0 }),
      listExternalParticipants: jest.fn().mockResolvedValue([]),
      checkinExternal: jest.fn().mockResolvedValue({ status: 'checked_in' }),
      register: jest.fn().mockResolvedValue({ id: 'reg-1' }),
      checkout: jest.fn().mockResolvedValue({ url: 'https://checkout' }),
      reconcilePaidOrdersLedger: jest.fn().mockResolvedValue({ reconciled: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EventsController>(EventsController);
  });

  describe('público', () => {
    it('GET /events/public/managed', async () => {
      const result = await controller.getPublicManagedEvents();
      expect(service.getPublicManagedEvents).toHaveBeenCalled();
      expect(result).toEqual({ source: {}, events: [] });
    });

    it('GET /events/public/managed/:id', async () => {
      const result = await controller.getPublicManagedEvent('evt-1');
      expect(service.getPublicManagedEvent).toHaveBeenCalledWith('evt-1');
      expect(result).toEqual({ event: {}, ticketTypes: [] });
    });
  });

  describe('gestão', () => {
    it('GET /events delega ao service', async () => {
      const query = { page: 1, limit: 10 } as any;
      const result = await controller.listEvents(query, { user });
      expect(service.listEvents).toHaveBeenCalledWith(user, query);
      expect(result).toEqual([]);
    });

    it('GET /events/checkin-scope delega ao service', async () => {
      const result = await controller.getCheckinScope({ user });
      expect(service.getCheckinScope).toHaveBeenCalledWith(user);
      expect(result).toEqual({ managed: [], external: [] });
    });

    it('POST /events cria evento', async () => {
      const dto = {
        slug: 'meu-evento',
        title: 'Meu Evento',
        summary: 'Resumo',
        location: 'Maringá',
        startAt: '2026-08-01T09:00',
        communityProjectKey: 'devparana',
      } as any;
      const result = await controller.createEvent(dto, { user });
      expect(service.createEvent).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual({ id: 'evt-1' });
    });

    it('GET /events/:id', async () => {
      const result = await controller.getEvent('evt-1', { user });
      expect(service.getEvent).toHaveBeenCalledWith('evt-1', user);
      expect(result).toEqual({ id: 'evt-1' });
    });

    it('PATCH /events/:id', async () => {
      const dto = { title: 'Novo' } as any;
      const result = await controller.updateEvent('evt-1', dto, { user });
      expect(service.updateEvent).toHaveBeenCalledWith('evt-1', dto, user);
    });

    it('POST /events/:id/publish', async () => {
      const result = await controller.publishEvent('evt-1', { user });
      expect(service.publishEvent).toHaveBeenCalledWith('evt-1', user);
    });

    it('POST /events/:id/cancel', async () => {
      const result = await controller.cancelEvent('evt-1', { user });
      expect(service.cancelEvent).toHaveBeenCalledWith('evt-1', user);
    });

    it('POST /events/:id/ticket-types', async () => {
      const dto = {
        name: 'Lote 1',
        kind: 'paid',
        priceCents: 5000,
        quantityTotal: 100,
      } as any;
      const result = await controller.createTicketType('evt-1', dto, { user });
      expect(service.createTicketType).toHaveBeenCalledWith('evt-1', dto, user);
    });

    it('POST /events/:id/staff', async () => {
      const dto = { memberId: 'mem-1', staffRole: 'checker' } as any;
      const result = await controller.addStaff('evt-1', dto, { user });
      expect(service.addStaff).toHaveBeenCalledWith('evt-1', dto, user);
    });
  });

  describe('inscrição / checkout / check-in', () => {
    it('GET /events/my-registrations', async () => {
      const result = await controller.myRegistrations({ user });
      expect(service.myRegistrations).toHaveBeenCalledWith(user);
    });

    it('POST /events/:id/register', async () => {
      const dto = { ticketTypeId: 'tt-1' } as any;
      const result = await controller.register('evt-1', dto, { user });
      expect(service.register).toHaveBeenCalledWith('evt-1', dto, user);
    });

    it('POST /events/:id/checkout', async () => {
      const dto = {
        ticketTypeId: 'tt-1',
        quantity: 1,
        acceptTerms: true,
      } as any;
      const result = await controller.checkout('evt-1', dto, { user });
      expect(service.checkout).toHaveBeenCalledWith('evt-1', dto, user);
    });

    it('POST /events/:id/checkin', async () => {
      const dto = { token: 'abc123' } as any;
      const result = await controller.checkin('evt-1', dto, { user });
      expect(service.checkin).toHaveBeenCalledWith('evt-1', dto.token, user);
    });

    it('GET /events/:id/registrations', async () => {
      const result = await controller.listRegistrations('evt-1', 'ana', { user });
      expect(service.listRegistrations).toHaveBeenCalledWith(
        'evt-1',
        { search: 'ana' },
        user,
      );
    });

    it('GET /events/:id/report', async () => {
      const result = await controller.getEventReport('evt-1', { user });
      expect(service.getEventReport).toHaveBeenCalledWith('evt-1', user);
    });

    it('GET /events/:id/orders', async () => {
      const result = await controller.listOrders('evt-1', { user });
      expect(service.listOrders).toHaveBeenCalledWith('evt-1', user);
    });

    it('GET /events/registrations/:id/certificate', async () => {
      const result = await controller.getCertificate('reg-1', { user });
      expect(service.getCertificate).toHaveBeenCalledWith('reg-1', user);
    });
  });

  describe('eventos externos', () => {
    it('GET /events/external/activations', async () => {
      const result = await controller.listActivations({ user });
      expect(service.listActivations).toHaveBeenCalledWith(user);
    });

    it('POST /events/external/:eventKey/activate', async () => {
      const dto = {
        features: ['checkin', 'payments'],
        communityProjectKey: 'devparana',
      } as any;
      const result = await controller.activateExternal('meetup:devparana:1', dto, { user });
      expect(service.activateExternal).toHaveBeenCalledWith(
        'meetup:devparana:1',
        dto,
        user,
      );
    });

    it('POST /events/external/:eventKey/checkout', async () => {
      const dto = {
        ticketTypeId: 'tt-ext-1',
        quantity: 1,
        acceptTerms: true,
      } as any;
      const result = await controller.checkoutExternal('meetup:devparana:1', dto, { user });
      expect(service.checkoutExternal).toHaveBeenCalledWith(
        'meetup:devparana:1',
        dto,
        user,
      );
    });

    it('POST /events/external/:eventKey/participants/import', async () => {
      const result = await controller.importParticipants(
        'meetup:devparana:1',
        'name,email\nAna,ana@x.dev',
        { user },
      );
      expect(service.importParticipants).toHaveBeenCalledWith(
        'meetup:devparana:1',
        'name,email\nAna,ana@x.dev',
        user,
      );
    });
  });
});
