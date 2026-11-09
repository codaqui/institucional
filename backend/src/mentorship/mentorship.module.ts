import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorshipSession } from './entities/mentorship-session.entity';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MentorProfile, MentorAvailability, MentorshipSession]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [MentorshipController],
  providers: [MentorshipService],
  exports: [MentorshipService],
})
export class MentorshipModule {}
