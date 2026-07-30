import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { SmtpEmailProvider } from './email.provider';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { EmailLog } from './entities/email-log.entity';

/**
 * Notifications — e-mail transacional/marketing de eventos via SMTP.
 *
 * Global para que EventsModule/StripeModule consumam EmailService sem
 * imports cruzados (evita ciclo EventsModule ↔ NotificationsModule).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailLog,
      ManagedEvent,
      EventRegistration,
      TicketType,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [SmtpEmailProvider, EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
