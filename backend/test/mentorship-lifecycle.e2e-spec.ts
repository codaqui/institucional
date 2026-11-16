import { DataSource } from 'typeorm';
import { createE2eApplication } from './e2e-app.helper';
import { Migration050MentorshipLifecycle1795300000000 } from '../src/migrations/1795300000000-Migration050_MentorshipLifecycle';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E do ciclo de mentoria exige DB_NAME terminado em _test.');
}

const actors = {
  admin: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-lifecycle-admin', roles: ['admin'] },
} satisfies Record<string, JwtPayload>;

const ids = {
  valid: '10000000-0000-4000-8000-000000000001',
  missing: '10000000-0000-4000-8000-000000000002',
  inactive: '10000000-0000-4000-8000-000000000003',
  expired: '10000000-0000-4000-8000-000000000004',
};

describe('Migration050 — ciclo de vida de mentoria com PostgreSQL real', () => {
  let dataSource: DataSource;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const bootstrap = await createE2eApplication(actors);
    dataSource = bootstrap.dataSource;
    close = () => bootstrap.app.close();
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM member_designations WHERE "memberId" = ANY($1::uuid[])', [Object.values(ids)]);
    await dataSource.query('DELETE FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[])', [Object.values(ids)]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [Object.values(ids)]);
    await dataSource.query('DROP TABLE IF EXISTS mentor_profile_active_backup');
    if (close) await close();
  });

  it('backs up, reconciles and restores active mentor profiles', async () => {
    await dataSource.query('DELETE FROM member_designations WHERE "memberId" = ANY($1::uuid[])', [Object.values(ids)]);
    await dataSource.query('DELETE FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[])', [Object.values(ids)]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [Object.values(ids)]);

    await Promise.all(Object.entries(ids).map(async ([handle, id]) => {
      await dataSource.query(
        `INSERT INTO members (id, "githubId", "githubHandle", name, email, roles)
         VALUES ($1, $2, $3, $4, $5, ARRAY['membro']::text[])`,
        [id, `e2e-lifecycle-${handle}`, handle, `Ator ${handle}`, `${handle}@e2e.invalid`],
      );
      await dataSource.query(
        'INSERT INTO mentor_profiles ("memberId", areas, active, "approvedById") VALUES ($1, ARRAY[]::text[], $2, $3)',
        [id, id !== ids.inactive, id],
      );
    }));
    await Promise.all([ids.valid, ids.inactive].map(async (id) => {
      await dataSource.query(
        `INSERT INTO member_designations ("memberId", "targetType", "targetKey", designation, status, "appointedById")
         VALUES ($1, 'program', 'mentoria', 'mentor', 'active', $2)`,
        [id, id],
      );
    }));
    await dataSource.query(
      `INSERT INTO member_designations ("memberId", "targetType", "targetKey", designation, status, "appointedById", "validUntil")
       VALUES ($1, 'program', 'mentoria', 'mentor', 'active', $2, NOW() - INTERVAL '1 day')`,
      [ids.expired, ids.expired],
    );

    const migration = new Migration050MentorshipLifecycle1795300000000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);
    const reconciled = await dataSource.query(
      'SELECT "memberId", active FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[]) ORDER BY "memberId"',
      [Object.values(ids)],
    );
    expect(reconciled.map((row: { active: boolean }) => row.active)).toEqual([true, false, true, false]);

    await migration.down(queryRunner);
    const restored = await dataSource.query(
      'SELECT "memberId", active FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[]) ORDER BY "memberId"',
      [Object.values(ids)],
    );
    expect(restored.map((row: { active: boolean }) => row.active)).toEqual([true, true, false, true]);

    await migration.up(queryRunner);
    const repeated = await dataSource.query(
      'SELECT "memberId", active FROM mentor_profiles WHERE "memberId" = ANY($1::uuid[]) ORDER BY "memberId"',
      [Object.values(ids)],
    );
    expect(repeated.map((row: { active: boolean }) => row.active)).toEqual([true, false, true, false]);
    await queryRunner.release();
  });
});
