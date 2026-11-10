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
  certificateGrantedAt: string | null;
  certificateInvitedAt: string | null;
  checkinToken: string;
  isGuest: boolean;
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

export type CertificateFilter = "all" | "eligible" | "granted" | "registration_pending";

export interface CertificateInviteBatch {
  batchId: string;
  total: number;
  status: "queued";
  invalid: string[];
}

export interface CertificateInviteBatchProgress {
  batchId: string;
  status: "queued" | "processing" | "retry" | "completed";
  total: number;
  completed: number;
  queued: number;
  processing: number;
  retry: number;
  failed: number;
  skipped: number;
  items: Array<{
    registrationId: string;
    status: string;
    attempts: number;
    lastError: string | null;
  }>;
}

export interface CheckinResult {
  kind: "checked_in" | "already_checked_in" | "invalid";
  attendeeName?: string;
  checkedInAt?: string | null;
  message: string;
}
