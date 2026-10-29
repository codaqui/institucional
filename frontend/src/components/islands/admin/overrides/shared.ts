/**
 * Tipos e helpers compartilhados entre as três abas da ilha
 * `/admin/overrides` (port de `src/pages/admin/overrides.tsx`).
 */
import type { EventSummary } from "../../../../lib/events";

export type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface Ownership {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

export interface OrganizersFile {
  version: number;
  ownerships: Ownership[];
}

export interface Member {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string;
  roles?: string[];
}

export interface ExternalActivation {
  id: string;
  eventKey: string;
  features: string[];
  communityProjectKey: string;
  /** Título usado em certificados (eventos externos podem ter título ruim no snapshot). */
  title?: string;
  /** Data/hora de início do evento (copiada do snapshot para certificados/relatórios). */
  startAt?: string | null;
}

export interface ExternalParticipant {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string;
  status: string;
  checkedInAt: string | null;
  ticketType: { name: string | null } | null;
}

export interface ImportReport {
  imported: number;
  matched: number;
  healed?: number;
  unmatched: { line: number; email: string }[];
  skippedDuplicates: number;
  errors: { line: number; reason: string }[];
}

/**
 * Props comuns das abas. `apiUrl` não faz parte do contrato: o `authFetch` da
 * `useAuth` já prefixa `API_URL` (passar paths relativos), e o `API_URL` em
 * fetchs públicos vem de `lib/config`. A exceção é a `ActivationTab`, que
 * recebe `apiUrl` à parte só para os dialogs de pedidos/reembolso.
 */
export interface TabCommonProps {
  readonly authFetch: AuthFetch;
  readonly events: EventSummary[];
  readonly sourceLabel: (sourceKey: string) => string;
  /** Evento pré-selecionado via query string (?sourceKey=&eventId=) — aplicado uma vez. */
  readonly initialSelected?: EventSummary | null;
  readonly canReimburse?: boolean;
}

export type { EventSourceSummary, EventSummary } from "../../../../lib/events";

export const formatEventDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Path do endpoint de override de um evento (authFetch prefixa a API). */
export const overrideApiUrl = (sourceKey: string, eventId: string): string =>
  `/events/overrides/${encodeURIComponent(sourceKey)}/${encodeURIComponent(eventId)}`;

/** Path da base de endpoints de evento externo (authFetch prefixa a API). */
export const externalApiUrl = (eventKey: string): string =>
  `/events/external/${encodeURIComponent(eventKey)}`;
