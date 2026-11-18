import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateEventC4pCallDto } from './dto/c4p-call.dto';
import { EventC4pService } from './event-c4p.service';

@ApiTags('C4P')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class EventC4pController {
  constructor(private readonly eventC4p: EventC4pService) {}

  @Post(':id/c4p')
  createManaged(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEventC4pCallDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventC4p.createForManagedEvent(id, dto, req.user);
  }

  @Post('external/:eventKey/c4p')
  createExternal(
    @Param('eventKey') eventKey: string,
    @Body() dto: CreateEventC4pCallDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventC4p.createForExternalEvent(eventKey, dto, req.user);
  }
}
