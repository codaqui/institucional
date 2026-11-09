import { Migration037EntitiesPartnerships1794300000000 } from '../migrations/1794300000000-Migration037_EntitiesPartnerships';

describe('Migration037_EntitiesPartnerships', () => {
  it('creates entities and partnerships with public slugs and foreign keys', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration037EntitiesPartnerships1794300000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "entities"');
    expect(sql).toContain('CREATE TABLE "partnerships"');
    expect(sql).toContain('"slug" character varying(80) NOT NULL');
    expect(sql).toContain('UQ_entities_slug');
    expect(sql).toContain('FK_partnerships_entity');
  });

  it('drops partnerships before entities on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration037EntitiesPartnerships1794300000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql.indexOf('DROP TABLE IF EXISTS "partnerships"')).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS "entities"'));
  });
});
