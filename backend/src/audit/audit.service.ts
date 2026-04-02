import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  AuditLog,
  AuditAction,
  AUDIT_RETENTION_DAYS,
} from './entities/audit-log.entity';

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
  ) {}

  /**
   * Registra um evento de auditoria.
   * Método fire-and-forget — não bloqueia a operação principal.
   */
  async log(dto: CreateAuditDto): Promise<void> {
    try {
      const entry = this.repo.create({
        action: dto.action,
        actorId: dto.actorId,
        actorHandle: dto.actorHandle,
        targetId: dto.targetId ?? null,
        targetType: dto.targetType ?? null,
        details: dto.details ?? null,
        ipAddress: dto.ipAddress ?? null,
      });
      await this.repo.save(entry);
    } catch (err: any) {
      // Nunca falha a operação principal por causa do audit log
      this.logger.error(`Falha ao gravar audit log: ${err.message}`);
    }
  }

  /**
   * Remove registros mais antigos que AUDIT_RETENTION_DAYS.
   *
   * Deve ser chamado periodicamente (cron job ou startup).
   * Retorna a quantidade de registros removidos.
   */
  async cleanup(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);

    const result = await this.repo.delete({
      createdAt: LessThan(cutoff),
    });

    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Audit cleanup: ${deleted} registros removidos (> ${AUDIT_RETENTION_DAYS} dias)`,
      );
    }
    return deleted;
  }

  /** Lista logs com paginação (para painel admin) */
  async findAll(
    page = 1,
    limit = 50,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
