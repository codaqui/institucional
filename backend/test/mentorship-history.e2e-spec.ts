import { DataSource } from 'typeorm';
import { createE2eApplication } from './e2e-app.helper';
import { MENTOR_HISTORY_SEED, Migration046MentorshipHistory1794800000000 } from '../src/migrations/1794800000000-Migration046_MentorshipHistory';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E do histórico de mentoria exige DB_NAME terminado em _test.');
}

const actors = {
  admin: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-history-admin', roles: ['admin'] },
} satisfies Record<string, JwtPayload>;

describe('Migration046 — histórico de mentoria com PostgreSQL real', () => {
  let dataSource: DataSource;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const bootstrap = await createE2eApplication(actors);
    dataSource = bootstrap.dataSource;
    close = () => bootstrap.app.close();
  });

  afterAll(async () => {
    if (close) await close();
  });

  it('imports 173 sessions idempotently and rolls back only imported data', async () => {
    const migration = new Migration046MentorshipHistory1794800000000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    await migration.up(queryRunner);

    const sessions = await dataSource.query('SELECT COUNT(*)::int AS total FROM mentorship_sessions WHERE notes LIKE \'legacy-import:%\'');
    expect(sessions[0].total).toBe(173);

    const ids = MENTOR_HISTORY_SEED.mentors.map((mentor) => mentor.id);
    const profiles = await dataSource.query('SELECT id, active FROM mentor_profiles WHERE id = ANY($1::uuid[]) ORDER BY id', [ids]);
    expect(profiles).toHaveLength(6);
    expect(profiles.filter((profile: { active: boolean }) => profile.active)).toHaveLength(1);

    const placeholders = await dataSource.query('SELECT id FROM members WHERE id = ANY($1::uuid[]) AND "isActive" = false', [ids]);
    expect(placeholders).toHaveLength(5);

    const hours = await dataSource.query('SELECT COUNT(*)::int AS total FROM hour_ledger WHERE "sourceType" = $1', ['mentorship_session']);
    expect(hours[0].total).toBe(0);

    await migration.up(queryRunner);
    const repeated = await dataSource.query('SELECT COUNT(*)::int AS total FROM mentorship_sessions WHERE notes LIKE \'legacy-import:%\'');
    expect(repeated[0].total).toBe(173);

    await migration.down(queryRunner);
    const rolledBack = await dataSource.query('SELECT COUNT(*)::int AS total FROM mentorship_sessions WHERE notes LIKE \'legacy-import:%\'');
    expect(rolledBack[0].total).toBe(0);
    const remainingPlaceholders = await dataSource.query('SELECT id FROM members WHERE id = ANY($1::uuid[]) AND "isActive" = false', [ids]);
    expect(remainingPlaceholders).toHaveLength(0);

    const enderson = MENTOR_HISTORY_SEED.mentors.find((mentor) => mentor.slug === 'enderson')!;
    const realMember = await dataSource.query(
      'SELECT id FROM members WHERE "isActive" = true AND EXISTS (SELECT 1 FROM UNNEST("secondaryEmails") AS email WHERE LOWER(email) = LOWER($1))',
      [enderson.email],
    );
    expect(realMember).toHaveLength(1);
    await queryRunner.release();
  });
});
