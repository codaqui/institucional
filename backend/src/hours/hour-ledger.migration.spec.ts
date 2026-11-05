import { Migration033HourLedger1794000000000 } from '../migrations/1794000000000-Migration033_HourLedger';

describe('Migration033_HourLedger', () => {
  it('creates and removes only the hour ledger objects', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as any;
    const migration = new Migration033HourLedger1794000000000();

    await migration.up(queryRunner);
    const up = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(up).toContain('CREATE TABLE "hour_ledger"');
    expect(up).toContain('event_checkin');
    expect(up).toContain('idempotencyKey');
    expect(up).toContain('CREATE UNIQUE INDEX');

    await migration.down(queryRunner);
    const down = queryRunner.query.mock.calls.at(-1)[0];
    expect(down).toContain('DROP TABLE IF EXISTS "hour_ledger"');
  });
});
