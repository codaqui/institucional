import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { ManagedEvent } from './entities/managed-event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { EventOrder } from './entities/event-order.entity';
import { EventRegistration } from './entities/event-registration.entity';
import { EventStaff } from './entities/event-staff.entity';
import { ExternalEventActivation } from './entities/external-event-activation.entity';
import { Member } from '../members/entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { StripeService } from '../stripe/stripe.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';
import { EventOrganizerService } from '../event-organizer/event-organizer.service';
import { GitHubDBService } from '../github-db/github-db.service';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';

const dummyRepo = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
  remove: jest.fn(),
  query: jest.fn(),
  countBy: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ sum: '0', count: '0' }),
  })),
  update: jest.fn(),
  softRemove: jest.fn(),
  restore: jest.fn(),
  delete: jest.fn(),
};

const dummyService = {};

describe('EventsModule DI', () => {
  it('deve compilar EventsController + EventsService sem erros de injeção de dependência', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        EventsService,
        { provide: getRepositoryToken(ManagedEvent), useValue: dummyRepo },
        { provide: getRepositoryToken(TicketType), useValue: dummyRepo },
        { provide: getRepositoryToken(EventOrder), useValue: dummyRepo },
        { provide: getRepositoryToken(EventRegistration), useValue: dummyRepo },
        { provide: getRepositoryToken(EventStaff), useValue: dummyRepo },
        { provide: getRepositoryToken(Member), useValue: dummyRepo },
        { provide: getRepositoryToken(ExternalEventActivation), useValue: dummyRepo },
        { provide: getRepositoryToken(Transaction), useValue: dummyRepo },
        { provide: StripeService, useValue: dummyService },
        { provide: LedgerService, useValue: dummyService },
        { provide: AuditService, useValue: dummyService },
        { provide: EmailService, useValue: dummyService },
        { provide: EventOrganizerService, useValue: dummyService },
        { provide: GitHubDBService, useValue: dummyService },
        { provide: ReimbursementsService, useValue: dummyService },
      ],
    }).compile();

    expect(moduleRef.get(EventsService)).toBeInstanceOf(EventsService);
    expect(moduleRef.get(EventsController)).toBeInstanceOf(EventsController);
  });
});
