import { Migration035EventGuests1794000002000 } from '../migrations/1794000002000-Migration035_EventGuests';

describe('Migration035_EventGuests', () => {
  it('adds guest fields and reverses only columns/indexes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as any;
    const migration = new Migration035EventGuests1794000002000();
    await migration.up(queryRunner);
    const up = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(up).toContain("ADD VALUE IF NOT EXISTS 'pending_guest'");
    expect(up).toContain('guestInvitedByMemberId');
    expect(up).toContain('DROP NOT NULL');

    await migration.down(queryRunner);
    const down = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(down).toContain('DROP COLUMN "isGuest"');
    expect(down).not.toContain('DROP TYPE');
  });
});
