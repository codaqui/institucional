import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import {
  AUDIT_RETENTION_SETTING_KEY,
  AuditRetentionPolicy,
  MAX_AUDIT_OPERATIONAL_RETENTION_DAYS,
  MIN_AUDIT_OPERATIONAL_RETENTION_DAYS,
  SettingsService,
} from './settings.service';

export class UpdateAuditRetentionDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_AUDIT_OPERATIONAL_RETENTION_DAYS)
  @Max(MAX_AUDIT_OPERATIONAL_RETENTION_DAYS)
  retentionDays: number;
}

@ApiTags('Settings')
@ApiBearerAuth('jwt')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('audit-retention')
  @ApiOperation({ summary: '🔒 Consultar retenção operacional de auditoria [admin]' })
  getAuditRetention(): Promise<AuditRetentionPolicy> {
    return this.settingsService.getAuditRetention();
  }

  @Put('audit-retention')
  @ApiOperation({ summary: '🔒 Configurar retenção operacional de auditoria [admin]' })
  async updateAuditRetention(
    @Req() req: { user: JwtPayload; ip?: string },
    @Body() body: UpdateAuditRetentionDto,
  ): Promise<AuditRetentionPolicy> {
    const previousDays = await this.settingsService.getNumber(
      AUDIT_RETENTION_SETTING_KEY,
    );
    await this.settingsService.setNumber(
      AUDIT_RETENTION_SETTING_KEY,
      body.retentionDays,
      req.user.sub,
    );
    await this.auditService.log({
      action: AuditAction.SETTINGS_AUDIT_RETENTION_UPDATED,
      actorId: req.user.sub,
      actorHandle: req.user.handle,
      targetType: 'setting',
      details: { previousDays, retentionDays: body.retentionDays },
      ipAddress: req.ip,
    });
    return { retentionDays: body.retentionDays, source: 'setting' };
  }
}
