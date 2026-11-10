import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagedEvent } from './entities/managed-event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { EventOrder } from './entities/event-order.entity';
import { EventRegistration } from './entities/event-registration.entity';
import { EventStaff } from './entities/event-staff.entity';
import { ExternalEventActivation } from './entities/external-event-activation.entity';
import { EventOverride } from './entities/event-override.entity';
import { CertificateInviteJob } from './entities/certificate-invite-job.entity';
import { EmailLog } from '../notifications/entities/email-log.entity';
import { Member } from '../members/entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { StripeModule } from '../stripe/stripe.module';
import { EventOrganizerModule } from '../event-organizer/event-organizer.module';
import { EventOrganizerController } from '../event-organizer/event-organizer.controller';
import { EventOrganizerOwnershipController } from '../event-organizer/event-organizer-ownership.controller';
import { GithubDbModule } from '../github-db/github-db.module';
import { ReimbursementsModule } from '../reimbursements/reimbursements.module';
import { HoursModule } from '../hours/hours.module';
import { TurnstileModule } from '../common/turnstile/turnstile.module';
import { DesignationsModule } from '../designations/designations.module';
import { Institution } from '../entities/entities/institution.entity';
import { EventsService } from './events.service';
import { CertificateInviteQueueService } from './certificate-invite-queue.service';
import { EventsController } from './events.controller';
import { EventOverridesService } from './event-overrides.service';
import { EventOverridesController } from './event-overrides.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ManagedEvent,
      TicketType,
      EventOrder,
      EventRegistration,
      EventStaff,
      ExternalEventActivation,
      EmailLog,
      EventOverride,
      CertificateInviteJob,
      Member,
      Transaction,
      Institution,
    ]),
    LedgerModule,
    AuditModule,
    StripeModule,
    EventOrganizerModule,
    GithubDbModule,
    ReimbursementsModule,
    HoursModule,
    TurnstileModule,
    DesignationsModule,
  ],
  // ⚠️ Ordem importa: controllers de event-organizer ANTES de EventsController —
  // ambos usam @Controller('events') e as rotas estáticas (/events/organizers,
  // /events/override/...) precisam registrar antes de /events/:id.
  // Registrar no nível do controller (e não do módulo) porque o ciclo
  // Members→Events faz o EventsModule ser escaneado antes do EventOrganizerModule,
  // invalidando a ordem dos imports do AppModule.
  controllers: [
    EventOrganizerController,
    EventOrganizerOwnershipController,
    EventOverridesController,
    EventsController,
  ],
  providers: [EventsService, EventOverridesService, CertificateInviteQueueService],
  exports: [EventsService, EventOverridesService, CertificateInviteQueueService],
})
export class EventsModule {}
