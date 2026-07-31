import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailService } from './email.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('jwt')
export class NotificationsController {
  constructor(private readonly emailService: EmailService) {}

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
}
