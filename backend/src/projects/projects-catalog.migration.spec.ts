import { CATALOG_SEED } from './catalog-seed';
import { Migration055ProjectsCatalog1795900000000 } from '../migrations/1795900000000-Migration055_ProjectsCatalog';

describe('Migration055 projects catalog', () => {
  function queryRunner() {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    return {
      calls,
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes('FROM "members" WHERE "githubHandle" = $1')) return [{ id: 'member-1' }];
        if (sql.includes('FROM "entities" WHERE "slug" = $1')) return [{ id: `entity-${params?.[0]}` }];
        return [];
      }),
    };
  }

  it('adds the category and canonical URL and inserts every seed without overwriting', async () => {
    const runner = queryRunner();
    const migration = new Migration055ProjectsCatalog1795900000000();

    await migration.up(runner as any);

    const projectInserts = runner.calls.filter((call) => call.sql.includes('INSERT INTO "extension_projects"'));
    expect(projectInserts).toHaveLength(CATALOG_SEED.length);
    expect(projectInserts.every((call) => call.sql.includes('ON CONFLICT (slug) DO NOTHING'))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('ADD "category"') && call.sql.includes("DEFAULT 'extension'"))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('ADD "canonicalUrl"'))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('CHECK') && call.sql.includes('open_source'))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('UPDATE "extension_projects"'))).toBe(false);
  });

  it('rejects the migration when the technical importer is absent', async () => {
    const runner = queryRunner();
    runner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "members"')) return [];
      return [];
    });

    await expect(migrationWithRunner(runner)).rejects.toThrow('endersonmenezes');
  });

  it('removes only imported projects and the new fields on down', async () => {
    const runner = queryRunner();
    const migration = new Migration055ProjectsCatalog1795900000000();

    await migration.down(runner as any);

    const deleteProjects = runner.calls.find((call) => call.sql.includes('DELETE FROM "extension_projects"'));
    expect(deleteProjects).toBeDefined();
    expect(CATALOG_SEED.every((entry) => deleteProjects!.params?.flat().includes(entry.slug))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('DELETE FROM "entities"'))).toBe(false);
    expect(runner.calls.some((call) => call.sql.includes('DROP COLUMN "canonicalUrl"'))).toBe(true);
    expect(runner.calls.some((call) => call.sql.includes('DROP COLUMN "category"'))).toBe(true);
  });
});

async function migrationWithRunner(runner: ReturnType<typeof queryRunner>): Promise<void> {
  const migration = new Migration055ProjectsCatalog1795900000000();
  return migration.up(runner as any);
}
