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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
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

  @Get('emails')
  @ApiOperation({
    summary: '🔒 Logs de e-mail enviados/falhos + summary [admin]',
  })
  listEmails(
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize?: number,
  ) {
    return this.emailService.listLogs({ status, template, page, pageSize });
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
}
