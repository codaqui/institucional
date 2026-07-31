import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventOrganizerService } from './event-organizer.service';
import { CreateOwnershipDto } from './dto/create-ownership.dto';
import { UpsertOverrideDto } from './dto/upsert-override.dto';

@ApiTags('Event Organizer')
@Controller('events')
export class EventOrganizerController {
  constructor(private readonly service: EventOrganizerService) {}

  // ── Organizers (ownership) — admin only ──────────────────────────────────

  @Get('organizers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar ownership de eventos [admin]' })
  getOrganizers() {
    return this.service.getOrganizers();
  }

  @Post('organizers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Atribuir eventos a um organizer [admin]',
    description:
      'Upsert por memberId. Abre PR em organizers.json em nome do membro logado — validado e auto-mergeado pelo workflow do Actions.',
  })
  addOwnership(
    @Body() dto: CreateOwnershipDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.addOwnership(dto, req.user);
  }

  @Delete('organizers/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Remover ownership de um organizer [admin]',
    description: 'Abre PR em organizers.json — NÃO é auto-mergeado hoje.',
  })
  removeOwnership(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.removeOwnership(memberId, req.user);
  }

  // ── Overrides ─────────────────────────────────────────────────────────────

  @Get('override/:sourceKey/:eventId/can-manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 O membro logado pode gerenciar o override deste evento?',
    description:
      'Probe de UI (botão "Editar metadados" na página pública). Retorna sempre 200 com { canManage } — admin true; event_organizer com scope matching true; demais false.',
  })
  canManage(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.canManage(req.user, sourceKey, eventId);
  }

  @Get('override/:sourceKey/:eventId')
  @ApiOperation({
    summary: 'Override atual de um evento (público)',
    description:
      'Lê o arquivo .override.json direto de main (cache de 5 min). 404 se não existir.',
  })
  getOverride(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
  ) {
    return this.service.getOverride(sourceKey, eventId);
  }

  @Get('override/:sourceKey/:eventId/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Histórico de commits do override (proxy commits API)',
    description:
      'Últimos 20 commits do arquivo .override.json na branch base. [] quando não há commits (nunca 404).',
  })
  getOverrideHistory(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.getOverrideHistory(sourceKey, eventId, req.user);
  }

  @Get('override/:sourceKey/:eventId/pr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 PR aberto para o override [event_organizer | admin]',
  })
  getOverridePR(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.getOverridePR(sourceKey, eventId, req.user);
  }

  @Put('override/:sourceKey/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Criar/atualizar override [event_organizer | admin]',
    description:
      'Valida o payload e abre branch + PR (label event-override) em nome do membro logado. O workflow do Actions valida e auto-mergeia.',
  })
  upsertOverride(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpsertOverrideDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.upsertOverride(sourceKey, eventId, dto, req.user);
  }

  @Delete('override/:sourceKey/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Remover override [event_organizer | admin]',
    description: 'Abre PR de delete do arquivo .override.json.',
  })
  deleteOverride(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.deleteOverride(sourceKey, eventId, req.user);
  }
}
