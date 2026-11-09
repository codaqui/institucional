import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { AssembliesController } from './assemblies.controller';
import { AssembliesService } from './assemblies.service';
import { Assembly } from './entities/assembly.entity';
import { Institution } from '../entities/entities/institution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Assembly, Institution]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [AssembliesController],
  providers: [AssembliesService],
})
export class AssembliesModule {}
