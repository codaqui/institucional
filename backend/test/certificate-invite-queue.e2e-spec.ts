import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { TurnstileGuard } from '../src/common/turnstile/turnstile.guard';
import { CertificateInviteQueueService } from '../src/events/certificate-invite-queue.service';
import { CertificateInviteJobStatus } from '../src/events/entities/certificate-invite-job.entity';
import { SmtpEmailProvider } from '../src/notifications/email.provider';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E da fila exige DB_NAME terminado em _test.');
}

const EVENT_KEY = 'sympla:e2e-email-queue:evt-001';
const admin: JwtPayload = {
  sub: '55555555-5555-4555-8555-555555555555',
  githubId: 'e2e-email-queue-admin',
  handle: 'e2e-email-queue-admin',
  name: 'Admin Fila E2E',
  email: 'admin-queue@e2e.invalid',
  avatarUrl: '',
  roles: ['admin'],
};
const asAdmin = { 'x-test-actor': 'admin' };

describe('Fila de convites de certificado — PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let provider: SmtpEmailProvider;
  let queue: CertificateInviteQueueService;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM certificate_invite_jobs WHERE "requestedById" = $1', [admin.sub]);
    await dataSource.query('DELETE FROM email_logs WHERE "to" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = $1', [admin.sub]);
    await dataSource.query('DELETE FROM hour_ledger WHERE "memberId" = $1', [admin.sub]);
    await dataSource.query('DELETE FROM event_registrations WHERE "attendeeEmail" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM ticket_types WHERE "externalActivationId" IN (SELECT id FROM external_event_activations WHERE "eventKey" = $1)', [EVENT_KEY]);
    await dataSource.query('DELETE FROM event_overrides WHERE "sourceKey" = $1', ['sympla:e2e-email-queue']);
    await dataSource.query('DELETE FROM external_event_activations WHERE "eventKey" = $1', [EVENT_KEY]);
    await dataSource.query('DELETE FROM members WHERE id = $1', [admin.sub]);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          req.user = req.headers['x-test-actor'] ? admin : undefined;
          return true;
        },
      })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(express.text({ limit: '1mb', type: ['text/csv', 'text/plain'] }));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    provider = moduleFixture.get(SmtpEmailProvider);
    queue = moduleFixture.get(CertificateInviteQueueService);
    await removeFixtures();
    await dataSource.getRepository('members').save({
      id: admin.sub,
      githubId: admin.githubId,
      githubHandle: admin.handle,
      name: admin.name,
      email: admin.email,
      roles: admin.roles,
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await removeFixtures();
    if (app) await app.close();
  });

  it('enfileira, aplica retry 421 e conclui sem alterar os logs históricos', async () => {
    const historicalBefore = await dataSource.query(
      "SELECT status, COUNT(*)::int AS total FROM email_logs WHERE template = 'certificate-pending-registration' AND \"to\" NOT LIKE '%@e2e.invalid' GROUP BY status",
    );
    expect(historicalBefore).toEqual(expect.arrayContaining([
      { status: 'sent', total: 28 },
      { status: 'failed', total: 90 },
    ]));

    await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/activate`)
      .set(asAdmin)
      .send({
        features: ['certificates'],
        communityProjectKey: 'codaqui',
        title: 'Evento E2E Fila',
        startAt: '2026-11-09T18:00:00.000Z',
        workloadMinutes: 60,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/participants/import`)
      .set(asAdmin)
      .set('Content-Type', 'text/csv')
      .send('name,email,checkin,certificate\nParticipante Fila,queue@e2e.invalid,false,false')
      .expect(201);
    const [registration] = await dataSource.query(
      'SELECT id, status FROM event_registrations WHERE "attendeeEmail" = $1',
      ['queue@e2e.invalid'],
    );

    const legacy = await request(app.getHttpServer())
      .get(`/events/external/${encodeURIComponent(EVENT_KEY)}/participants`)
      .set(asAdmin)
      .expect(200);
    expect(Array.isArray(legacy.body)).toBe(true);
    const paginated = await request(app.getHttpServer())
      .get(`/events/external/${encodeURIComponent(EVENT_KEY)}/participants?page=1&limit=1&certificateFilter=registration_pending`)
      .set(asAdmin)
      .expect(200);
    expect(paginated.body).toMatchObject({ total: 1, page: 1, totalPages: 1, limit: 1 });

    jest.spyOn(provider, 'isConfigured').mockReturnValue(true);
    const send = jest.spyOn(provider, 'send')
      .mockRejectedValueOnce(new Error('Data command failed: 421-4.3.0 Temporary System Problem'))
      .mockResolvedValue(undefined);

    const enqueued = await request(app.getHttpServer())
      .post('/events/certificate-invites/batch')
      .set(asAdmin)
      .send({ registrationIds: [registration.id] })
      .expect(202);
    expect(enqueued.body).toMatchObject({ total: 1, status: 'queued', invalid: [] });

    await queue.processNextJob();
    const [retry] = await dataSource.query(
      'SELECT status, attempts, "lastError" FROM certificate_invite_jobs WHERE "batchId" = $1',
      [enqueued.body.batchId],
    );
    expect(retry).toMatchObject({ status: CertificateInviteJobStatus.RETRY, attempts: 1 });
    expect(retry.lastError).toContain('421');

    await dataSource.query(
      'UPDATE certificate_invite_jobs SET "availableAt" = NOW() - INTERVAL \'1 second\' WHERE "batchId" = $1',
      [enqueued.body.batchId],
    );
    await queue.processNextJob();
    const [completed] = await dataSource.query(
      'SELECT status, attempts FROM certificate_invite_jobs WHERE "batchId" = $1',
      [enqueued.body.batchId],
    );
    expect(completed).toEqual({ status: CertificateInviteJobStatus.COMPLETED, attempts: 2 });
    expect(send).toHaveBeenCalledTimes(2);

    const progress = await request(app.getHttpServer())
      .get(`/events/certificate-invites/batches/${enqueued.body.batchId}`)
      .set(asAdmin)
      .expect(200);
    expect(progress.body).toMatchObject({ status: 'completed', total: 1, completed: 1, failed: 0 });

    const historicalAfter = await dataSource.query(
      "SELECT status, COUNT(*)::int AS total FROM email_logs WHERE template = 'certificate-pending-registration' AND \"to\" NOT LIKE '%@e2e.invalid' GROUP BY status",
    );
    expect(historicalAfter).toEqual(historicalBefore);
    const [invited] = await dataSource.query(
      'SELECT "certificateInvitedAt" FROM event_registrations WHERE id = $1',
      [registration.id],
    );
    expect(invited.certificateInvitedAt).not.toBeNull();
  });
});

jest.setTimeout(60_000);
