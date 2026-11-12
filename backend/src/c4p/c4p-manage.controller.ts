import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { C4pCallsService } from './c4p-calls.service';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pTalksService } from './c4p-talks.service';
import {
  CreateC4pCallDto,
  ListC4pCallsDto,
  UpdateC4pCallDto,
} from './dto/c4p-call.dto';
import { InviteC4pEvaluatorDto } from './dto/c4p-evaluator.dto';
import { FinalizeC4pCallDto } from './dto/c4p-finalize.dto';
import { ListC4pTalksDto } from './dto/c4p-talk.dto';

@ApiTags('C4P')
@Controller('c4p/manage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class C4pManageController {
  constructor(
    private readonly calls: C4pCallsService,
    private readonly talks: C4pTalksService,
    private readonly evaluators: C4pEvaluatorsService,
    private readonly dashboard: C4pDashboardService,
  ) {}

  @Get('calls')
  list(@Query() query: ListC4pCallsDto, @Req() req: { user: JwtPayload }) {
    return this.calls.listManage(query, req.user);
  }

  @Post('calls')
  create(@Body() dto: CreateC4pCallDto, @Req() req: { user: JwtPayload }) {
    return this.calls.create(dto, req.user);
  }

  @Get('calls/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.calls.getManage(id, req.user);
  }

  @Patch('calls/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateC4pCallDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.calls.update(id, dto, req.user);
  }

  @Post('calls/:id/finalize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizeC4pCallDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.calls.finalize(id, dto.talkIds, req.user);
  }

  @Post('calls/:id/reopen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reopen(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.calls.reopen(id, req.user);
  }

  @Post('calls/:id/talks/import')
  importTalks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() csvText: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.talks.importCsv(id, csvText, req.user);
  }

  @Get('calls/:id/talks')
  listTalks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListC4pTalksDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.talks.listTalks(id, query, req.user);
  }

  @Delete('calls/:id/talks/:talkId')
  deleteTalk(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('talkId', ParseUUIDPipe) talkId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.talks.deleteTalk(id, talkId, req.user);
  }

  @Get('calls/:id/evaluators')
  listEvaluators(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.evaluators.listEvaluators(id, req.user);
  }

  @Post('calls/:id/evaluators')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteC4pEvaluatorDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.evaluators.invite(id, dto, req.user);
  }

  @Delete('calls/:id/evaluators/:designationId')
  removeEvaluator(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('designationId', ParseUUIDPipe) designationId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.evaluators.remove(id, designationId, req.user);
  }

  @Get('calls/:id/dashboard')
  getDashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.dashboard.dashboard(id, req.user);
  }

  @Get('calls/:id/report')
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.dashboard.report(id, req.user);
  }
}
