import { Migration044Mentorship1794600000000 } from '../migrations/1794600000000-Migration044_Mentorship';

describe('Migration044_Mentorship', () => {
  it('creates mentor profiles, availability and sessions with slot uniqueness', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration044Mentorship1794600000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "mentor_profiles"');
    expect(sql).toContain('CREATE TABLE "mentor_availability"');
    expect(sql).toContain('CREATE TABLE "mentorship_sessions"');
    expect(sql).toContain('UNIQUE ("mentorId", "scheduledAt")');
    expect(sql).toContain('"menteeMemberId" uuid');
    expect(sql).toContain('"token" uuid NOT NULL');
    expect(sql).toContain('CHECK ("durationMin" BETWEEN 15 AND 240)');
    expect(sql).toContain('CHECK ("rating" BETWEEN 1 AND 5)');
  });

  it('drops only mentorship tables on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration044Mentorship1794600000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('DROP TABLE IF EXISTS "mentorship_sessions"');
    expect(sql).toContain('DROP TABLE IF EXISTS "mentor_availability"');
    expect(sql).toContain('DROP TABLE IF EXISTS "mentor_profiles"');
    expect(sql).not.toContain('DROP TABLE IF EXISTS "members"');
  });
});
