import { Migration040OrganizationalScopes1794330000000 } from '../migrations/1794330000000-Migration040_OrganizationalScopes';

describe('Migration040_OrganizationalScopes', () => {
  it('adds optional directorate community and required assembly entity with backfill', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration040OrganizationalScopes1794330000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('ALTER TABLE "directorates" ADD "communityId" uuid');
    expect(sql).toContain('ALTER TABLE "assemblies" ADD "entityId" uuid');
    expect(sql).toContain("'codaqui', 'Associação Codaqui', 'ong', '44.593.429/0001-05'");
    expect(sql).toContain('UQ_assemblies_entity_type_number');
    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_assemblies_type_number"');
  });

  it('removes the new unique index and columns on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration040OrganizationalScopes1794330000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_assemblies_entity_type_number"');
    expect(sql).toContain('ALTER TABLE "assemblies" DROP COLUMN "entityId"');
    expect(sql).toContain('ALTER TABLE "directorates" DROP COLUMN "communityId"');
  });
});
