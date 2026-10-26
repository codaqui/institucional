/**
 * Tipos do contrato do backend para a tela de check-in
 * (Fase 2 do EVENT_PLAN) — espelham `src/pages/admin/eventos-checkin.tsx`.
 */

export interface ManagedEvent {
  id: string;
  title: string;
  startAt: string;
  status: string;
  canUseList: boolean;
}

/** Ativação de features em evento externo (GET /events/checkin-scope). */
export interface ExternalActivationItem {
  id: string;
  eventKey: string;
  features: string[];
  title?: string;
  canUseList: boolean;
}

export interface EventRegistration {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string;
  status: string;
  checkedInAt: string | null;
  checkinToken: string;
  member: {
    id: string;
    name: string | null;
    githubHandle: string | null;
  } | null;
  payer: {
    id: string;
    name: string | null;
    githubHandle: string | null;
  } | null;
  ticketType: {
    name: string | null;
  } | null;
  order: {
    id: string;
    status: string;
    totalCents: number;
    quantity: number;
    paidAt: string | null;
  } | null;
}

export interface CheckinResult {
  kind: "checked_in" | "already_checked_in" | "invalid";
  attendeeName?: string;
  checkedInAt?: string | null;
  message: string;
}
