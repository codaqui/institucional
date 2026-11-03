import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { auditCategory, AuditCategory } from './audit-category';
import {
  AUDIT_RETENTION_SETTING_KEY,
  getEnvironmentAuditRetentionDays,
  isValidAuditRetentionDays,
  SettingsService,
} from '../settings/settings.service';

export interface CreateAuditDto {
  action: AuditAction;
  actorId: string;
  actorHandle: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Registra um evento de auditoria.
   * Método fire-and-forget — não bloqueia a operação principal.
   */
  async log(dto: CreateAuditDto): Promise<void> {
    try {
      const category = auditCategory(dto.action);
      const entry = this.repo.create({
        action: dto.action,
        category,
        actorId: dto.actorId,
        actorHandle: dto.actorHandle,
        targetId: dto.targetId ?? null,
        targetType: dto.targetType ?? null,
        details: dto.details ?? null,
        ipAddress: category === 'governance' ? null : (dto.ipAddress ?? null),
      });
      await this.repo.save(entry);
    } catch (err: any) {
      // Nunca falha a operação principal por causa do audit log
      this.logger.error(`Falha ao gravar audit log: ${err.message}`);
    }
  }

  async getOperationalRetentionDays(): Promise<number> {
    const configured = await this.settingsService.getNumber(
      AUDIT_RETENTION_SETTING_KEY,
    );
    return configured !== null && isValidAuditRetentionDays(configured)
      ? configured
      : getEnvironmentAuditRetentionDays();
  }

  @Cron('17 3 * * *')
  async cleanupOperational(): Promise<number> {
    const retentionDays = await this.getOperationalRetentionDays();
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 3_600_000,
    );
    const result = await this.repo.delete({
      category: 'operational',
      createdAt: LessThan(cutoff),
    });

    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Audit cleanup: ${deleted} logs operacionais removidos (> ${retentionDays} dias)`,
      );
    }
    return deleted;
  }

  async cleanup(): Promise<number> {
    return this.cleanupOperational();
  }

  /** Lista logs com paginação (para painel admin) */
  async findAll(
    page = 1,
    limit = 50,
    category?: AuditCategory,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [data, total] = await this.repo.findAndCount({
      where: category ? { category } : undefined,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
