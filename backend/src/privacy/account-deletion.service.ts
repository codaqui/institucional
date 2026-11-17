import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import {
  AccountDeletionRequest,
  type AccountDeletionRequestStatus,
} from './entities/account-deletion-request.entity';

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

  async list(options: {
    status?: AccountDeletionRequestStatus;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResultDto<AccountDeletionRequest>> {
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 50)));
    const [data, total] = await this.repo.findAndCount({
      where: options.status ? { status: options.status } : {},
      order: { requestedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async complete(
    id: string,
    adminId: string,
    adminHandle: string,
    reviewNote?: string,
  ): Promise<AccountDeletionRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação de exclusão não encontrada.');

    const result = await this.repo.update(
      { id, status: 'pending' },
      {
        status: 'completed',
        reviewedByMemberId: adminId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    );
    if (result.affected !== 1) {
      throw new ConflictException('A solicitação já foi revisada ou cancelada.');
    }

    const completed = await this.repo.findOneOrFail({ where: { id } });
    void this.auditService.log({
      action: AuditAction.MEMBER_DELETION_REQUEST_COMPLETED,
      actorId: adminId,
      actorHandle: adminHandle,
      targetId: request.memberId,
      targetType: 'member',
      details: {
        requestId: id,
        before: 'pending',
        after: 'completed',
        reviewNote: completed.reviewNote,
      },
    });
    return completed;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
