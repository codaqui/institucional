import { buildMentorshipCalendar } from './calendar';

describe('buildMentorshipCalendar', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  const makeSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    token: 'token-abc',
    menteeName: 'Ana',
    scheduledAt: new Date('2026-11-24T13:00:00Z'),
    durationMin: 60,
    meetLink: 'https://meet.example.test/session',
    ...overrides,
  });

  it('uses a stable UID scoped to codaqui.dev', () => {
    const { ics } = buildMentorshipCalendar(makeSession());
    expect(ics).toContain('UID:session-1@codaqui.dev');
  });

  it('formats DTSTART/DTEND in UTC with the basic calendar format', () => {
    const { ics } = buildMentorshipCalendar(makeSession());
    expect(ics).toContain('DTSTART:20261124T130000Z');
    expect(ics).toContain('DTEND:20261124T140000Z');
    expect(ics).toMatch(/^DTSTART:\d{8}T\d{6}Z$/m);
    expect(ics).toMatch(/^DTEND:\d{8}T\d{6}Z$/m);
  });

  it('computes the end across midnight for the full session duration', () => {
    const { ics } = buildMentorshipCalendar(
      makeSession({
        scheduledAt: new Date('2026-11-24T23:30:00Z'),
        durationMin: 60,
      }),
    );
    expect(ics).toContain('DTSTART:20261124T233000Z');
    expect(ics).toContain('DTEND:20261125T003000Z');
  });

  it('joins ICS lines with CRLF and escapes text values', () => {
    const { ics } = buildMentorshipCalendar(
      makeSession({ menteeName: 'Ana, Bia; Cia\\Dia\nEia' }),
    );
    expect(ics.endsWith('\r\n')).toBe(true);
    const lines = ics.slice(0, -2).split('\r\n');
    expect(lines.every((line) => line.length > 0)).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain('Ana\\, Bia\\; Cia\\\\Dia\\nEia');
    expect(ics).not.toContain('Ana, Bia;');
  });

  it('builds the public session URL from FRONTEND_URL and the session token', () => {
    process.env.FRONTEND_URL = 'https://codaqui.dev';
    const { sessionUrl, ics } = buildMentorshipCalendar(makeSession());
    expect(sessionUrl).toBe('https://codaqui.dev/mentoria/sessao/token-abc');
    expect(ics).toContain(`URL:https://codaqui.dev/mentoria/sessao/token-abc`);
  });

  it('falls back to localhost FRONTEND_URL when the env is absent', () => {
    delete process.env.FRONTEND_URL;
    const { sessionUrl } = buildMentorshipCalendar(makeSession());
    expect(sessionUrl).toBe('http://localhost:3000/mentoria/sessao/token-abc');
  });

  it('builds a Google Calendar template URL with UTC dates and session details', () => {
    process.env.FRONTEND_URL = 'https://codaqui.dev';
    const { calendarUrl, sessionUrl } = buildMentorshipCalendar(makeSession());
    const parsed = new URL(calendarUrl);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('dates')).toBe(
      '20261124T130000Z/20261124T140000Z',
    );
    expect(parsed.searchParams.get('text')).toContain('mentoria');
    expect(parsed.searchParams.get('details')).toContain(sessionUrl);
    expect(parsed.searchParams.get('location')).toBe(
      'https://meet.example.test/session',
    );
  });

  it('returns an ICS attachment descriptor for Nodemailer', () => {
    const { ics, attachment } = buildMentorshipCalendar(makeSession());
    expect(attachment).toEqual({
      filename: 'convite-mentoria.ics',
      content: ics,
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    });
  });

  it('omits the meet link location when the session has none', () => {
    const { ics, calendarUrl } = buildMentorshipCalendar(
      makeSession({ meetLink: null }),
    );
    expect(ics).not.toContain('LOCATION:');
    expect(new URL(calendarUrl).searchParams.get('location')).toBeNull();
  });

  it('produces a VCALENDAR wrapper with a PUBLISH method', () => {
    const { ics } = buildMentorshipCalendar(makeSession());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});
