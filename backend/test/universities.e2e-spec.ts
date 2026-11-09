import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E do Universitário exige DB_NAME terminado em _test.');
}

const EVENT_SLUG = 'e2e-university-event';
const CITY_NAME = 'Cidade E2E Universitário';
const actors = {
  manager: { sub: '11111111-1111-4111-8111-111111111111', handle: 'e2e-university-manager', roles: ['membro'] },
  admin: { sub: '22222222-2222-4222-8222-222222222222', handle: 'e2e-university-admin', roles: ['admin'] },
  ambassador: { sub: '33333333-3333-4333-8333-333333333333', handle: 'e2e-university-ambassador', roles: ['membro'] },
  participant: { sub: '44444444-4444-4444-8444-444444444444', handle: 'e2e-university-participant', roles: ['membro'] },
} satisfies Record<string, JwtPayload>;

type ActorName = keyof typeof actors;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: ActorName) => ({ 'x-test-actor': actor });

describe('Codaqui Universitário — PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM email_logs WHERE "to" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM hour_ledger WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM event_registrations WHERE "eventId" IN (SELECT id FROM managed_events WHERE slug = $1)', [EVENT_SLUG]);
    await dataSource.query('DELETE FROM event_orders WHERE "eventId" IN (SELECT id FROM managed_events WHERE slug = $1)', [EVENT_SLUG]);
    await dataSource.query('DELETE FROM event_staff WHERE "eventId" IN (SELECT id FROM managed_events WHERE slug = $1)', [EVENT_SLUG]);
    await dataSource.query('DELETE FROM ticket_types WHERE "eventId" IN (SELECT id FROM managed_events WHERE slug = $1)', [EVENT_SLUG]);
    await dataSource.query('DELETE FROM managed_events WHERE slug = $1', [EVENT_SLUG]);
    await dataSource.query('DELETE FROM member_designations WHERE "memberId" = ANY($1::uuid[]) OR "appointedById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM entities WHERE "registeredById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM cities WHERE name = $1 AND uf = $2', [CITY_NAME, 'PR']);
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
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    await removeFixtures();

    await dataSource.getRepository('members').save(Object.entries(actors).map(([key, actor]) => ({
      id: actor.sub,
      githubId: `e2e-university-${key}`,
      githubHandle: actor.handle,
      name: `Ator Universitário ${key}`,
      email: `${key}@e2e.invalid`,
      roles: actor.roles,
    })));
    await dataSource.getRepository('member_designations').save({
      memberId: actors.manager.sub,
      targetType: 'program',
      targetId: null,
      targetKey: 'universitario',
      designation: 'manager',
      status: 'active',
      appointedById: actors.admin.sub,
      confirmedById: actors.admin.sub,
      confirmedAt: new Date('2026-11-09T12:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await removeFixtures();
    if (app) await app.close();
  });

  it('executa gestor, IES, posse, evento, inscrição, check-in, certificado e horas exactly-once', async () => {
    const cityResponse = await request(app.getHttpServer())
      .post('/universities/cities')
      .set(as('manager'))
      .send({ name: CITY_NAME, uf: 'pr' })
      .expect(201);
    const cityId = cityResponse.body.id as string;

    const institutionResponse = await request(app.getHttpServer())
      .post('/universities/institutions')
      .set(as('manager'))
      .send({ name: 'IES E2E Universitário', slug: 'e2e-ies', cityId })
      .expect(201);
    const institutionId = institutionResponse.body.id as string;
    expect(institutionResponse.body).toMatchObject({ type: 'instituicao_ensino', cityId });

    const applicationResponse = await request(app.getHttpServer())
      .post(`/universities/institutions/${institutionId}/ambassador-applications`)
      .set(as('ambassador'))
      .send({ applicationNotes: 'Motivação sintética para representar a IES.' })
      .expect(201);
    const applicationId = applicationResponse.body.id as string;
    expect(applicationResponse.body).toMatchObject({ status: 'pending', targetType: 'ies', targetId: institutionId });

    await request(app.getHttpServer())
      .post(`/universities/ambassador-applications/${applicationId}/confirm`)
      .set(as('manager'))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/universities/ambassador-applications/${applicationId}/confirm`)
      .set(as('admin'))
      .send({})
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: 'active', confirmedById: actors.admin.sub });
      });

    const eventResponse = await request(app.getHttpServer())
      .post('/events')
      .set(as('ambassador'))
      .send({
        slug: EVENT_SLUG,
        title: 'Evento E2E Universitário',
        summary: 'Jornada sintética completa do programa.',
        location: 'Auditório da IES E2E',
        startAt: '2027-01-20T18:00:00.000Z',
        endAt: '2027-01-20T20:00:00.000Z',
        communityProjectKey: 'codaqui',
        institutionId,
      })
      .expect((response) => {
        if (response.status !== 201) throw new Error(JSON.stringify(response.body));
      })
      .expect(201);
    const eventId = eventResponse.body.id as string;
    expect(eventResponse.body).toMatchObject({ institutionId, status: 'draft' });

    const ticketResponse = await request(app.getHttpServer())
      .post(`/events/${eventId}/ticket-types`)
      .set(as('admin'))
      .send({ name: 'Gratuito', kind: 'free', priceCents: 0, quantityTotal: 10 })
      .expect(201);
    const ticketTypeId = ticketResponse.body.id as string;
    await request(app.getHttpServer())
      .post(`/events/${eventId}/publish`)
      .set(as('admin'))
      .expect(201);

    await request(app.getHttpServer())
      .get('/universities/public')
      .expect(200)
      .expect((response) => {
        const institution = response.body.institutions.find((item: { id: string }) => item.id === institutionId);
        expect(institution.ambassador).toMatchObject({ githubHandle: actors.ambassador.handle });
        expect(institution).not.toHaveProperty('applicationNotes');
        expect(response.body.events).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: eventId, institutionId }),
        ]));
      });

    const registrationResponse = await request(app.getHttpServer())
      .post(`/events/${eventId}/register`)
      .set(as('participant'))
      .send({ ticketTypeId })
      .expect(201);
    const registrationId = registrationResponse.body.id as string;
    const checkinToken = registrationResponse.body.checkinToken as string;

    await request(app.getHttpServer())
      .post(`/events/${eventId}/checkin`)
      .set(as('admin'))
      .send({ token: checkinToken })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('checked_in');
      });
    await request(app.getHttpServer())
      .post(`/events/${eventId}/checkin`)
      .set(as('admin'))
      .send({ token: checkinToken })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('already_checked_in');
      });

    const certificateResponse = await request(app.getHttpServer())
      .get(`/events/registrations/${registrationId}/certificate`)
      .set(as('participant'))
      .expect(200);
    expect(certificateResponse.body).toMatchObject({
      eventTitle: 'Evento E2E Universitário',
      workloadMinutes: 120,
      verificationCode: `CRT-${checkinToken.slice(0, 12)}`,
    });
    expect(certificateResponse.body.checkedInAt).not.toBeNull();

    const hourRows = await dataSource.query(
      'SELECT id, hours FROM hour_ledger WHERE "memberId" = $1 AND "sourceType" = $2',
      [actors.participant.sub, 'event_checkin'],
    );
    expect(hourRows).toHaveLength(1);
    expect(Number(hourRows[0].hours)).toBe(2);
  });
});

jest.setTimeout(60_000);
