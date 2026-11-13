import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pVotesService } from './c4p-votes.service';
import { UpsertC4pVoteDto } from './dto/c4p-vote.dto';

@ApiTags('C4P')
@Controller('c4p/evaluator')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class C4pEvaluatorController {
  constructor(
    private readonly evaluators: C4pEvaluatorsService,
    private readonly votes: C4pVotesService,
  ) {}

  @Get('calls')
  myCalls(@Req() req: { user: JwtPayload }) {
    return this.evaluators.myEvaluations(req.user.sub);
  }

  @Post('designations/:id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.evaluators.accept(id, req.user);
  }

  @Get('calls/:callId')
  getCall(
    @Param('callId', ParseUUIDPipe) callId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.votes.getEvaluatorCall(callId, req.user);
  }

  @Get('calls/:callId/talks')
  listTalks(
    @Param('callId', ParseUUIDPipe) callId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.votes.listTalksForEvaluator(callId, req.user);
  }

  @Put('calls/:callId/talks/:talkId/vote')
  upsertVote(
    @Param('callId', ParseUUIDPipe) callId: string,
    @Param('talkId', ParseUUIDPipe) talkId: string,
    @Body() dto: UpsertC4pVoteDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.votes.upsert(callId, talkId, req.user, dto);
  }
}
