import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AvailabilityRuleDto, ReserveSlotDto } from './dto/mentorship.dto';
import { MentorApplicationDto, UpdateMentorProfileDto } from './dto/mentorship.dto';
import { AvailabilityService } from './availability.service';
import { MentorshipService } from './mentorship.service';

@ApiTags('Mentorship')
@Controller('mentorship')
export class MentorshipController {
  constructor(
    private readonly mentorship: MentorshipService,
    private readonly availability: AvailabilityService,
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
  reserveSlot(@Body() dto: ReserveSlotDto, @Req() req: { user?: JwtPayload }) {
    return this.availability.reserveSlot(dto, req.user);
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
