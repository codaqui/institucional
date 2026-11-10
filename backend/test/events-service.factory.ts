import { EventsService } from '../src/events/events.service';

type EventsServiceDependencies = {
  eventRepo: ConstructorParameters<typeof EventsService>[0];
  ticketTypeRepo: ConstructorParameters<typeof EventsService>[1];
  orderRepo: ConstructorParameters<typeof EventsService>[2];
  registrationRepo: ConstructorParameters<typeof EventsService>[3];
  staffRepo: ConstructorParameters<typeof EventsService>[4];
  memberRepo: ConstructorParameters<typeof EventsService>[5];
  activationRepo: ConstructorParameters<typeof EventsService>[6];
  emailLogRepo: ConstructorParameters<typeof EventsService>[7];
  txRepo: ConstructorParameters<typeof EventsService>[8];
  stripeService: ConstructorParameters<typeof EventsService>[9];
  ledgerService: ConstructorParameters<typeof EventsService>[10];
  auditService: ConstructorParameters<typeof EventsService>[11];
  emailService: ConstructorParameters<typeof EventsService>[12];
  eventOrganizerService: ConstructorParameters<typeof EventsService>[13];
  githubDb: ConstructorParameters<typeof EventsService>[14];
  eventOverridesService: ConstructorParameters<typeof EventsService>[15];
  reimbursementsService: ConstructorParameters<typeof EventsService>[16];
  hoursService: ConstructorParameters<typeof EventsService>[17];
};

export function createEventsService(dependencies: EventsServiceDependencies): EventsService {
  return new EventsService(
    dependencies.eventRepo,
    dependencies.ticketTypeRepo,
    dependencies.orderRepo,
    dependencies.registrationRepo,
    dependencies.staffRepo,
    dependencies.memberRepo,
    dependencies.activationRepo,
    dependencies.emailLogRepo,
    dependencies.txRepo,
    dependencies.stripeService,
    dependencies.ledgerService,
    dependencies.auditService,
    dependencies.emailService,
    dependencies.eventOrganizerService,
    dependencies.githubDb,
    dependencies.eventOverridesService,
    dependencies.reimbursementsService,
    dependencies.hoursService,
  );
}
