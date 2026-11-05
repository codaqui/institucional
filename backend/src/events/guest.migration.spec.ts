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
    expect(up).toContain('RAISE EXCEPTION');
    expect(up).toContain('ADD CONSTRAINT "CHK_event_registrations_attendee_identity"');
    expect(up).toContain('"status"::text = \'pending_guest\'');
    expect(up).toContain('OR "memberId" IS NULL');
    expect(up).toContain('("isGuest", (lower("attendeeEmail")))');

    await migration.down(queryRunner);
    const down = queryRunner.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(down).toContain('DROP CONSTRAINT IF EXISTS "CHK_event_registrations_attendee_identity"');
    expect(down).toContain('DROP COLUMN "isGuest"');
    expect(down).not.toContain('DROP TYPE');
  });
});
