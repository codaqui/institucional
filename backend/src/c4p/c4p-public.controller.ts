import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { TurnstileAction } from '../common/turnstile/turnstile-action.decorator';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';
import { C4pCallsService } from './c4p-calls.service';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pSubmissionsService } from './c4p-submissions.service';
import { SubmitC4pTalkDto } from './dto/c4p-submission.dto';

@ApiTags('C4P')
@Controller('c4p/public')
export class C4pPublicController {
  constructor(
    private readonly submissions: C4pSubmissionsService,
    private readonly calls: C4pCallsService,
    private readonly dashboard: C4pDashboardService,
  ) {}

  @Get('calls')
  listCalls() {
    return this.calls.listPublic();
  }

  @Get('calls/:slug')
  getCall(@Param('slug') slug: string) {
    return this.calls.getPublicBySlug(slug);
  }

  @Get('calls/:slug/results')
  getResults(@Param('slug') slug: string) {
    return this.dashboard.getPublicResults(slug);
  }

  @Get('snapshot')
  getSnapshot() {
    return this.dashboard.getSnapshot();
  }

  @Post('calls/:slug/submissions')
  @UseGuards(TurnstileGuard)
  @TurnstileAction('c4p_submission')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(@Param('slug') slug: string, @Body() dto: SubmitC4pTalkDto) {
    return this.submissions.submit(slug, dto);
  }
}
