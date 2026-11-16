import { Migration050MentorshipLifecycle1795300000000 } from '../migrations/1795300000000-Migration050_MentorshipLifecycle';

describe('Migration050_MentorshipLifecycle', () => {
  it('backs up active flags, reconciles only valid designations and restores on down', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration050MentorshipLifecycle1795300000000();

    await migration.up(queryRunner as any);
    const upSql = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(upSql).toContain('mentor_profile_active_backup');
    expect(upSql).toContain('EXISTS');
    expect(upSql).toContain('"designation"."validUntil" IS NULL OR "designation"."validUntil" > NOW()');

    await migration.down(queryRunner as any);
    const downSql = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(downSql).toContain('UPDATE "mentor_profiles" AS "profile"');
    expect(downSql).toContain('SET "active" = "backup"."active"');
    expect(downSql).toContain('DROP TABLE "mentor_profile_active_backup"');
  });
});
