import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Institution } from '../entities/entities/institution.entity';
import { Member } from '../members/entities/member.entity';
import { City } from './entities/city.entity';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([City, Institution, MemberDesignation, Member]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}
