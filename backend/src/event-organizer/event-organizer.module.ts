import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubDbModule } from '../github-db/github-db.module';
import { MembersModule } from '../members/members.module';
import { AuditModule } from '../audit/audit.module';
import { EventOrganizerService } from './event-organizer.service';
import { EventOrganizerOwnershipService } from './event-organizer-ownership.service';
import { EventOrganizerOwnershipController } from './event-organizer-ownership.controller';
import { EventOrganizerOwnership } from './entities/event-organizer-ownership.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventOrganizerOwnership]),
    GithubDbModule,
    // forwardRef: ciclo Members → Events → EventOrganizer → Members
    forwardRef(() => MembersModule),
    AuditModule,
  ],
  // O EventOrganizerController é registrado pelo EventsModule ANTES do
  // EventsController — ver comentário em events.module.ts (ordem de rotas).
  controllers: [],
  providers: [EventOrganizerService, EventOrganizerOwnershipService],
  exports: [EventOrganizerService, EventOrganizerOwnershipService],
})
export class EventOrganizerModule {}
