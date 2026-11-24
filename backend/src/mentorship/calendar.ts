import type { EmailAttachment } from '../notifications/email.provider';

/** Subconjunto da sessão usado para gerar URLs e o convite de calendário. */
export interface MentorshipCalendarSession {
  id: string;
  token: string;
  menteeName: string;
  scheduledAt: Date;
  durationMin: number;
  meetLink?: string | null;
}

export interface MentorshipCalendar {
  /** URL pública de acompanhamento da sessão (token). */
  sessionUrl: string;
  /** URL "Adicionar ao Google Calendar" com datas em UTC. */
  calendarUrl: string;
  /** Conteúdo ICS (VEVENT) com CRLF. */
  ics: string;
  /** Descriptor pronto para anexar no e-mail via Nodemailer. */
  attachment: EmailAttachment;
}

const ICS_CONTENT_TYPE = 'text/calendar; charset=utf-8; method=PUBLISH';
const ICS_FILENAME = 'convite-mentoria.ics';

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}

/** Formata como data/hora básica do iCalendar em UTC: YYYYMMDDTHHMMSSZ. */
function formatUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}/, '')
    .replace(/[-:]/g, '');
}

/** Escape RFC 5545 para valores TEXT: barra, ponto e vírgula, vírgula e quebras de linha. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function buildIcs(input: {
  sessionId: string;
  menteeName: string;
  startUtc: Date;
  endUtc: Date;
  sessionUrl: string;
  meetLink: string | null;
}): string {
  const descriptionParts = [
    `Sessão de mentoria com ${input.menteeName}.`,
    `Acompanhe a sessão: ${input.sessionUrl}`,
  ];
  if (input.meetLink) {
    descriptionParts.push(`Acesse a videochamada: ${input.meetLink}`);
  }
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Codaqui//Mentoria//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.sessionId}@codaqui.dev`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(input.startUtc)}`,
    `DTEND:${formatUtc(input.endUtc)}`,
    'SUMMARY:Sessão de mentoria Codaqui',
    `DESCRIPTION:${escapeText(descriptionParts.join(' '))}`,
    `URL:${input.sessionUrl}`,
    ...(input.meetLink ? [`LOCATION:${input.meetLink}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export function buildMentorshipCalendar(
  session: MentorshipCalendarSession,
): MentorshipCalendar {
  const baseUrl = frontendBaseUrl();
  const sessionUrl = `${baseUrl}/mentoria/sessao/${session.token}`;
  const startUtc = session.scheduledAt;
  const endUtc = new Date(startUtc.getTime() + session.durationMin * 60_000);
  const meetLink = session.meetLink?.trim() || null;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Sessão de mentoria Codaqui',
    dates: `${formatUtc(startUtc)}/${formatUtc(endUtc)}`,
    details: `Sessão de mentoria com ${session.menteeName}. Acompanhe a sessão: ${sessionUrl}`,
  });
  if (meetLink) params.set('location', meetLink);

  const ics = buildIcs({
    sessionId: session.id,
    menteeName: session.menteeName,
    startUtc,
    endUtc,
    sessionUrl,
    meetLink,
  });

  return {
    sessionUrl,
    calendarUrl: `https://calendar.google.com/calendar/render?${params.toString()}`,
    ics,
    attachment: {
      filename: ICS_FILENAME,
      content: ics,
      contentType: ICS_CONTENT_TYPE,
    },
  };
}
