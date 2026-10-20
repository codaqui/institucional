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
}

export interface EventSummary extends EventItem {
  source: string;
  sourceId: string;
  sourceKey: string;
  itemPath: string;
  /** Indica que o sync aplicou override de metadados (tabela event_overrides do backend) a este evento. */
  hasOverride?: boolean;
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
