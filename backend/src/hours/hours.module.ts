import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { Member } from '../members/entities/member.entity';
import { HourEntry } from './entities/hour-entry.entity';
import { HourStatement } from './entities/hour-statement.entity';
import { HoursController } from './hours.controller';
import { HoursService } from './hours.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HourEntry, HourStatement, Member]),
    AuditModule,
    DesignationsModule,
  ],
  controllers: [HoursController],
  providers: [HoursService],
  exports: [HoursService],
})
export class HoursModule {}
