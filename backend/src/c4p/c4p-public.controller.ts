import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { TurnstileAction } from '../common/turnstile/turnstile-action.decorator';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';
import { C4pSubmissionsService } from './c4p-submissions.service';
import { SubmitC4pTalkDto } from './dto/c4p-submission.dto';

@ApiTags('C4P')
@Controller('c4p/public')
export class C4pPublicController {
  constructor(private readonly submissions: C4pSubmissionsService) {}

  @Post('calls/:slug/submissions')
  @UseGuards(TurnstileGuard)
  @TurnstileAction('c4p_submission')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(@Param('slug') slug: string, @Body() dto: SubmitC4pTalkDto) {
    return this.submissions.submit(slug, dto);
  }
}
