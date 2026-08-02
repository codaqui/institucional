import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventOrganizerService } from './event-organizer.service';

@ApiTags('Event Organizer')
@Controller('events')
export class EventOrganizerController {
  constructor(private readonly service: EventOrganizerService) {}

  // ── Permissões ─────────────────────────────────────────────────────────────

  @Get('override/:sourceKey/:eventId/can-manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 O membro logado pode gerenciar o override deste evento?',
    description:
      'Probe de UI (botão "Editar metadados" na página pública). Retorna sempre 200 com { canManage }.',
  })
  canManage(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.canManage(req.user, sourceKey, eventId);
  }
}
