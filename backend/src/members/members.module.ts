import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from './entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { MentorshipSession } from '../mentorship/entities/mentorship-session.entity';
import { MentorProfile } from '../mentorship/entities/mentor-profile.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Community } from '../communities/entities/community.entity';
import { MemberEngagementService } from './member-engagement.service';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, Transaction, EventRegistration, MentorshipSession, MentorProfile, MemberDesignation, Community]),
    AuditModule,
    // forwardRef: ciclo Members → Events → EventOrganizer → Members
    forwardRef(() => EventsModule),
  ],
  controllers: [MembersController],
  providers: [MembersService, MemberEngagementService],
  exports: [MembersService],
})
export class MembersModule {}
