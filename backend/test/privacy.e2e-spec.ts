import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapE2eActors } from './e2e-app.helper';
import { Migration051AccountDeletionRequests1795400000000 } from '../src/migrations/1795400000000-Migration051_AccountDeletionRequests';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) throw new Error('O E2E de privacidade exige DB_NAME terminado em _test.');

const actors = {
  member: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-privacy-member', roles: ['membro'] },
} satisfies Record<string, JwtPayload>;

const actorIds = Object.values(actors).map((actor) => actor.sub);

describe('Privacidade — solicitação de exclusão com PostgreSQL real', () => {
  let app: any;
  let dataSource: DataSource;

  beforeAll(async () => {
    const context = await bootstrapE2eActors(actors, 'privacy', async (ds) => {
      await ds.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
      await ds.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
    });
    app = context.app;
    dataSource = context.dataSource;
    await new Migration051AccountDeletionRequests1795400000000().up(dataSource.createQueryRunner());
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM account_deletion_requests WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await new Migration051AccountDeletionRequests1795400000000().down(dataSource.createQueryRunner());
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
    if (app) await app.close();
  });

  it('mantém uma única pendência sob concorrência e não desativa o membro', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/members/me/deletion-request').set('x-test-actor', 'member'),
      request(app.getHttpServer()).post('/members/me/deletion-request').set('x-test-actor', 'member'),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    const rows = await dataSource.query('SELECT id FROM account_deletion_requests WHERE "memberId" = $1 AND status = \'pending\'', [actors.member.sub]);
    expect(rows).toHaveLength(1);
    const member = await dataSource.query('SELECT "isActive" FROM members WHERE id = $1', [actors.member.sub]);
    expect(member[0].isActive).toBe(true);

    const latest = await request(app.getHttpServer()).get('/members/me/deletion-request').set('x-test-actor', 'member');
    expect(latest.status).toBe(200);
    expect(latest.body.id).toBe(responses[0].body.id);
    const auditRows = await dataSource.query('SELECT "actorHandle" FROM audit_logs WHERE action = \'member.deletion_requested\' AND "actorId" = $1', [actors.member.sub]);
    expect(auditRows).toEqual([{ actorHandle: 'e2e-privacy-member' }]);
  });

  it('cancela a própria pendência sem apagar dados ou permitir transição duplicada', async () => {
    const created = await request(app.getHttpServer()).post('/members/me/deletion-request').set('x-test-actor', 'member');
    expect(created.status).toBe(201);

    const canceled = await request(app.getHttpServer()).post('/members/me/deletion-request/cancel').set('x-test-actor', 'member');
    expect(canceled.status).toBe(201);
    expect(canceled.body.status).toBe('canceled');

    const repeated = await request(app.getHttpServer()).post('/members/me/deletion-request/cancel').set('x-test-actor', 'member');
    expect(repeated.status).toBe(404);
    const member = await dataSource.query('SELECT name, email, "isActive" FROM members WHERE id = $1', [actors.member.sub]);
    expect(member[0]).toMatchObject({ name: 'Ator privacy member', email: 'member@e2e.invalid', isActive: true });
    const auditRows = await dataSource.query('SELECT "actorHandle" FROM audit_logs WHERE action = \'member.deletion_request_canceled\' AND "actorId" = $1', [actors.member.sub]);
    expect(auditRows).toEqual([{ actorHandle: 'e2e-privacy-member' }]);
  });
});
