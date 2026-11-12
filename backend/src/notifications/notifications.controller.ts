import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateContentDto } from './dto/email-template-content.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('jwt')
export class NotificationsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: EmailTemplateService,
  ) {}

  @Get('status')
  @Roles('admin', 'finance-analyzer')
  @ApiOperation({ summary: '🔒 Status de configuração do SMTP [admin|finance-analyzer]' })
  getStatus() {
    return this.emailService.getStatus();
  }

  @Get('emails')
  @Roles('admin', 'finance-analyzer')
  @ApiOperation({
    summary:
      '🔒 Logs de e-mail enviados/falhos/ignorados + summary [admin|finance-analyzer]',
  })
  listEmails(
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize?: number,
    @Query()
    filters?: {
      recipient?: string;
      from?: string;
      to?: string;
      campaignId?: string;
    },
    @Req() req?: { user?: JwtPayload },
  ) {
    const extra: Record<string, unknown> = {};
    if (filters?.recipient !== undefined) extra.recipient = filters.recipient;
    if (filters?.from !== undefined) extra.from = filters.from;
    if (filters?.to !== undefined) extra.to = filters.to;
    if (filters?.campaignId !== undefined) {
      extra.campaignId = filters.campaignId;
    }
    if (req?.user?.roles) {
      extra.isAdmin = req.user.roles.includes(MemberRole.ADMIN);
    }
    return this.emailService.listLogs({
      status,
      template,
      page,
      pageSize,
      ...extra,
    });
  }

  @Get('emails/export')
  @Roles('admin', 'finance-analyzer')
  @ApiOperation({
    summary:
      '🔒 Exporta logs de e-mail filtrados em CSV (respeitando escopo de PII) [admin|finance-analyzer]',
  })
  async exportEmails(
    @Query()
    query?: {
      status?: string;
      template?: string;
      recipient?: string;
      from?: string;
      to?: string;
      campaignId?: string;
    },
    @Req() req?: { user?: JwtPayload },
    @Res() res?: Response,
  ) {
    const isAdmin = req?.user?.roles
      ? req.user.roles.includes(MemberRole.ADMIN)
      : true;
    const csv = await this.emailService.exportLogsCsv({
      status: query?.status,
      template: query?.template,
      recipient: query?.recipient,
      from: query?.from,
      to: query?.to,
      campaignId: query?.campaignId,
      isAdmin,
    });
    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="email-logs.csv"',
      );
      res.send(csv);
      return;
    }
    return csv;
  }

  @Post('emails/:id/resend')
  @ApiOperation({
    summary: '🔒 Reenviar e-mail (atualiza o mesmo log) [admin]',
  })
  resendEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailService.resend(id);
  }

  @Get('templates')
  @ApiOperation({
    summary: '🔒 Lista templates de e-mail (override ou padrão) [admin]',
  })
  listTemplates() {
    return this.templateService.listTemplates();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '🔒 Detalha um template de e-mail [admin]' })
  getTemplate(@Param('id') id: string) {
    return this.templateService.getTemplate(id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: '🔒 Cria/atualiza override de template [admin]' })
  upsertTemplate(
    @Param('id') id: string,
    @Body() dto: EmailTemplateContentDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.templateService.upsertTemplate(id, dto, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '🔒 Remove override e restaura o padrão [admin]' })
  async removeTemplate(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ) {
    await this.templateService.removeTemplate(id, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }

  @Post('templates/:id/preview')
  @ApiOperation({
    summary: '🔒 Renderiza preview do template com variáveis de exemplo [admin]',
  })
  previewTemplate(@Param('id') id: string, @Body() dto: EmailTemplateContentDto) {
    return this.templateService.previewTemplate(id, dto);
  }

  @Post('templates/:id/test')
  @ApiOperation({
    summary: '🔒 Envia e-mail de teste do template para o admin logado [admin]',
  })
  async sendTestTemplate(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ) {
    const log = await this.emailService.sendTemplate(
      id,
      req.user.email,
      this.templateService.sampleContext(id),
    );
    return { emailLogId: log.id };
  }
}
