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
