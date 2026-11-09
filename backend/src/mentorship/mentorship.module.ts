import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { HoursModule } from '../hours/hours.module';
import { Member } from '../members/entities/member.entity';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorshipSession } from './entities/mentorship-session.entity';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';
import { AvailabilityService } from './availability.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MentorProfile, MentorAvailability, MentorshipSession, Member]),
    DesignationsModule,
    AuditModule,
    HoursModule,
  ],
  controllers: [MentorshipController],
  providers: [MentorshipService, AvailabilityService, SessionsService],
  exports: [MentorshipService, AvailabilityService, SessionsService],
})
export class MentorshipModule {}
