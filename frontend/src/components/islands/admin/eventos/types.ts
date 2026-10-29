/**
 * Tipos, constantes e helpers puros do hub de eventos (`/admin/eventos`).
 * Port de `src/pages/admin/eventos.tsx` (Docusaurus) — contratos do backend
 * (módulo events) mantidos 1:1.
 */

import type { EventSummary } from "../../../../lib/events";
import { parseBrlInput } from "../../../../lib/transaction";
import { fromDateTimeLocal } from "../../../../lib/datetime";
import { buildEventSlugPath } from "../../../../lib/event-path";
import { communities } from "../../../../data/communities";

// ── Tipos (contrato do backend — módulo events) ─────────────────────────────

export type EventStatus = "draft" | "published" | "canceled" | "completed";
export type TicketKind = "free" | "paid" | "community" | "company";
export type EventStaffRole = "host" | "checker" | "finance";

export interface TicketType {
  id: string;
  name: string;
  kind: TicketKind;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
  maxPerOrder: number;
  isActive: boolean;
}

export interface EventStaff {
  id: string;
  memberId: string;
  staffRole: EventStaffRole;
}

export interface ReconcileQuotaResultItem {
  ticketTypeId: string;
  name: string;
  before: number;
  after: number;
  adjusted: boolean;
}

export interface ReconcileQuotaResponse {
  eventId: string;
  results: ReconcileQuotaResultItem[];
}

export type ReconcileQuotaState = {
  eventId: string;
  severity: "success" | "error";
  lines: string[];
};

export interface ManagedEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string | null;
  imageUrl: string | null;
  location: string;
  startAt: string;
  endAt: string | null;
  timezone: string;
  communityProjectKey: string;
  status: EventStatus;
  capacity: number | null;
  workloadMinutes: number | null;
  ticketTypes: TicketType[];
  staff: EventStaff[];
}

export interface MemberOption {
  id: string;
  name: string;
  githubHandle: string;
}

// ── Hub: eventos externos, ownership e ativações ────────────────────────────

export interface ExternalActivationItem {
  id: string;
  eventKey: string;
  features: string[];
  communityProjectKey: string;
  title?: string;
}

export interface OwnershipEntry {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

export interface OrganizersStaticFile {
  version: number;
  ownerships: OwnershipEntry[];
}

/** Linha da lista unificada do hub (interno gerenciável ou externo do snapshot). */
export type HubRow =
  | {
      kind: "internal";
      key: string;
      title: string;
      startAt: string;
      hasOverride: boolean;
      canEdit: boolean;
      features: string[];
      event: ManagedEvent;
    }
  | {
      kind: "external";
      key: string;
      title: string;
      startAt: string;
      hasOverride: boolean;
      canEdit: boolean;
      features: string[];
      communityProjectKey?: string;
      ownerHandle?: string;
      event: EventSummary;
    };

export type SnapshotResult = { prUrl: string; prNumber: number | null } | "skipped";

// ── Constantes ───────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  canceled: "Cancelado",
  completed: "Concluído",
};

export const STATUS_COLOR: Record<
  EventStatus,
  "default" | "success" | "error" | "info"
> = {
  draft: "default",
  published: "success",
  canceled: "error",
  completed: "info",
};

export const KIND_LABEL: Record<TicketKind, string> = {
  free: "Gratuito",
  paid: "Pago",
  community: "Comunitário",
  company: "Empresa",
};

export const STAFF_ROLE_LABEL: Record<EventStaffRole, string> = {
  host: "Anfitrião",
  checker: "Credenciador",
  finance: "Financeiro",
};

export const FEATURE_LABEL: Record<string, string> = {
  checkin: "Check-in",
  certificates: "Certificados",
  payments: "Pagamentos",
};

export const PAGE_SIZE = 10;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TIMEZONE_OPTIONS: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Sao_Paulo"];

export const COMMUNITY_OPTIONS = [
  { id: "codaqui", name: "Codaqui (geral)" },
  ...communities.map((c) => ({ id: c.id, name: c.name })),
];

