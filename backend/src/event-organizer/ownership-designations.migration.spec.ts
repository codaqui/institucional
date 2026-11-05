import { Migration034EventOrganizerDesignations1794000001000 } from '../migrations/1794000001000-Migration034_EventOrganizerDesignations';

describe('Migration034_EventOrganizerDesignations', () => {
  it('seeds organizer designations idempotently without dropping legacy ownership', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as any;
    const migration = new Migration034EventOrganizerDesignations1794000001000();

    await migration.up(queryRunner);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');
    expect(sql).toContain('INSERT INTO "member_designations"');
    expect(sql).toContain('unnest("o"."scope")');
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(sql).not.toContain('DROP TABLE');

    const callsBeforeDown = queryRunner.query.mock.calls.length;
    await migration.down(queryRunner);
    expect(queryRunner.query.mock.calls).toHaveLength(callsBeforeDown);
    expect(queryRunner.query.mock.calls.map(([query]) => query).join('\n')).not.toContain('DELETE FROM');
  });
});
