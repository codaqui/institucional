import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Member } from '../members/entities/member.entity';
import { MentorProfile } from '../mentorship/entities/mentor-profile.entity';
import { MemberDesignation } from './entities/member-designation.entity';
import { DesignationsController } from './designations.controller';
import { DesignationsGuard } from './designations.guard';
import { DesignationsService } from './designations.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemberDesignation, Member, MentorProfile]), AuditModule],
  controllers: [DesignationsController],
  providers: [DesignationsService, DesignationsGuard],
  exports: [DesignationsService],
})
export class DesignationsModule {}
