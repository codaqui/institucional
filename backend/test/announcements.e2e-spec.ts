import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from './e2e-app.helper';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { Migration047Announcements1795000000000 } from '../src/migrations/1795000000000-Migration047_Announcements';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) throw new Error('O E2E de anúncios exige DB_NAME terminado em _test.');

const actors = {
  admin: { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', handle: 'e2e-announcement-admin', roles: ['admin'] },
  member: { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', handle: 'e2e-announcement-member', roles: ['membro'] },
} satisfies Record<string, JwtPayload>;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: keyof typeof actors) => ({ 'x-test-actor': actor });

describe('Announcements — API e migration 047 com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM announcements WHERE "createdById" = ANY($1::uuid[]) OR "updatedById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createE2eApplication(actors));
    const queryRunner = dataSource.createQueryRunner();
    const existingTable = await queryRunner.query(
      `SELECT to_regclass('public.announcements') AS table_name`,
    );
    if (!existingTable[0]?.table_name) {
      await new Migration047Announcements1795000000000().up(queryRunner);
    }
    await queryRunner.release();
    await removeFixtures();
    await dataSource.getRepository('members').save(Object.entries(actors).map(([key, actor]) => ({
      id: actor.sub,
      githubId: `e2e-announcements-${key}`,
      githubHandle: actor.handle,
      name: `Ator Announcements ${key}`,
      email: `${key}@e2e.invalid`,
      avatarUrl: '',
      roles: actor.roles,
    })));
  });

  afterAll(async () => {
    if (dataSource) await removeFixtures();
    if (app) await app.close();
  });

  it('cria, projeta publicamente, encerra, desativa e preserva dados no migration down/up', async () => {
    const now = Date.now();
    const input = {
      text: 'Estamos corrigindo funções do portal. Reporte problemas no GitHub.',
      severity: 'warning',
      linkUrl: 'https://github.com/codaqui/institucional/issues',
      linkLabel: 'Reportar bug',
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 3_600_000).toISOString(),
    };
    await request(app.getHttpServer()).post('/announcements/admin').set(as('member')).send(input).expect(403);
    const created = await request(app.getHttpServer())
      .post('/announcements/admin')
      .set(as('admin'))
      .send(input)
      .expect(201);
    expect(created.body).toMatchObject({ ...input, active: true, createdById: actors.admin.sub });

    const publicResponse = await request(app.getHttpServer()).get('/announcements/public').expect(200);
    expect(publicResponse.body).toEqual([expect.objectContaining({
      id: created.body.id,
      text: input.text,
      severity: 'warning',
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
    })]);
    expect(JSON.stringify(publicResponse.body)).not.toContain('createdById');
    expect(JSON.stringify(publicResponse.body)).not.toContain('updatedById');
    expect(JSON.stringify(publicResponse.body)).not.toContain('@e2e.invalid');

    const adminList = await request(app.getHttpServer())
      .get('/announcements/admin?page=1&limit=25')
      .set(as('admin'))
      .expect(200);
    expect(adminList.body).toMatchObject({ total: 1, page: 1, totalPages: 1, limit: 25 });

    await request(app.getHttpServer())
      .patch(`/announcements/admin/${created.body.id}`)
      .set(as('admin'))
      .send({ endsAt: new Date(now - 1_000).toISOString() })
      .expect(200);
    expect((await request(app.getHttpServer()).get('/announcements/public').expect(200)).body).toEqual([]);

    await request(app.getHttpServer())
      .patch(`/announcements/admin/${created.body.id}`)
      .set(as('admin'))
      .send({ startsAt: null, endsAt: null })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/announcements/admin/${created.body.id}`)
      .set(as('admin'))
      .expect(200)
      .expect((response) => expect(response.body.active).toBe(false));
    expect((await request(app.getHttpServer()).get('/announcements/public').expect(200)).body).toEqual([]);

    await dataSource.query('CREATE TABLE e2e_backup_announcements AS SELECT * FROM announcements WHERE id = $1', [created.body.id]);
    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration047Announcements1795000000000();
    await migration.down(queryRunner);
    await migration.up(queryRunner);
    await queryRunner.release();
    await dataSource.query('INSERT INTO announcements SELECT * FROM e2e_backup_announcements');
    await dataSource.query('DROP TABLE e2e_backup_announcements');
    const restored = await dataSource.query('SELECT id, active FROM announcements WHERE id = $1', [created.body.id]);
    expect(restored).toEqual([{ id: created.body.id, active: false }]);
  });
});

jest.setTimeout(60_000);
