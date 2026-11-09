import { Migration042CodaquiUniversitario1794400000000 } from '../migrations/1794400000000-Migration042_CodaquiUniversitario';

describe('Migration042_CodaquiUniversitario', () => {
  it('creates city and institution links and ambassador constraints', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue([]) };
    const migration = new Migration042CodaquiUniversitario1794400000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "cities"');
    expect(sql).toContain('ALTER TABLE "entities" ADD "cityId" uuid');
    expect(sql).toContain('ALTER TABLE "managed_events" ADD "institutionId" uuid');
    expect(sql).toContain('ALTER TABLE "member_designations" ADD "validUntil" TIMESTAMPTZ');
    expect(sql).toContain('ALTER TABLE "member_designations" ADD "applicationNotes" text');
    expect(sql).toContain('UQ_cities_name_uf');
    expect(sql).toContain('UQ_university_one_active_ambassador');
    expect(sql).toContain('UQ_university_pending_ambassador');
    expect(sql).toContain("\"status\" = 'active' AND \"designation\" = 'ambassador'");
  });

  it('rejects legacy active duplicates without changing them', async () => {
    const queryRunner = {
      query: jest.fn().mockImplementation((query: string) =>
        query.includes('HAVING COUNT(*) > 1')
          ? Promise.resolve([{ targetId: 'ies-duplicate' }])
          : Promise.resolve(undefined),
      ),
    };
    const migration = new Migration042CodaquiUniversitario1794400000000();

    await expect(migration.up(queryRunner as any)).rejects.toThrow('ies-duplicate');
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');
    expect(sql).not.toContain('CREATE UNIQUE INDEX "UQ_university_one_active_ambassador"');
  });

  it('drops only the objects introduced by the migration', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue([]) };
    const migration = new Migration042CodaquiUniversitario1794400000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_university_one_active_ambassador"');
    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_university_pending_ambassador"');
    expect(sql).toContain('ALTER TABLE "entities" DROP COLUMN "cityId"');
    expect(sql).toContain('ALTER TABLE "managed_events" DROP COLUMN "institutionId"');
    expect(sql).toContain('ALTER TABLE "member_designations" DROP COLUMN "validUntil"');
    expect(sql).toContain('ALTER TABLE "member_designations" DROP COLUMN "applicationNotes"');
    expect(sql).toContain('DROP TABLE IF EXISTS "cities"');
  });
});
