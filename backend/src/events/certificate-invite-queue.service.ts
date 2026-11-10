import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { Member, MemberRole } from '../members/entities/member.entity';
import { EventsService } from './events.service';
import { CertificateInviteJob, CertificateInviteJobStatus } from './entities/certificate-invite-job.entity';

interface CertificateInviteResult {
  registrationId: string;
  status: string;
  error: string | null;
}

@Injectable()
export class CertificateInviteQueueService {
  constructor(
    @InjectRepository(CertificateInviteJob)
    private readonly jobRepo: Repository<CertificateInviteJob>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  async enqueue(registrationIds: string[], user: JwtPayload) {
    const batchId = randomUUID();
    const invalid: string[] = [];
    const validIds: string[] = [];
    const validations = await Promise.all([...new Set(registrationIds)].map(async (registrationId) => ({
      registrationId,
      status: await this.events.validateCertificateInviteRegistration(registrationId, user),
    })));
    for (const { registrationId, status } of validations) {
      if (status === 'ok') validIds.push(registrationId);
      else invalid.push(registrationId);
    }
    try {
      if (validIds.length > 0) {
        await this.jobRepo.save(validIds.map((registrationId) => this.jobRepo.create({
          batchId,
          registrationId,
          requestedById: user.sub,
          status: CertificateInviteJobStatus.QUEUED,
          attempts: 0,
        })));
      }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return { batchId, total: 0, status: 'queued' as const, invalid: [...invalid, ...validIds] };
      }
      throw error;
    }
    await this.audit.log({
      action: AuditAction.EVENT_CERTIFICATE_INVITED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: batchId,
      targetType: 'event-registration-batch',
      details: { total: validIds.length, invalid },
    });
    return { batchId, total: validIds.length, status: 'queued' as const, invalid };
  }

  async getBatch(batchId: string, user: JwtPayload) {
    const jobs = await this.jobRepo.find({ where: { batchId }, order: { createdAt: 'ASC' } });
    if (jobs.length === 0) throw new NotFoundException('Lote de convites não encontrado.');
    if (!user.roles?.includes(MemberRole.ADMIN) && jobs.some((job) => job.requestedById !== user.sub)) {
      throw new ForbiddenException('Sem permissão para acompanhar este lote.');
    }
    const count = (status: CertificateInviteJobStatus) => jobs.filter((job) => job.status === status).length;
    const completed = count(CertificateInviteJobStatus.COMPLETED);
    const failed = count(CertificateInviteJobStatus.FAILED);
    const skipped = count(CertificateInviteJobStatus.SKIPPED);
    const retry = count(CertificateInviteJobStatus.RETRY);
    const processing = count(CertificateInviteJobStatus.PROCESSING);
    const queued = count(CertificateInviteJobStatus.QUEUED);
    const done = completed + failed + skipped;
    let status: 'completed' | 'retry' | 'processing' | 'queued' = 'queued';
    if (done === jobs.length) status = 'completed';
    else if (retry > 0) status = 'retry';
    else if (processing > 0) status = 'processing';
    return {
      batchId,
      status,
      total: jobs.length,
      completed,
      queued,
      processing,
      retry,
      failed,
      skipped,
      items: jobs.map((job) => ({
        registrationId: job.registrationId,
        status: job.status,
        attempts: job.attempts,
        lastError: job.lastError,
      })),
    };
  }

  @Cron('*/10 * * * * *')
  async processNextJob(): Promise<void> {
    await this.jobRepo.update(
      {
        status: CertificateInviteJobStatus.PROCESSING,
        lockedAt: LessThan(new Date(Date.now() - 120_000)),
      },
      {
        status: CertificateInviteJobStatus.RETRY,
        availableAt: new Date(),
        lockedAt: null,
      },
    );
    const job = await this.jobRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(CertificateInviteJob);
      const claimed = await repo.findOne({
        where: {
          status: In([CertificateInviteJobStatus.QUEUED, CertificateInviteJobStatus.RETRY]),
          availableAt: LessThanOrEqual(new Date()),
        },
        order: { createdAt: 'ASC' },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (!claimed) return null;
      claimed.status = CertificateInviteJobStatus.PROCESSING;
      claimed.lockedAt = new Date();
      claimed.attempts += 1;
      return repo.save(claimed);
    });
    if (!job) return;

    try {
      const member = await this.memberRepo.findOneBy({ id: job.requestedById });
      if (!member) throw new Error('Membro solicitante não encontrado.');
      const actor: JwtPayload = {
        sub: member.id,
        githubId: member.githubId,
        handle: member.githubHandle,
        name: member.name,
        email: member.email,
        avatarUrl: member.avatarUrl,
        roles: member.roles,
      };
      const [result] = await this.events.inviteCertificates([job.registrationId], actor) as CertificateInviteResult[];
      job.lastError = result.error;
      if (result.status === 'sent' || result.status === 'already_invited') {
        job.status = CertificateInviteJobStatus.COMPLETED;
      } else if (result.status === 'skipped') {
        job.status = CertificateInviteJobStatus.SKIPPED;
      } else {
        await this.handleFailure(job, result.error ?? undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.lastError = message;
      await this.handleFailure(job, message);
    }
    job.lockedAt = null;
    await this.jobRepo.save(job);
  }

  private async handleFailure(job: CertificateInviteJob, message = 'UNKNOWN_SMTP_ERROR'): Promise<void> {
    const temporary = this.isTemporaryError(message);
    if (!temporary || job.attempts >= 3) {
      job.status = CertificateInviteJobStatus.FAILED;
      return;
    }
    job.status = CertificateInviteJobStatus.RETRY;
    job.availableAt = new Date(Date.now() + (job.attempts === 1 ? 60_000 : 300_000));
    if (/421|454|Too many login attempts/i.test(message)) {
      const pausedUntil = new Date(Date.now() + 15 * 60_000);
      job.availableAt = pausedUntil;
      await this.jobRepo.update(
        { status: In([CertificateInviteJobStatus.QUEUED, CertificateInviteJobStatus.RETRY]) },
        { availableAt: pausedUntil },
      );
    }
  }

  private isTemporaryError(error: string): boolean {
    return /421|454|Too many login attempts|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|Temporary System Problem/i.test(error);
  }
}
