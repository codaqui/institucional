import { Migration053EventC4P1795600000000 } from '../migrations/1795600000000-Migration053_EventC4P';

describe('Migration053_EventC4P', () => {
  const queries: string[] = [];
  const queryRunner = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
    }),
  } as any;

  beforeEach(() => {
    queries.length = 0;
    queryRunner.query.mockClear();
  });

  it('links calls to external activations and enforces one call per activity', async () => {
    await new Migration053EventC4P1795600000000().up(queryRunner);
    const sql = queries.join('\n');

    expect(sql).toContain('ALTER TABLE "c4p_calls" ADD "externalActivationId" uuid');
    expect(sql).toContain('FOREIGN KEY ("externalActivationId") REFERENCES "external_event_activations"("id") ON DELETE RESTRICT');
    expect(sql).toContain('CREATE UNIQUE INDEX "UQ_c4p_calls_managedEvent" ON "c4p_calls" ("managedEventId") WHERE "managedEventId" IS NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "UQ_c4p_calls_externalActivation" ON "c4p_calls" ("externalActivationId") WHERE "externalActivationId" IS NOT NULL');
  });

  it('rolls back only the external activation link and uniqueness constraints', async () => {
    await new Migration053EventC4P1795600000000().down(queryRunner);
    const sql = queries.join('\n');

    expect(sql).toContain('DROP INDEX "public"."UQ_c4p_calls_externalActivation"');
    expect(sql).toContain('DROP INDEX "public"."UQ_c4p_calls_managedEvent"');
    expect(sql).toContain('ALTER TABLE "c4p_calls" DROP COLUMN "externalActivationId"');
    expect(sql).not.toContain('DROP TABLE "c4p_calls"');
    expect(sql).not.toContain('DROP TABLE "managed_events"');
  });
});
