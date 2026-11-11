import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, ListAnnouncementsDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('public')
  listPublic() {
    return this.announcements.listPublic();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  listAdmin(@Query() query: ListAnnouncementsDto, @Req() req: { user: JwtPayload }) {
    return this.announcements.listAdmin(query, req.user);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  create(@Body() body: CreateAnnouncementDto, @Req() req: { user: JwtPayload }) {
    return this.announcements.create(body, req.user);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAnnouncementDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.announcements.update(id, body, req.user);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.announcements.deactivate(id, req.user);
  }
}
