import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { Institution } from './entities/institution.entity';
import { Partnership } from './entities/partnership.entity';
import { PartnershipsController } from './partnerships.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Partnership]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [EntitiesController, PartnershipsController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
