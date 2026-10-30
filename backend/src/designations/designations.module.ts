import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Member } from '../members/entities/member.entity';
import { MemberDesignation } from './entities/member-designation.entity';
import { DesignationsService } from './designations.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemberDesignation, Member]), AuditModule],
  providers: [DesignationsService],
  exports: [DesignationsService],
})
export class DesignationsModule {}
