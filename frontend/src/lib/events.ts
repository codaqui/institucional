export type EventSourceType = "discord" | "meetup" | "ocgroups" | "doity" | "internal" | "external";
export type EventStatus = "scheduled" | "active" | "completed" | "canceled";
export type EventEntityType = "stage_instance" | "voice" | "external";

export interface EventRecurrenceRule {
  start?: string;
  end?: string;
  frequency?: number;
  interval?: number;
  byWeekday?: number[];
  byMonth?: number[];
  byMonthDay?: number[];
  count?: number;
}

export interface EventSourceConfig {
  source: string;
  sourceId: string;
  type: EventSourceType;
  label: string;
  emoji: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  widgetUrl?: string;
  refreshStrategy?: string;
  generatedAt?: string;
}

export interface EventOrganizer {
  name: string;
  id?: string;
  photoUrl?: string;
}

/**
 * Palestrante de um evento — campo disponível apenas via override
 * (organizador preenche manualmente; portado de src/utils/event-override.ts).
 */
export interface EventSpeaker {
  name: string;
  /** GitHub handle (sem @). */
  handle?: string;
  avatarUrl?: string;
  talkTitle?: string;
  /** GitHub, LinkedIn, site pessoal, etc. */
  profileUrl?: string;
}

export interface EventItem {
  id: string;
  /** Slug pública (kebab-case) — presente em eventos internos; base da URL `/eventos/<slug>`. */
  slug?: string;
  title: string;
  summary: string;
  /** Descrição longa opcional; presente em eventos internos que a preencham. */
  description?: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  platform: string;
  host: string;
  location: string;
  href: string;
  tags: string[];
  ctaLabel: string;
  featured?: boolean;
  status?: EventStatus;
  entityType?: EventEntityType;
  userCount?: number;
  /** @deprecated Use `organizers` instead. Kept for backward compatibility with existing snapshots. */
  creatorName?: string;
  /** @deprecated Use `organizers` instead. Kept for backward compatibility with existing snapshots. */
  creatorId?: string;
  organizers?: EventOrganizer[];
  channelId?: string;
  recurrenceLabel?: string;
  recurrenceRule?: EventRecurrenceRule;
  imageUrl?: string;
  /** Palestrantes (só presente quando um override os define — já mesclado no snapshot). */
  speakers?: EventSpeaker[];
}

/**
 * Metadados de override anexados ao evento pelo sync de snapshots.
 * Permite exibir o badge "Verificado por @handle" sem chamada extra
 * (portado de src/utils/event-override.ts).
 */
export interface EventOverrideMeta {
  ownerHandle: string;
  updatedAt: string;
  reason?: string | null;
}

export interface EventSummary extends EventItem {
  source: string;
  sourceId: string;
  sourceKey: string;
  itemPath: string;
  /** Indica que o sync aplicou override de metadados (tabela event_overrides do backend) a este evento. */
  hasOverride?: boolean;
  /** Metadados do override aplicado (presente quando hasOverride). */
  _override?: EventOverrideMeta;
}

export interface EventSourceSummary extends EventSourceConfig {
  sourceKey: string;
  indexPath: string;
  itemCount: number;
}

export interface EventIndexFile {
  generatedAt?: string;
  sources: EventSourceSummary[];
  events: EventSummary[];
}

export interface EventDetailFile {
  generatedAt?: string;
  source: EventSourceConfig;
  event: EventItem;
}

export const EVENTS_MANIFEST_URL = "/events/index.json";

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Caminhos candidatos do snapshot agregado do monorepo
 * (repo/static/events/index.json). Em runtime de teste/dev o módulo roda a
 * partir da fonte (`frontend/src/lib/`); no build do Astro o bundle SSR é
 * emitido sob `dist/` e `import.meta.url` muda de profundidade, então o
 * cwd (sempre `frontend/` nos scripts npm, ou a raiz do repo) é o fallback.
 */
function snapshotCandidates(): string[] {
  return [
    fileURLToPath(new URL("../../../static/events/index.json", import.meta.url)),
    resolve(process.cwd(), "..", "static", "events", "index.json"),
    resolve(process.cwd(), "static", "events", "index.json"),
  ];
}

/**
 * Lê o snapshot agregado do monorepo em build time.
 * Caminho: frontend/src/lib/events.ts → repo/static/events/index.json.
 */
export function loadEventsIndex(): EventIndexFile {
  const path = snapshotCandidates().find((p) => existsSync(p));
  if (!path) {
    throw new Error(
      `Snapshot de eventos não encontrado. Tentados: ${snapshotCandidates().join(", ")}`,
    );
  }
  return JSON.parse(readFileSync(path, "utf-8")) as EventIndexFile;
}

/** Formata organizadores para exibição ("A, B e C"); sem organizers, usa o host. */
export function formatEventOrganizers(event: {
  host: string;
  organizers?: EventOrganizer[];
}): string {
  const orgs = event.organizers;
  if (!orgs?.length) return event.host;
  if (orgs.length === 1) return orgs[0].name;
  return `${orgs
    .slice(0, -1)
    .map((o) => o.name)
    .join(", ")} e ${orgs.at(-1)?.name ?? ""}`;
}

export interface EventPartitions {
  /** Futuros (e cancelados), ASC por startAt. */
  upcoming: EventSummary[];
  /** Passados ("completed" ou startAt no passado, exceto cancelados), DESC. */
  past: EventSummary[];
  /** Destaques: futuros ASC primeiro, depois passados DESC. */
  featured: EventSummary[];
}

/**
 * Reparte a listagem replicando src/pages/eventos.tsx (Docusaurus):
 * - upcoming: exclui "completed"; cancelados ficam sempre na agenda; evento
 *   com startAt passado vai pro histórico mesmo sem status "completed"
 *   (defesa contra sync atrasado); startAt inválido (NaN) fica na agenda.
 * - past: "completed" ou startAt passado; cancelados nunca.
 * - featured: featured=true, futuros (não "completed") ASC antes dos passados DESC.
 */
export function partitionEvents(
  events: EventSummary[],
  now = Date.now(),
): EventPartitions {
  const upcoming = events
    .filter((event) => {
      if (event.status === "completed") return false;
      if (event.status === "canceled") return true;
      const start = new Date(event.startAt).getTime();
      return Number.isNaN(start) || start >= now;
    })
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

  const past = events
    .filter((event) => {
      if (event.status === "completed") return true;
      if (event.status === "canceled") return false;
      const start = new Date(event.startAt).getTime();
      return !Number.isNaN(start) && start < now;
    })
    .sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );

  const featured = events
    .filter((event) => event.featured)
    .sort((a, b) => {
      const aPast = a.status === "completed" ? 1 : 0;
      const bPast = b.status === "completed" ? 1 : 0;
      if (aPast !== bPast) return aPast - bPast;
      const diff =
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return aPast === 0 ? diff : -diff;
    });

  return { upcoming, past, featured };
}
