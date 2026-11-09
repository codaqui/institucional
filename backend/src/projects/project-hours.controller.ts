import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { HoursService } from '../hours/hours.service';
import { CreateProjectHourDto, UpdateProjectHourDto } from './dto/project-hour.dto';

@ApiTags('Project hours')
@Controller('projects')
export class ProjectHoursController {
  constructor(private readonly hours: HoursService) {}

  @Get(':id/hours')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  list(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.hours.listExtensionProjectEntries(id, req.user);
  }

  @Post(':id/hours')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateProjectHourDto, @Req() req: { user: JwtPayload }) {
    return this.hours.recordExtensionProjectEntry(id, body, req.user);
  }

  @Patch(':id/hours/:hourId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hourId', ParseUUIDPipe) hourId: string,
    @Body() body: UpdateProjectHourDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.hours.updateExtensionProjectEntry(id, hourId, body, req.user);
  }
}
