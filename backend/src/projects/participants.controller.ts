import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ParticipantsService } from './participants.service';

@ApiTags('Project participants')
@Controller('projects')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  myProjects(@Req() req: { user: JwtPayload }) {
    return this.participants.myProjects(req.user);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  join(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.participants.join(id, req.user);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.participants.leave(id, req.user);
  }

  @Delete(':id/participants/:memberId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Req() req: { user: JwtPayload }) {
    return this.participants.remove(id, memberId, req.user);
  }
}
