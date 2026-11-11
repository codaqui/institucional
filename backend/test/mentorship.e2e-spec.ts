import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication, saveE2eActors } from './e2e-app.helper';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { Migration044Mentorship1794600000000 } from '../src/migrations/1794600000000-Migration044_Mentorship';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de mentoria exige DB_NAME terminado em _test.');
}

const actors = {
  candidate: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-mentor-candidate', roles: ['membro'] },
  admin: { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', handle: 'e2e-mentor-admin', roles: ['admin'] },
} satisfies Record<string, JwtPayload>;

type ActorName = keyof typeof actors;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: ActorName) => ({ 'x-test-actor': actor });

function nextMondayAt19(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  return `${date.toISOString().slice(0, 10)}T19:00`;
}

describe('Fase 5 — jornada de mentoria com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM email_logs WHERE "to" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM hour_ledger WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM mentorship_sessions WHERE "mentorId" IN (SELECT id FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM mentor_availability WHERE "mentorId" IN (SELECT id FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM member_designations WHERE "memberId" = ANY($1::uuid[]) OR "appointedById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createE2eApplication(actors));
    await removeFixtures();
    await saveE2eActors(dataSource, actors, 'Mentoria');
  });

  afterAll(async () => {
    if (dataSource) await removeFixtures();
    if (app) await app.close();
  });

  it('executa candidatura, reserva concorrente, ciclo, horas, avaliação e migration down/up', async () => {
    const initialPublic = await request(app.getHttpServer()).get('/mentorship/public').expect(200);
    const application = await request(app.getHttpServer())
      .post('/mentorship/applications')
      .set(as('candidate'))
      .send({ areas: ['DevOps'], focus: 'Carreira' })
      .expect(201);
    expect(application.body).toMatchObject({ status: 'pending', targetKey: 'mentoria', designation: 'mentor' });

    const pendingApplications = await request(app.getHttpServer())
      .get('/mentorship/applications')
      .set(as('admin'))
      .expect(200);
    expect(pendingApplications.body).toEqual([
      expect.objectContaining({
        id: application.body.id,
        memberId: actors.candidate.sub,
        name: 'Ator Mentoria candidate',
        githubHandle: 'e2e-mentor-candidate',
        areas: ['DevOps'],
        focus: 'Carreira',
      }),
    ]);
    expect(JSON.stringify(pendingApplications.body)).not.toContain('seed-');

    await request(app.getHttpServer())
      .post(`/mentorship/applications/${application.body.id}/confirm`)
      .set(as('admin'))
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ active: true, approvedById: actors.admin.sub });
      });

    const scheduledAt = nextMondayAt19();
    await request(app.getHttpServer())
      .put('/mentorship/availability/1')
      .set(as('candidate'))
      .send([{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }])
      .expect(200);

    const mentor = await dataSource.query('SELECT id FROM mentor_profiles WHERE "memberId" = $1', [actors.candidate.sub]);
    const slot = {
      mentorId: mentor[0].id,
      scheduledAt,
      durationMin: 60,
      menteeName: 'Participante E2E',
      menteeEmail: 'guest@e2e.invalid',
      topicTags: ['DevOps'],
      guestConsentAt: new Date().toISOString(),
    };
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/mentorship/sessions').send(slot),
      request(app.getHttpServer()).post('/mentorship/sessions').send(slot),
    ]);
    expect([first.status, second.status].sort((left, right) => left - right)).toEqual([201, 409]);
    const saved = first.status === 201 ? first : second;
    const sessionId = saved.body.id as string;
    const token = saved.body.token as string;

    await request(app.getHttpServer())
      .post(`/mentorship/sessions/${sessionId}/confirm`)
      .set(as('candidate'))
      .send({ meetLink: 'https://meet.example.test/e2e-mentorship' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: 'confirmed', meetLink: 'https://meet.example.test/e2e-mentorship' });
      });

    await dataSource.query('UPDATE mentorship_sessions SET "scheduledAt" = $1 WHERE id = $2', [new Date(Date.now() - 60_000), sessionId]);
    await request(app.getHttpServer())
      .post(`/mentorship/sessions/${sessionId}/complete`)
      .set(as('candidate'))
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: 'completed' });
        expect(response.body.completedAt).toBeTruthy();
      });
    await request(app.getHttpServer())
      .post(`/mentorship/sessions/${sessionId}/complete`)
      .set(as('candidate'))
      .expect(409);

    const hourRows = await dataSource.query(
      'SELECT * FROM hour_ledger WHERE "memberId" = $1 AND "sourceType" = $2 AND "sourceId" = $3',
      [actors.candidate.sub, 'mentorship_session', sessionId],
    );
    expect(hourRows).toHaveLength(1);
    expect(hourRows[0]).toMatchObject({ status: 'pending', hours: '1.00' });

    await request(app.getHttpServer())
      .post(`/mentorship/sessions/${token}/rating`)
      .send({ rating: 5, feedback: 'Sessão sintética excelente.' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ rating: 5, feedback: 'Sessão sintética excelente.' });
      });

    await request(app.getHttpServer())
      .get('/mentorship/public')
      .expect(200)
      .expect((response) => {
        expect(JSON.stringify(response.body)).not.toContain('guest@e2e.invalid');
        expect(response.body).not.toHaveProperty('sessions');
        expect(response.body.insights).toMatchObject({
          completed: initialPublic.body.insights.completed + 1,
          activeMentors: initialPublic.body.insights.activeMentors + 1,
        });
      });

    await dataSource.query('CREATE TABLE e2e_backup_mentor_profiles AS SELECT * FROM mentor_profiles WHERE "memberId" = $1', [actors.candidate.sub]);
    await dataSource.query('CREATE TABLE e2e_backup_mentor_availability AS SELECT * FROM mentor_availability WHERE "mentorId" = $1', [mentor[0].id]);
    await dataSource.query('CREATE TABLE e2e_backup_mentorship_sessions AS SELECT * FROM mentorship_sessions WHERE id = $1', [sessionId]);
    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration044Mentorship1794600000000();
    await migration.down(queryRunner);
    const designations = await dataSource.query('SELECT id FROM member_designations WHERE "memberId" = $1 AND "targetKey" = $2', [actors.candidate.sub, 'mentoria']);
    expect(designations).toHaveLength(1);
    await migration.up(queryRunner);
    await queryRunner.release();

    await dataSource.query('INSERT INTO mentor_profiles SELECT * FROM e2e_backup_mentor_profiles');
    await dataSource.query('INSERT INTO mentor_availability SELECT * FROM e2e_backup_mentor_availability');
    await dataSource.query('INSERT INTO mentorship_sessions SELECT * FROM e2e_backup_mentorship_sessions');
    await dataSource.query('DROP TABLE e2e_backup_mentor_profiles, e2e_backup_mentor_availability, e2e_backup_mentorship_sessions');
    const restored = await dataSource.query('SELECT token, rating FROM mentorship_sessions WHERE id = $1', [sessionId]);
    expect(restored[0]).toMatchObject({ token, rating: 5 });
    expect(await dataSource.query('SELECT id FROM hour_ledger WHERE "sourceId" = $1', [sessionId])).toHaveLength(1);
  });

  it('admin lista, desativa e reatribui mentores com designations e roles coerentes', async () => {
    await request(app.getHttpServer())
      .get('/mentorship/admin/mentors')
      .set(as('candidate'))
      .expect(403);
    const listing = await request(app.getHttpServer())
      .get('/mentorship/admin/mentors?page=1&limit=50')
      .set(as('admin'))
      .expect(200);
    expect(listing.body).toMatchObject({ page: 1, limit: 50 });
    const candidateMentor = listing.body.data.find((mentor: { memberId: string }) => mentor.memberId === actors.candidate.sub);
    expect(candidateMentor).toMatchObject({ active: true, isPlaceholder: false });
    expect(JSON.stringify(listing.body)).not.toContain('candidate@e2e.invalid');

    await request(app.getHttpServer())
      .patch(`/mentorship/admin/mentors/${candidateMentor.id}`)
      .set(as('admin'))
      .send({ memberId: actors.candidate.sub, areas: ['DevOps', 'Carreira'], focus: 'Liderança', active: false })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ active: false, areas: ['DevOps', 'Carreira'], focus: 'Liderança' });
      });
    const deactivated = await dataSource.query(
      'SELECT status FROM member_designations WHERE "memberId" = $1 AND "targetKey" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [actors.candidate.sub, 'mentoria'],
    );
    expect(deactivated[0].status).toBe('removed');
    const candidateRoles = await dataSource.query('SELECT roles FROM members WHERE id = $1', [actors.candidate.sub]);
    expect(candidateRoles[0].roles).not.toContain('mentor');

    await request(app.getHttpServer())
      .patch(`/mentorship/admin/mentors/${candidateMentor.id}`)
      .set(as('admin'))
      .send({ memberId: actors.admin.sub, areas: ['DevOps', 'Carreira'], focus: 'Liderança', active: true })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ memberId: actors.admin.sub, active: true });
      });
    const reassigned = await dataSource.query(
      'SELECT "memberId", status FROM member_designations WHERE "memberId" = ANY($1::uuid[]) AND "targetKey" = $2 ORDER BY "createdAt"',
      [[actors.candidate.sub, actors.admin.sub], 'mentoria'],
    );
    expect(reassigned).toEqual(expect.arrayContaining([
      { memberId: actors.candidate.sub, status: 'removed' },
      { memberId: actors.admin.sub, status: 'active' },
    ]));
    const adminRoles = await dataSource.query('SELECT roles FROM members WHERE id = $1', [actors.admin.sub]);
    expect(adminRoles[0].roles).toContain('mentor');
  });
});

jest.setTimeout(60_000);
