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
import { EventOrganizerOwnershipService } from './event-organizer-ownership.service';
import {
  CreateEventOrganizerOwnershipDto,
  UpdateEventOrganizerOwnershipDto,
} from './dto/event-organizer-ownership.dto';

@ApiTags('Event Organizer Ownership')
@Controller('events/organizers')
export class EventOrganizerOwnershipController {
  constructor(private readonly service: EventOrganizerOwnershipService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar ownership de eventos [admin | event_organizer]' })
  getOrganizers() {
    return this.service.getOrganizers();
  }

  @Post(':memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Atribuir/atualizar ownership de eventos [admin]',
    description: 'Upsert por memberId. Salva diretamente no banco.',
  })
  upsert(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateEventOrganizerOwnershipDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.upsert(memberId, dto, req.user);
  }

  @Put(':memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Atualizar scopes de ownership [admin]',
  })
  update(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateEventOrganizerOwnershipDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.upsert(memberId, dto, req.user);
  }

  @Delete(':memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Remover ownership de um organizer [admin]',
    description: 'Remove diretamente do banco.',
  })
  remove(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.service.remove(memberId, req.user);
  }
}
