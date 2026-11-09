import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AvailabilityRuleDto, CancelSessionDto, ConfirmSessionDto, ListSessionsQueryDto, MentorApplicationDto, RateSessionDto, ReserveSlotDto, UpdateMentorProfileDto } from './dto/mentorship.dto';
import { AvailabilityService } from './availability.service';
import { MentorshipService } from './mentorship.service';
import { SessionsService } from './sessions.service';

@ApiTags('Mentorship')
@Controller('mentorship')
export class MentorshipController {
  constructor(
    private readonly mentorship: MentorshipService,
    private readonly availability: AvailabilityService,
    private readonly sessions: SessionsService,
  ) {}

  @Put('availability/:weekday')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  replaceAvailability(
    @Param('weekday', ParseIntPipe) weekday: number,
    @Body() rules: AvailabilityRuleDto[],
    @Req() req: { user: JwtPayload },
  ) {
    return this.availability.replaceAvailability(weekday, rules, req.user);
  }

  @Get('availability')
  listAvailability(@Query('mentorId') mentorId: string, @Query('from') from?: string) {
    return this.availability.listAvailability(mentorId, from ? new Date(from) : new Date());
  }

  @Post('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  reserveSlot(@Body() dto: ReserveSlotDto, @Req() req: { user?: JwtPayload }) {
    return this.availability.reserveSlot(dto, req.user ?? undefined);
  }

  @Get('sessions/admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listAdminSessions(@Query() query: ListSessionsQueryDto, @Req() req: { user: JwtPayload }) {
    return this.sessions.listForAdmin(req.user, query.page, query.limit);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listMentorSessions(@Req() req: { user: JwtPayload }) {
    return this.sessions.listForMentor(req.user);
  }

  @Get('sessions/:token')
  getSession(@Param('token') token: string) {
    return this.sessions.getByToken(token);
  }

  @Post('sessions/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  confirmSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmSessionDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.sessions.confirm(id, dto.meetLink, req.user);
  }

  @Post('sessions/:id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  completeSession(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.sessions.complete(id, req.user);
  }

  @Post('sessions/:id/no-show')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  noShowSession(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.sessions.noShow(id, req.user);
  }

  @Post('sessions/:token/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  cancel(
    @Param('token') token: string,
    @Body() dto: CancelSessionDto,
    @Req() req: { user: JwtPayload | null },
  ) {
    if (req.user) return this.sessions.cancel(token, dto.reason, req.user);
    return this.sessions.cancelByToken(token, dto.reason);
  }

  @Post('sessions/:token/rating')
  rate(@Param('token') token: string, @Body() dto: RateSessionDto) {
    return this.sessions.rate(token, dto.rating, dto.feedback);
  }

  @Post('applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  apply(@Body() dto: MentorApplicationDto, @Req() req: { user: JwtPayload }) {
    return this.mentorship.apply(dto, req.user);
  }

  @Get('applications/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listMyApplications(@Req() req: { user: JwtPayload }) {
    return this.mentorship.listMyApplications(req.user);
  }

  @Get('applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listApplications(@Req() req: { user: JwtPayload }) {
    return this.mentorship.listApplications(req.user);
  }

  @Post('applications/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  confirmApplication(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.mentorship.confirmApplication(id, req.user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  getProfile(@Req() req: { user: JwtPayload }) {
    return this.mentorship.getProfile(req.user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  updateProfile(@Body() dto: UpdateMentorProfileDto, @Req() req: { user: JwtPayload }) {
    return this.mentorship.updateProfile(dto, req.user);
  }
}