/** URL pública de detalhe de um evento próprio (fonte internal:codaqui). */
export const publicEventUrl = (slug: string): string => buildEventSlugPath(slug);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isValidDateTimeLocal(value: string): boolean {
  if (!value) return false;
  if (!DATETIME_LOCAL_REGEX.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

// ── Formulários ──────────────────────────────────────────────────────────────

export interface EventForm {
  slug: string;
  title: string;
  summary: string;
  description: string;
  imageUrl: string;
  location: string;
  startAt: string;
  endAt: string;
  timezone: string;
  communityProjectKey: string;
  capacity: string;
  workloadMinutes: string;
}

export const EMPTY_EVENT_FORM: EventForm = {
  slug: "",
  title: "",
  summary: "",
  description: "",
  imageUrl: "",
  location: "",
  startAt: "",
  endAt: "",
  timezone: "America/Sao_Paulo",
  communityProjectKey: "codaqui",
  capacity: "",
  workloadMinutes: "",
};

export interface TicketForm {
  name: string;
  kind: TicketKind;
  price: string;
  quantityTotal: string;
  salesStartAt: string;
  salesEndAt: string;
  maxPerOrder: string;
}

export const EMPTY_TICKET_FORM: TicketForm = {
  name: "",
  kind: "free",
  price: "",
  quantityTotal: "",
  salesStartAt: "",
  salesEndAt: "",
  maxPerOrder: "1",
};

export type EventDialogState =
  | { mode: "create" }
  | { mode: "edit"; event: ManagedEvent }
  | null;

export type TicketDialogState =
  | { event: ManagedEvent; mode: "create" }
  | { event: ManagedEvent; mode: "edit"; ticket: TicketType }
  | null;

// ── Validação de payloads ────────────────────────────────────────────────────

interface ValidationResult {
  error?: string;
  payload?: Record<string, unknown>;
}

/**
 * Campos opcionais de evento (fuso, capacidade, carga horária). Aplica no
 * `payload` e retorna mensagem de erro, ou null quando válido. A ORDEM das
 * validações é contrato (define qual erro aparece primeiro na UI).
 */
function applyOptionalEventFields(
  payload: Record<string, unknown>,
  form: EventForm,
  mode: "create" | "edit",
): string | null {
  const timezone = form.timezone.trim();
  if (timezone && !TIMEZONE_OPTIONS.includes(timezone)) {
    return "Fuso horário inválido (ex.: America/Sao_Paulo).";
  }
  if (timezone) payload.timezone = timezone;

  const capacityRaw = form.capacity.trim();
  if (capacityRaw) {
    const cap = Number.parseInt(capacityRaw, 10);
    if (Number.isNaN(cap) || cap <= 0) return "Capacidade inválida.";
    payload.capacity = cap;
  }

  const workloadRaw = form.workloadMinutes.trim();
  if (workloadRaw) {
    const minutes = Number.parseInt(workloadRaw, 10);
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 1000) {
      return "Carga horária inválida (0–1000 minutos).";
    }
    payload.workloadMinutes = minutes;
  } else if (mode === "edit") {
    // Vazio em edição = voltar ao cálculo automático (duração do evento).
    payload.workloadMinutes = null;
  }
  return null;
}

export function buildEventPayload(
  form: EventForm,
  mode: "create" | "edit",
): ValidationResult {
  if (mode === "create" && !form.slug.trim()) {
    return { error: "Preencha slug, título, resumo e local." };
  }
  if (!form.title.trim() || !form.summary.trim() || !form.location.trim()) {
    return { error: "Preencha título, resumo e local." };
  }
  if (!isValidDateTimeLocal(form.startAt)) {
    return {
      error: "Informe uma data/hora de início válida (incluindo horas e minutos).",
    };
  }
  const startIso = fromDateTimeLocal(form.startAt);
  if (!startIso) {
    return { error: "Data/hora de início inválida." };
  }
  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    summary: form.summary.trim(),
    location: form.location.trim(),
    startAt: startIso,
    communityProjectKey: form.communityProjectKey,
  };
  if (mode === "create") {
    const slug = form.slug.trim();
    if (!SLUG_REGEX.test(slug)) {
      return {
        error:
          "Slug inválido: use letras minúsculas, números e hífens (ex.: devpr-conf-2026).",
      };
    }
    payload.slug = slug;
  }
  if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();
  const description = form.description.trim();
  if (description) {
    payload.description = description;
  } else if (mode === "edit") {
    payload.description = "";
  }
  if (form.endAt && !isValidDateTimeLocal(form.endAt)) {
    return {
      error:
        "Data/hora de término inválida. Deixe em branco ou informe data e hora completas.",
    };
  }
  const endIso = fromDateTimeLocal(form.endAt);
  if (endIso) payload.endAt = endIso;
  const optionalError = applyOptionalEventFields(payload, form, mode);
  if (optionalError) return { error: optionalError };
  return { payload };
}

export function buildTicketPayload(
  form: TicketForm,
  mode: "create" | "edit",
): ValidationResult {
  if (!form.name.trim()) {
    return { error: "Informe o nome do tipo de ingresso." };
  }
  const quantityTotal = Number.parseInt(form.quantityTotal, 10);
  if (Number.isNaN(quantityTotal) || quantityTotal <= 0) {
    return { error: "Informe a quantidade total (maior que zero)." };
  }
  let priceCents = 0;
  if (form.price.trim()) {
    const price = parseBrlInput(form.price);
    if (price === null) {
      return { error: "Preço inválido." };
    }
    priceCents = Math.round(price * 100);
  }
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    priceCents,
    quantityTotal,
  };
  if (mode === "create") payload.kind = form.kind;
  const salesStart = fromDateTimeLocal(form.salesStartAt);
  if (salesStart) payload.salesStartAt = salesStart;
  const salesEnd = fromDateTimeLocal(form.salesEndAt);
  if (salesEnd) payload.salesEndAt = salesEnd;
  const maxPerOrder = Number.parseInt(form.maxPerOrder, 10);
  if (Number.isNaN(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 10) {
    return { error: "Máximo por pedido deve ser entre 1 e 10." };
  }
  payload.maxPerOrder = maxPerOrder;
  return { payload };
}

// ── Filtros do hub ───────────────────────────────────────────────────────────

export function matchesSearch(row: HubRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  return !q || row.title.toLowerCase().includes(q);
}

export function matchesKindFilter(
  row: HubRow,
  showInternos: boolean,
  showExternos: boolean,
): boolean {
  if (showInternos && !showExternos) return row.kind === "internal";
  if (showExternos && !showInternos) return row.kind === "external";
  return true;
}

export function matchesOverrideFilter(row: HubRow, onlyOverride: boolean): boolean {
  return !onlyOverride || row.hasOverride;
}

export function matchesEditableFilter(row: HubRow, onlyEditable: boolean): boolean {
  return !onlyEditable || row.canEdit;
}

export function matchesFeaturesFilter(row: HubRow, onlyFeatures: boolean): boolean {
  return !onlyFeatures || row.features.length > 0;
}

export function matchesCommunityFilter(row: HubRow, communityFilter: string): boolean {
  if (!communityFilter) return true;
  const rowCommunity =
    row.kind === "internal" ? row.event.communityProjectKey : row.communityProjectKey;
  return rowCommunity === communityFilter;
}
