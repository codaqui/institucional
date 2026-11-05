import { QueryRunner } from 'typeorm';
import { Migration036Assemblies1794100000000 } from '../migrations/1794100000000-Migration036_Assemblies';

describe('Migration036_Assemblies', () => {
  function queryRunnerDouble() {
    const query = jest.fn().mockResolvedValue(undefined);
    return {
      query,
      runner: { query } as unknown as QueryRunner,
    };
  }

  it('creates the assembly table, enums and required indexes', async () => {
    const { query, runner } = queryRunnerDouble();
    const migration = new Migration036Assemblies1794100000000();

    await migration.up(runner);
    const up = query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(up).toContain(
      'CREATE TYPE "public"."assemblies_type_enum" AS ENUM(\'ordinaria\', \'oficial\')',
    );
    expect(up).toContain(
      "CREATE TYPE \"public\".\"assemblies_status_enum\" AS ENUM('scheduled', 'held', 'canceled')",
    );
    expect(up).toContain('CREATE TABLE "assemblies"');
    expect(up).toContain('"number" integer NOT NULL');
    expect(up).toContain('"scheduledAt" timestamptz NOT NULL');
    expect(up).toContain('"heldAt" timestamptz');
    expect(up).toContain('"notaryRegistry" jsonb');
    expect(up).toContain('"createdById" uuid NOT NULL');
    expect(up).toContain('CHECK ("number" > 0)');
    expect(up).toContain(
      'CREATE UNIQUE INDEX "UQ_assemblies_type_number" ON "assemblies" ("type", "number")',
    );
    expect(up).toContain(
      'CREATE INDEX "IDX_assemblies_status_scheduledAt" ON "assemblies" ("status", "scheduledAt" DESC)',
    );
  });

  it('does not add narrative, voting or quorum columns', async () => {
    const { query, runner } = queryRunnerDouble();
    const migration = new Migration036Assemblies1794100000000();

    await migration.up(runner);
    const up = query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(up).not.toContain('"agenda"');
    expect(up).not.toContain('"minutes"');
    expect(up).not.toContain('"votes"');
    expect(up).not.toContain('"quorum"');
  });

  it('removes only assembly objects on down', async () => {
    const { query, runner } = queryRunnerDouble();
    const migration = new Migration036Assemblies1794100000000();

    await migration.down(runner);
    const down = query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(down).toContain('DROP TABLE IF EXISTS "assemblies"');
    expect(down).toContain(
      'DROP TYPE IF EXISTS "public"."assemblies_status_enum"',
    );
    expect(down).toContain(
      'DROP TYPE IF EXISTS "public"."assemblies_type_enum"',
    );
    expect(down).not.toContain('members"');
    expect(down).not.toContain('hour_ledger');
  });
});
