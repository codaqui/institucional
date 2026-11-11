import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import { CampaignsService } from './campaigns.service';
import {
  ConfirmCampaignDto,
  CreateCampaignDto,
  CreateSuppressionDto,
  ListCampaignsQueryDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

interface AuthenticatedRequest {
  user: JwtPayload;
}

@ApiTags('campaigns')
@Controller()
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('campaigns/unsubscribe')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Descadastro público de comunicações promocionais por token',
  })
  unsubscribe(@Query('token') token?: string) {
    return this.campaignsService.unsubscribeByToken(token);
  }

  @Get('descadastro')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Rota pública direta de descadastro por token',
  })
  unsubscribeLegacy(@Query('token') token?: string) {
    return this.campaignsService.unsubscribeByToken(token);
  }

  @Get('campaigns/suppressions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Lista supressões de e-mail (admin)' })
  listSuppressions() {
    return this.campaignsService.listSuppressions();
  }

  @Post('campaigns/suppressions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({
    summary: 'Registra supressão manual/reclamação/bounce (admin)',
  })
  createSuppression(
    @Body() dto: CreateSuppressionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.createSuppression(dto, req.user);
  }

  @Delete('campaigns/suppressions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Remove supressão administrativa (proibido para descadastro do titular)',
  })
  async deleteSuppression(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.campaignsService.deleteSuppression(id, req.user);
  }

  @Get('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER)
  @ApiOperation({ summary: 'Lista campanhas de e-mail paginadas' })
  list(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.list(query);
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Cria rascunho de campanha de e-mail (idempotente)' })
  create(@Body() dto: CreateCampaignDto, @Req() req: AuthenticatedRequest) {
    return this.campaignsService.create(dto, req.user);
  }

  @Get('campaigns/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN, MemberRole.FINANCE_ANALYZER)
  @ApiOperation({ summary: 'Obtém detalhes, métricas e destinatários da campanha' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.findOne(id, req.user);
  }

  @Patch('campaigns/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiOperation({ summary: 'Atualiza rascunho ou prévia de campanha' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.update(id, dto, req.user);
  }

  @Post('campaigns/:id/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve segmento, congela destinatários e retorna prévia',
  })
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.preview(id, req.user);
  }

  @Post('campaigns/:id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envia e-mail de teste apenas para o próprio administrador',
  })
  sendTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.sendTest(id, req.user);
  }

  @Post('campaigns/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma envio ou agendamento de campanha em prévia',
  })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmCampaignDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.confirm(id, dto, req.user);
  }

  @Post('campaigns/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela campanha impedindo novos envios' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.cancel(id, req.user);
  }

  @Post('campaigns/:id/recipients/:recipientId/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agenda nova tentativa apenas para o destinatário com falha',
  })
  retryRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignsService.retryRecipient(id, recipientId, req.user);
  }
}
