import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Member } from '../members/entities/member.entity';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { Community } from './entities/community.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Community, MemberDesignation, Member]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
