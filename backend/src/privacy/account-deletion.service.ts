import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';

@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectRepository(AccountDeletionRequest)
    private readonly repo: Repository<AccountDeletionRequest>,
    private readonly auditService: AuditService,
  ) {}

  latestForMember(memberId: string): Promise<AccountDeletionRequest | null> {
    return this.repo.findOne({
      where: { memberId },
      order: { requestedAt: 'DESC' },
    });
  }

  async request(memberId: string, actorHandle: string): Promise<AccountDeletionRequest> {
    const existing = await this.repo.findOne({ where: { memberId, status: 'pending' } });
    if (existing) return existing;

    const entity = this.repo.create({ memberId, status: 'pending' });
    try {
      const saved = await this.repo.save(entity);
      void this.auditService.log({
        action: AuditAction.MEMBER_DELETION_REQUESTED,
        actorId: memberId,
        actorHandle,
        targetId: memberId,
        targetType: 'member',
        details: { requestId: saved.id, status: 'pending' },
      });
      return saved;
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const concurrent = await this.repo.findOne({ where: { memberId, status: 'pending' } });
      if (concurrent) return concurrent;
      throw error;
    }
  }

  async cancel(memberId: string, actorHandle: string): Promise<AccountDeletionRequest> {
    const pending = await this.repo.findOne({ where: { memberId, status: 'pending' } });
    if (!pending) {
      throw new NotFoundException('Não existe solicitação de exclusão pendente.');
    }

    const result = await this.repo.update(
      { id: pending.id, memberId, status: 'pending' },
      { status: 'canceled' },
    );
    if (result.affected !== 1) {
      throw new ConflictException('A solicitação já foi revisada ou cancelada.');
    }

    const canceled = await this.repo.findOneOrFail({ where: { id: pending.id } });
    void this.auditService.log({
      action: AuditAction.MEMBER_DELETION_REQUEST_CANCELED,
      actorId: memberId,
      actorHandle,
      targetId: memberId,
      targetType: 'member',
      details: { requestId: pending.id, before: 'pending', after: 'canceled' },
    });
    return canceled;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
