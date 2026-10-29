/**
 * Tipos e helpers compartilhados do dashboard do membro.
 * Port 1:1 de `src/pages/membro/index.tsx` (Docusaurus).
 */
import type { AuthUser } from "../../../../lib/auth-client";

export interface Donation {
  id: string;
  amount: number;
  description: string;
  community: string;
  referenceId: string;
  createdAt: string;
}

export interface ReimbursementRequest {
  id: string;
  account: { name: string };
  amount: number;
  description: string;
  receiptUrl: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  status: string;
  interval: string;
  amount: number;
  currency: string;
  communityId: string;
  entityType?: "member" | "business";
  companyId?: string | null;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const getSubscriptionOwnerLabel = (
  sub: Subscription,
): "Pessoal" | "Business" =>
  sub.entityType === "business" || !!sub.companyId ? "Business" : "Pessoal";

export const getDonationOwnerLabel = (
  donation: Donation,
): "Pessoal" | "Business" => {
  const description = donation.description.toLowerCase();
  return description.includes("empresa") || description.includes("business")
    ? "Business"
    : "Pessoal";
};

export function getRoleLabel(role: string): string {
  if (role === "admin") return "Organização";
  if (role === "finance-analyzer") return "Finance Analyzer";
  if (role === "event_organizer") return "Organizador de Eventos";
  if (role === "event_checker") return "Credenciamento";
  if (role === "event_finance") return "Financeiro de Eventos";
  if (role === "membro" || role === "member") return "Membro";
  return role;
}

export function getRoleColor(
  role: string,
): "primary" | "secondary" | "info" | "default" {
  if (role === "admin") return "primary";
  if (role === "finance-analyzer") return "secondary";
  if (role === "event_organizer" || role === "event_checker" || role === "event_finance")
    return "info";
  return "default";
}

/** Multi-role: o backend expõe `roles: string[]` na sessão (migração Fase 2). */
export function getUserRoles(u: AuthUser | null): string[] {
  return u?.roles ?? [];
}

// ---------------------------------------------------------------------------
// Eventos (histórico de inscrições)
// ---------------------------------------------------------------------------

export type RegistrationStatus =
  | "confirmed"
  | "pending_match"
  | "cancelled"
  | "refunded"
  | "waitlist";

export interface EventRegistration {
  id: string;
  status: RegistrationStatus;
  checkedInAt: string | null;
  checkinToken: string;
  attendeeName: string;
  attendeeEmail?: string;
  memberId: string | null;
  payerMemberId: string | null;
  isPayerOnly?: boolean;
  /** Evento interno. Null para inscrições externas via activation. */
  event: {
    id: string;
    slug?: string | null;
    title: string;
    startAt: string;
    location: string | null;
    status: string;
  } | null;
  /** Ativação externa (quando event == null). */
  activation?: { eventKey: string; title: string; startAt?: string | null } | null;
  ticketType: { name: string; kind: string; priceCents: number } | null;
}

export interface CertificateData {
  attendeeName: string;
  attendeeEmail?: string;
  eventTitle: string;
  /** Eventos externos podem não ter datas — o backend retorna null. */
  eventStartAt: string | null;
  eventEndAt: string | null;
  /** Pode ser null (externo sem carga horária definida). */
  workloadMinutes: number | null;
  /** Chave da comunidade organizadora (ex.: 'cloudnativemaringa'). */
  communityProjectKey: string | null;
  verificationCode: string;
  issuedAt: string;
}

export const registrationStatusConfig: Record<
  RegistrationStatus,
  { label: string; color: "success" | "warning" | "error" | "info" | "default" }
> = {
  confirmed: { label: "Confirmada", color: "success" },
  pending_match: { label: "Aguardando vínculo", color: "warning" },
  cancelled: { label: "Cancelada", color: "error" },
  refunded: { label: "Reembolsada", color: "default" },
  waitlist: { label: "Lista de espera", color: "info" },
};

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatWorkload = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}min`;
};

/**
 * Formata uma data ISO de forma defensiva: retorna null quando o valor é
 * ausente ou inválido (evita "Invalid Date" na UI — ex.: certificados de
 * eventos externos, que podem ter datas/workload nulos).
 */
export const formatDateSafe = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
};

export type EventsSubTab = "future" | "purchased" | "history";
export type EventsListMode = "mine" | "purchased" | "history";

export function getEventsEmptyMessage(subTab: EventsSubTab): string {
  switch (subTab) {
    case "future":
      return "Nenhum ingresso próximo.";
    case "purchased":
      return "Você ainda não comprou ingressos para outras pessoas.";
    case "history":
      return "Nenhum ingresso no histórico.";
  }
}

export function getEventsListMode(subTab: EventsSubTab): EventsListMode {
  switch (subTab) {
    case "purchased":
      return "purchased";
    case "history":
      return "history";
    default:
      return "mine";
  }
}

export function isUpcomingEvent(reg: EventRegistration): boolean {
  const startAt = reg.event?.startAt ?? reg.activation?.startAt ?? null;
  if (!startAt) return true; // eventos sem data tratamos como próximos
  const t = new Date(startAt).getTime();
  return Number.isNaN(t) ? true : t > Date.now();
}
