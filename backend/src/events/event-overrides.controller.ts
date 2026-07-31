import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventOverridesService } from './event-overrides.service';
import {
  CreateEventOverrideDto,
  UpdateEventOverrideDto,
} from './dto/event-override.dto';

interface PublicOverride {
  sourceKey: string;
  eventId: string;
  ownerHandle: string;
  updatedAt: Date;
  reason: string | null;
  payload: Record<string, unknown>;
}

@ApiTags('Event Overrides')
@Controller('events/overrides')
export class EventOverridesController {
  constructor(private readonly service: EventOverridesService) {}

  @Get(':sourceKey/:eventId')
  @ApiOperation({ summary: 'Override de metadados de um evento (público)' })
  getOverride(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
  ) {
    return this.service.findOne(sourceKey, eventId);
  }

  @Get('public')
  @ApiOperation({
    summary: 'Lista pública de overrides (usada pelo sync de snapshots)',
  })
  async listPublic(): Promise<PublicOverride[]> {
    const overrides = await this.service.findAll();
    return overrides.map((o) => ({
      sourceKey: o.sourceKey,
      eventId: o.eventId,
      ownerHandle: o.ownerHandle,
      updatedAt: o.updatedAt,
      reason: o.reason,
      payload: JSON.parse(o.payload) as Record<string, unknown>,
    }));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar overrides por sourceKey [admin]' })
  listBySourceKey(@Query('sourceKey') sourceKey: string) {
    return this.service.findBySourceKey(sourceKey);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Criar override de evento [event_organizer | admin]' })
  create(
    @Body() dto: CreateEventOverrideDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.upsert(dto.sourceKey, dto.eventId, dto, req.user);
  }

  @Put(':sourceKey/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Atualizar override de evento [event_organizer | admin]' })
  update(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventOverrideDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.upsert(sourceKey, eventId, dto, req.user);
  }

  @Delete(':sourceKey/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Remover override de evento [event_organizer | admin]' })
  remove(
    @Param('sourceKey') sourceKey: string,
    @Param('eventId') eventId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.remove(sourceKey, eventId, req.user);
  }
}
