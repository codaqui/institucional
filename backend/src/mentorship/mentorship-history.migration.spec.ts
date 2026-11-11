import { MENTOR_HISTORY_SEED, Migration046MentorshipHistory1794800000000 } from '../migrations/1794800000000-Migration046_MentorshipHistory';

describe('Migration046_MentorshipHistory', () => {
  it('contains only the 173 valid deduplicated historical sessions', () => {
    expect(MENTOR_HISTORY_SEED.sessions).toHaveLength(173);
    expect(MENTOR_HISTORY_SEED.mentors.filter((mentor) => mentor.active)).toHaveLength(1);
    expect(MENTOR_HISTORY_SEED.mentors.filter((mentor) => mentor.placeholder)).toHaveLength(5);
    expect(new Set(MENTOR_HISTORY_SEED.sessions.map((session) => session.sourceId)).size).toBe(173);
    expect(MENTOR_HISTORY_SEED.sessions.every((session) => session.durationMin >= 15 && session.durationMin <= 240)).toBe(true);
    expect(MENTOR_HISTORY_SEED.sessions.every((session) => session.notes.startsWith('legacy-import:'))).toBe(true);
    expect(MENTOR_HISTORY_SEED.sessions.every((session) => session.meetLink === null && session.guestConsentAt === null)).toBe(true);
  });

  it('uses idempotent upserts and never writes hour ledger', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    await new Migration046MentorshipHistory1794800000000().up(queryRunner as any);
    const sql = queryRunner.query.mock.calls
      .map(([query, parameters]) => `${query}\n${JSON.stringify(parameters)}`)
      .join('\n');

    expect(sql).toContain('legacy-import:');
    expect(sql).toContain('ON CONFLICT ("mentorId", "scheduledAt") DO NOTHING');
    expect(sql).toContain('secondaryEmails');
    expect(sql).not.toContain('hour_ledger');
  });

  it('rolls back only imported sessions and inactive placeholders', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    await new Migration046MentorshipHistory1794800000000().down(queryRunner as any);
    const sql = queryRunner.query.mock.calls
      .map(([query, parameters]) => `${query}\n${JSON.stringify(parameters)}`)
      .join('\n');

    expect(sql).toContain('legacy-import:');
    expect(sql).toContain('DELETE FROM "members"');
    expect(sql).toMatch(/"isActive"\s*=\s*false/);
    expect(sql).not.toContain('DELETE FROM "member_designations"');
  });
});
