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
import { SmtpEmailProvider } from '../src/notifications/email.provider';
import { EMAIL_TEMPLATE_CERTIFICATE_PENDING } from '../src/notifications/default-templates';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de certificados exige DB_NAME terminado em _test.');
}

const EVENT_KEY = 'sympla:e2e-certificate:evt-001';
const actors = {
  admin: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-cert-admin', roles: ['admin'] },
  participant: { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', handle: 'e2e-cert-participant', roles: ['membro'] },
  batch: { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', handle: 'e2e-cert-batch', roles: ['membro'] },
  certificate: { sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', handle: 'e2e-cert-independent', roles: ['membro'] },
} satisfies Record<string, JwtPayload>;

type ActorName = keyof typeof actors;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: ActorName) => ({ 'x-test-actor': actor });

type RegistrationRow = {
  id: string;
  attendeeEmail: string;
  checkinToken: string;
  status: string;
  checkedInAt: Date | null;
  certificateGrantedAt: Date | null;
  certificateInvitedAt: Date | null;
};

describe('Certificação desacoplada — PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let provider: SmtpEmailProvider;

  async function registrationByEmail(email: string): Promise<RegistrationRow> {
    const rows = await dataSource.query(
      'SELECT id, "attendeeEmail", "checkinToken", status, "checkedInAt", "certificateGrantedAt", "certificateInvitedAt" FROM event_registrations WHERE "attendeeEmail" = $1',
      [email],
    );
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  async function removeFixtures() {
    await dataSource.query('DELETE FROM email_logs WHERE "to" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM hour_ledger WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM event_registrations WHERE "attendeeEmail" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM ticket_types WHERE "externalActivationId" IN (SELECT id FROM external_event_activations WHERE "eventKey" = $1)', [EVENT_KEY]);
    await dataSource.query('DELETE FROM event_overrides WHERE "sourceKey" = $1', ['sympla:e2e-certificate']);
    await dataSource.query('DELETE FROM external_event_activations WHERE "eventKey" = $1', [EVENT_KEY]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          const actor = req.headers['x-test-actor'] as ActorName | undefined;
          req.user = actor ? actors[actor] : undefined;
          return true;
        },
      })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(express.text({ limit: '6mb', type: ['text/csv', 'text/plain'] }));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    provider = moduleFixture.get(SmtpEmailProvider);
    await removeFixtures();

    await dataSource.getRepository('members').save(Object.entries(actors).map(([key, actor]) => ({
      id: actor.sub,
      githubId: `e2e-certificate-${key}`,
      githubHandle: actor.handle,
      name: `Ator certificado ${key}`,
      email: key === 'admin' ? 'admin@e2e.invalid' : `${key}@e2e.invalid`,
      roles: actor.roles,
    })));
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await removeFixtures();
    if (app) await app.close();
  });

  it('executa CSV, batch, concessão, convite, aceite e verificação sem duplicar horas', async () => {
    await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/activate`)
      .set(as('admin'))
      .send({
        features: ['checkin', 'certificates'],
        communityProjectKey: 'codaqui',
        title: 'Evento E2E de certificados',
        startAt: '2026-11-09T18:00:00.000Z',
        workloadMinutes: 120,
      })
      .expect(201);

    const csv = [
      'name,email,checkin,certificate',
      'Participante,participant@e2e.invalid,true,false',
      'Convite Enviado,sent@e2e.invalid,false,true',
      'Convite Falhou,failed@e2e.invalid,false,true',
      'Convite Ignorado,skipped@e2e.invalid,false,true',
      'Participante Lote,batch@e2e.invalid,false,false',
      'Certificado Independente,certificate@e2e.invalid,false,false',
    ].join('\n');
    const importResponse = await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/participants/import`)
      .set(as('admin'))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect((response) => {
        if (response.status !== 201) throw new Error(JSON.stringify(response.body));
      })
      .expect(201);
    expect(importResponse.body).toMatchObject({
      imported: 6,
      matched: 3,
      checkedIn: 1,
      certificatesGranted: 4,
      skippedDuplicates: 0,
    });
    expect(importResponse.body.unmatched).toHaveLength(3);

    const participant = await registrationByEmail('participant@e2e.invalid');
    expect(participant.checkedInAt).not.toBeNull();
    expect(participant.certificateGrantedAt).not.toBeNull();
    expect(await dataSource.query(
      'SELECT id FROM hour_ledger WHERE "memberId" = $1 AND "sourceType" = $2',
      [actors.participant.sub, 'event_checkin'],
    )).toHaveLength(1);

    const reupload = await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/participants/import`)
      .set(as('admin'))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);
    expect(reupload.body).toMatchObject({ imported: 0, skippedDuplicates: 6 });
    expect(await dataSource.query(
      'SELECT id FROM hour_ledger WHERE "memberId" = $1 AND "sourceType" = $2',
      [actors.participant.sub, 'event_checkin'],
    )).toHaveLength(1);

    const batch = await registrationByEmail('batch@e2e.invalid');
    const pendingSent = await registrationByEmail('sent@e2e.invalid');
    const batchResponse = await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/checkin/batch`)
      .set(as('admin'))
      .send({ tokens: [batch.checkinToken, pendingSent.checkinToken] })
      .expect(201);
    expect(batchResponse.body).toEqual([
      { token: batch.checkinToken, status: 'checked_in' },
      { token: pendingSent.checkinToken, status: 'invalid' },
    ]);
    const repeatedBatch = await request(app.getHttpServer())
      .post(`/events/external/${encodeURIComponent(EVENT_KEY)}/checkin/batch`)
      .set(as('admin'))
      .send({ tokens: [batch.checkinToken] })
      .expect(201);
    expect(repeatedBatch.body).toEqual([
      { token: batch.checkinToken, status: 'already_checked_in' },
    ]);
    expect(await dataSource.query(
      'SELECT id FROM hour_ledger WHERE "memberId" = ANY($1::uuid[]) AND "sourceType" = $2',
      [[actors.participant.sub, actors.batch.sub], 'event_checkin'],
    )).toHaveLength(2);

    const independent = await registrationByEmail('certificate@e2e.invalid');
    const grantResponse = await request(app.getHttpServer())
      .post(`/events/registrations/${independent.id}/certificate/grant`)
      .set(as('admin'))
      .expect(201);
    expect(grantResponse.body.checkedInAt).toBeNull();
    expect(grantResponse.body.certificateGrantedAt).not.toBeNull();
    await request(app.getHttpServer())
      .get(`/events/certificates/verify/CRT-${independent.checkinToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ valid: true, eventTitle: 'Evento E2E de certificados' });
      });

    jest.spyOn(provider, 'isConfigured').mockReturnValue(false);
    const skippedResponse = await request(app.getHttpServer())
      .post('/events/certificate-invites/batch')
      .set(as('admin'))
      .send({ registrationIds: [(await registrationByEmail('skipped@e2e.invalid')).id] })
      .expect(201);
    expect(skippedResponse.body[0].status).toBe('skipped');

    jest.spyOn(provider, 'isConfigured').mockReturnValue(true);
    jest.spyOn(provider, 'send').mockRejectedValueOnce(new Error('SMTP sintético indisponível'));
    const failedResponse = await request(app.getHttpServer())
      .post('/events/certificate-invites/batch')
      .set(as('admin'))
      .send({ registrationIds: [(await registrationByEmail('failed@e2e.invalid')).id] })
      .expect(201);
    expect(failedResponse.body[0].status).toBe('failed');

    jest.spyOn(provider, 'send').mockResolvedValue(undefined);
    const sentResponse = await request(app.getHttpServer())
      .post('/events/certificate-invites/batch')
      .set(as('admin'))
      .send({ registrationIds: [pendingSent.id] })
      .expect(201);
    expect(sentResponse.body[0].status).toBe('sent');

    const emailResults = await dataSource.query(
      'SELECT "registrationId", status FROM email_logs WHERE template = $1 AND "registrationId" = ANY($2::text[]) ORDER BY status',
      [EMAIL_TEMPLATE_CERTIFICATE_PENDING, [pendingSent.id, (await registrationByEmail('failed@e2e.invalid')).id, (await registrationByEmail('skipped@e2e.invalid')).id]],
    );
    expect(emailResults.map((row: { status: string }) => row.status).sort()).toEqual(['failed', 'sent', 'skipped']);
    expect((await registrationByEmail('sent@e2e.invalid')).certificateInvitedAt).not.toBeNull();
    expect((await registrationByEmail('failed@e2e.invalid')).certificateInvitedAt).toBeNull();
    expect((await registrationByEmail('skipped@e2e.invalid')).certificateInvitedAt).toBeNull();

    await request(app.getHttpServer())
      .get(`/events/public/guest-invites/${pendingSent.checkinToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: 'pending_guest', eventTitle: 'Evento E2E de certificados' });
      });
    await request(app.getHttpServer())
      .post('/events/public/guest-claim')
      .send({
        token: pendingSent.checkinToken,
        name: 'Convite Enviado',
        email: 'sent@e2e.invalid',
        consent: true,
        turnstileToken: 'e2e-turnstile',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('confirmed');
      });
    expect((await registrationByEmail('sent@e2e.invalid')).status).toBe('confirmed');

    await request(app.getHttpServer())
      .get(`/events/certificates/verify/CRT-${pendingSent.checkinToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ valid: true, attendeeName: 'Convite Enviado' });
      });
  });
});

jest.setTimeout(60_000);
