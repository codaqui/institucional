import { ForbiddenException } from '@nestjs/common';
import { CertificateInviteQueueService } from './certificate-invite-queue.service';
import { CertificateInviteJobStatus } from './entities/certificate-invite-job.entity';
import type { JwtPayload } from '../auth/jwt.strategy';

const actor: JwtPayload = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  githubId: '1',
  handle: 'ana',
  name: 'Ana',
  email: 'ana@example.test',
  avatarUrl: '',
  roles: ['admin'],
};
const otherActor = { ...actor, sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', roles: ['membro'] };
const member = {
  id: actor.sub,
  githubId: actor.githubId,
  githubHandle: actor.handle,
  name: actor.name,
  email: actor.email,
  avatarUrl: actor.avatarUrl,
  roles: actor.roles,
};

describe('CertificateInviteQueueService', () => {
  let service: CertificateInviteQueueService;
  let jobRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let events: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  beforeEach(() => {
    jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: jest.fn((callback) => callback({ getRepository: () => jobRepo })),
      },
    };
    memberRepo = { findOneBy: jest.fn().mockResolvedValue(member) };
    events = {
      validateCertificateInviteRegistration: jest.fn().mockResolvedValue('ok'),
      inviteCertificates: jest.fn().mockResolvedValue([{ registrationId: 'reg-1', status: 'sent', error: null }]),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new CertificateInviteQueueService(jobRepo as any, memberRepo as any, events as any, audit as any);
  });

  it('deduplicates enqueue and exposes progress only to admin or requester', async () => {
    events.validateCertificateInviteRegistration.mockImplementation(async (id: string) => id === 'invalid' ? 'invalid' : 'ok');

    const result = await service.enqueue(['reg-1', 'reg-1', 'invalid'], actor);

    expect(result).toMatchObject({ total: 1, status: 'queued', invalid: ['invalid'] });
    expect(jobRepo.save).toHaveBeenCalledWith([expect.objectContaining({
      registrationId: 'reg-1', requestedById: actor.sub, status: 'queued', attempts: 0,
    })]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ targetId: result.batchId }));

    const jobs = [{ id: 'job-1', batchId: result.batchId, registrationId: 'reg-1', requestedById: actor.sub, status: 'completed', attempts: 1, lastError: null }];
    jobRepo.find.mockResolvedValue(jobs);
    await expect(service.getBatch(result.batchId, otherActor)).rejects.toThrow(ForbiddenException);
    await expect(service.getBatch(result.batchId, actor)).resolves.toMatchObject({
      batchId: result.batchId, status: 'completed', total: 1, completed: 1,
    });
  });

  it('claims one job with skip locked and completes a sent invite', async () => {
    const job = { id: 'job-1', registrationId: 'reg-1', requestedById: actor.sub, status: 'queued', attempts: 0 };
    jobRepo.findOne.mockResolvedValue(job);

    await service.processNextJob();

    expect(jobRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
    }));
    expect(events.inviteCertificates).toHaveBeenCalledWith(['reg-1'], expect.objectContaining({ sub: actor.sub }));
    expect(job.status).toBe(CertificateInviteJobStatus.COMPLETED);
  });

  it('marks skipped without treating it as SMTP failure', async () => {
    const job = { id: 'job-1', registrationId: 'reg-1', requestedById: actor.sub, status: 'queued', attempts: 0 };
    jobRepo.findOne.mockResolvedValue(job);
    events.inviteCertificates.mockResolvedValue([{ registrationId: 'reg-1', status: 'skipped', error: 'SMTP_NOT_CONFIGURED' }]);

    await service.processNextJob();

    expect(job.status).toBe(CertificateInviteJobStatus.SKIPPED);
  });

  it('retries a temporary 421 and pauses pending jobs', async () => {
    const job = { id: 'job-1', registrationId: 'reg-1', requestedById: actor.sub, status: 'queued', attempts: 0, availableAt: new Date('2026-01-01') };
    jobRepo.findOne.mockResolvedValue(job);
    events.inviteCertificates.mockResolvedValue([{ registrationId: 'reg-1', status: 'failed', error: 'Data command failed: 421-4.3.0 Temporary System Problem' }]);

    await service.processNextJob();

    expect(job.status).toBe(CertificateInviteJobStatus.RETRY);
    expect(job.attempts).toBe(1);
    expect(job.availableAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(jobRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
      expect.objectContaining({ availableAt: expect.any(Date) }),
    );
  });

  it('fails permanently on the third temporary failure', async () => {
    const job = { id: 'job-1', registrationId: 'reg-1', requestedById: actor.sub, status: 'retry', attempts: 2 };
    jobRepo.findOne.mockResolvedValue(job);
    events.inviteCertificates.mockResolvedValue([{ registrationId: 'reg-1', status: 'failed', error: 'SMTP timeout' }]);

    await service.processNextJob();

    expect(job.status).toBe(CertificateInviteJobStatus.FAILED);
    expect(job.attempts).toBe(3);
  });

  it('recovers abandoned processing jobs before claiming new work', async () => {
    jobRepo.findOne.mockResolvedValue(null);

    await service.processNextJob();

    expect(jobRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: CertificateInviteJobStatus.PROCESSING, lockedAt: expect.anything() }),
      expect.objectContaining({ status: CertificateInviteJobStatus.RETRY, lockedAt: null }),
    );
  });
});
