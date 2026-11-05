import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import { CreateHourEntryDto } from './dto/create-hour-entry.dto';
import { HourStatementQueryDto, ListHoursDto } from './dto/list-hours.dto';
import { RejectHourEntryDto } from './dto/review-hour-entry.dto';
import { HoursService } from './hours.service';

@ApiTags('hours')
@Controller('hours')
export class HoursController {
  constructor(private readonly hoursService: HoursService) {}

  @Get('public')
  @ApiOperation({ summary: 'Totais públicos de horas aprovadas e permissões de selo' })
  publicList() {
    return this.hoursService.publicTotals();
  }

  @Get('verify/:code')
  @ApiOperation({ summary: 'Verifica uma declaração pública de horas' })
  verify(@Param('code') code: string) {
    return this.hoursService.verifyStatement(code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: JwtPayload }) {
    return this.hoursService.myEntries(req.user.sub);
  }

  @Get('me/summary')
  @UseGuards(JwtAuthGuard)
  mySummary(@Req() req: { user: JwtPayload }) {
    return this.hoursService.myApprovedSummary(req.user.sub);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER)
  pending(@Query() query: ListHoursDto) {
    return this.hoursService.pending(query.page, query.limit);
  }

  @Get('members/:memberId/summary')
  @ApiOperation({ summary: 'Resumo público de horas aprovadas, conforme visibilidade' })
  publicSummary(@Param('memberId') memberId: string) {
    return this.hoursService.publicSummary(memberId);
  }

  @Get('members/:memberId/statement')
  @UseGuards(JwtAuthGuard)
  statement(
    @Param('memberId') memberId: string,
    @Query() query: HourStatementQueryDto,
    @Req() req: { user: JwtPayload },
  ) {
    if (memberId !== req.user.sub) {
      throw new ForbiddenException('A declaração de horas só pode ser emitida pelo próprio membro.');
    }
    return this.hoursService.statement(memberId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateHourEntryDto, @Req() req: { user: JwtPayload }) {
    return this.hoursService.create(dto, req.user);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER)
  approve(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.hoursService.approve(id, req.user);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectHourEntryDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.hoursService.reject(id, req.user, dto.reason);
  }
}
