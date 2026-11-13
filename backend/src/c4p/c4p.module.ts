import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Community } from '../communities/entities/community.entity';
import { TurnstileModule } from '../common/turnstile/turnstile.module';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { DesignationsModule } from '../designations/designations.module';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { Member } from '../members/entities/member.entity';
import { C4pCallsService } from './c4p-calls.service';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pEvaluatorController } from './c4p-evaluator.controller';
import { C4pManageController } from './c4p-manage.controller';
import { C4pPublicController } from './c4p-public.controller';
import { C4pSubmissionsService } from './c4p-submissions.service';
import { C4pTalksService } from './c4p-talks.service';
import { C4pVotesService } from './c4p-votes.service';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      C4pCall,
      C4pTalk,
      C4pVote,
      ManagedEvent,
      Community,
      MemberDesignation,
      Member,
    ]),
    AuditModule,
    DesignationsModule,
    TurnstileModule,
  ],
  controllers: [C4pPublicController, C4pEvaluatorController, C4pManageController],
  providers: [
    C4pCallsService,
    C4pSubmissionsService,
    C4pTalksService,
    C4pEvaluatorsService,
    C4pVotesService,
    C4pDashboardService,
  ],
  exports: [C4pCallsService],
})
export class C4pModule {}
