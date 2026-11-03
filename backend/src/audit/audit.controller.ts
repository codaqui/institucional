import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import type { AuditCategory } from './audit-category';
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
      'Retorna logs paginados, opcionalmente filtrados por categoria. Somente logs operacionais expiram.',
  })
  @ApiQuery({ name: 'category', required: false, enum: ['governance', 'operational'] })
  @ApiResponse({ status: 200, description: 'Logs paginados.' })
  getLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: AuditCategory,
  ) {
    return this.auditService.findAll(
      page ? Number.parseInt(String(page), 10) : 1,
      limit ? Number.parseInt(String(limit), 10) : 50,
      category === 'governance' || category === 'operational'
        ? category
        : undefined,
    );
  }

  @Post('cleanup')
  @ApiOperation({
    summary: '🔒 Executar limpeza de logs operacionais expirados [admin]',
    description:
      'Usa a retenção efetiva de settings/env e nunca remove logs de governo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Quantidade de registros removidos e retenção efetiva.',
  })
  async runCleanup() {
    const deleted = await this.auditService.cleanupOperational();
    const retentionDays = await this.auditService.getOperationalRetentionDays();
    return { deleted, retentionDays };
  }
}
