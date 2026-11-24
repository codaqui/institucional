export interface MenteeMember {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string;
}

export type MentorshipSessionStatus = "requested" | "confirmed" | "completed" | "canceled" | "no_show";

export interface MentorshipSessionView {
  id: string;
  menteeName: string;
  menteeEmail: string;
  topicTags: string[];
  scheduledAt: string;
  durationMin: number;
  timeZone: string;
  status: MentorshipSessionStatus;
  meetLink: string | null;
  /** Token público da sessão (usado para montar o link de acompanhamento). */
  token?: string | null;
  menteeMember?: MenteeMember | null;
}

export const MENTORSHIP_STATUS_LABEL: Record<MentorshipSessionStatus, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  completed: "Concluída",
  canceled: "Cancelada",
  no_show: "No-show",
};

export function formatMentorshipDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** URL pública de acompanhamento da sessão (página do mentorando). */
export function buildMentorshipSessionUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/mentoria/sessao/${encodeURIComponent(token)}`;
}

export interface MentorshipCalendarEvent {
  scheduledAt: string;
  durationMin: number;
  sessionUrl: string;
  menteeName?: string;
  meetLink?: string | null;
}

/** Data/hora básica do iCalendar em UTC: YYYYMMDDTHHMMSSZ. */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}/, "").replace(/[-:]/g, "");
}

/**
 * URL "Adicionar ao Google Calendar" da sessão, com início/fim em UTC e
 * duração total. O link da sessão entra em `details` e o da videochamada,
 * quando há, em `location`. Espelha o helper do backend em
 * `backend/src/mentorship/calendar.ts`.
 */
export function buildMentorshipCalendarUrl(event: MentorshipCalendarEvent): string {
  const start = new Date(event.scheduledAt);
  const end = new Date(start.getTime() + event.durationMin * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Sessão de mentoria Codaqui",
    dates: `${formatUtc(start)}/${formatUtc(end)}`,
    details: `Sessão de mentoria${
      event.menteeName ? ` com ${event.menteeName}` : ""
    }. Acompanhe a sessão: ${event.sessionUrl}`,
  });
  const meetLink = event.meetLink?.trim();
  if (meetLink) params.set("location", meetLink);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
