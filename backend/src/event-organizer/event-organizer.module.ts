import { Module, forwardRef } from '@nestjs/common';
import { GithubDbModule } from '../github-db/github-db.module';
import { MembersModule } from '../members/members.module';
import { AuditModule } from '../audit/audit.module';
import { EventOrganizerService } from './event-organizer.service';

@Module({
  imports: [
    GithubDbModule,
    // forwardRef: ciclo Members → Events → EventOrganizer → Members
    forwardRef(() => MembersModule),
    AuditModule,
  ],
  // O EventOrganizerController é registrado pelo EventsModule ANTES do
  // EventsController — ver comentário em events.module.ts (ordem de rotas).
  controllers: [],
  providers: [EventOrganizerService],
  exports: [EventOrganizerService],
})
export class EventOrganizerModule {}
