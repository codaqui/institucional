import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { Transaction } from '../ledger/entities/transaction.entity';
import { ClubModule } from '../club/club.module';
import { CompaniesModule } from '../companies/companies.module';
import { EventOrder } from '../events/entities/event-order.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';
import { Member } from '../members/entities/member.entity';

@Module({
  imports: [
    LedgerModule,
    TypeOrmModule.forFeature([
      Transaction,
      EventOrder,
      EventRegistration,
      TicketType,
      ManagedEvent,
      ExternalEventActivation,
      Member,
    ]),
    ClubModule,
    CompaniesModule,
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
