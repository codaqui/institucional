import { Migration038ExtensionProjects1794310000000 } from '../migrations/1794310000000-Migration038_ExtensionProjects';

describe('Migration038_ExtensionProjects', () => {
  it('creates nullable draft fields and scoped uniqueness constraints', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration038ExtensionProjects1794310000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "extension_projects"');
    expect(sql).toContain('CREATE TABLE "project_participants"');
    expect(sql).toContain('"kind" character varying(24)');
    expect(sql).toContain('UQ_extension_projects_normalizedName');
    expect(sql).toContain('UQ_extension_projects_slug');
    expect(sql).toContain('UQ_project_participants_active_member');
    expect(sql).toContain('UQ_extension_project_active_mentor');
    expect(sql).toContain("WHERE \"leftAt\" IS NULL");
    expect(sql).toContain("AND \"status\" = 'active'");
  });

  it('drops project constraints and tables in dependency order', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration038ExtensionProjects1794310000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_extension_project_active_mentor"');
    expect(sql.indexOf('DROP TABLE IF EXISTS "project_participants"')).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS "extension_projects"'));
  });
});
