import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from './entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, Transaction, EventRegistration]),
    AuditModule,
    // forwardRef: ciclo Members → Events → EventOrganizer → Members
    forwardRef(() => EventsModule),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
