import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AUDIT_RETENTION_DAYS } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('jwt')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: '🔒 Listar logs de auditoria [admin]',
    description:
      `Retorna os logs de auditoria paginados. ` +
      `Registros mais antigos que ${AUDIT_RETENTION_DAYS} dias são removidos automaticamente.`,
  })
  @ApiResponse({ status: 200, description: 'Logs paginados.' })
  getLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.auditService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('cleanup')
  @ApiOperation({
    summary: '🔒 Executar limpeza de logs expirados [admin]',
    description:
      `Remove registros de auditoria com mais de ${AUDIT_RETENTION_DAYS} dias. ` +
      `Pode ser chamado manualmente ou via cron.`,
  })
  @ApiResponse({
    status: 201,
    description: 'Quantidade de registros removidos.',
  })
  async runCleanup() {
    const deleted = await this.auditService.cleanup();
    return { deleted, retentionDays: AUDIT_RETENTION_DAYS };
  }
}
