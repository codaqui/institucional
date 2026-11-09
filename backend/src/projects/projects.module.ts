import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DesignationsModule } from '../designations/designations.module';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Institution } from '../entities/entities/institution.entity';
import { Partnership } from '../entities/entities/partnership.entity';
import { Member } from '../members/entities/member.entity';
import { ExtensionProject } from './entities/extension-project.entity';
import { ProjectParticipant } from './entities/project-participant.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { ProjectHoursController } from './project-hours.controller';
import { ProjectCertificatesController } from './project-certificates.controller';
import { ProjectCertificatesService } from './project-certificates.service';
import { ProjectCertificate } from './entities/project-certificate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExtensionProject,
      ProjectParticipant,
      ProjectCertificate,
      Institution,
      Partnership,
      MemberDesignation,
      Member,
    ]),
    DesignationsModule,
    AuditModule,
  ],
  controllers: [ProjectsController, ParticipantsController, ProjectHoursController, ProjectCertificatesController],
  providers: [ProjectsService, ParticipantsService, ProjectCertificatesService],
  exports: [ProjectsService, ParticipantsService, ProjectCertificatesService],
})
export class ProjectsModule {}
