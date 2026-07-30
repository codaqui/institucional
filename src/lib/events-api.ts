import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSourceSummary,
  type EventSummary,
} from "../data/events";
import {
  fetchEventOverride,
  type EventExtendData,
} from "../utils/event-override";

/**
 * "Front API" de eventos: ponto único para carregar o índice estático de
 * eventos SEMPRE mesclado com os overrides de metadados.
 *
 * Estratégia:
 * 1. Tenta o manifesto agregado `/events/overrides-index.json` (gerado junto
 *    com os snapshots) — um único fetch extra, sempre atualizado.
 * 2. Fallback defensivo: se o manifesto não existir (404/erro), usa o
 *    comportamento legado — flag `hasOverride` do index.json + fetch
 *    individual de cada `<eventId>.override.json`.
 */

/** URL do manifesto agregado de overrides (estático, gerado pelo sync). */
export const OVERRIDES_INDEX_URL = "/events/overrides-index.json";

/** Entrada de override no manifesto agregado. */
export interface OverridesIndexEntry {
  extendData: EventExtendData;
  ownerHandle?: string;
  updatedAt?: string;
}

/** Shape do manifesto agregado `/events/overrides-index.json`. */
export interface OverridesIndexFile {
  version: number;
  updatedAt: string;
  overrides: Record<string, OverridesIndexEntry>;
}

/** Evento da listagem já mesclado com o extendData do override (quando existe). */
export type MergedEventSummary = EventSummary &
  EventExtendData & { override?: OverridesIndexEntry };

export interface MergedEventsIndex {
  sources: EventSourceSummary[];
  events: MergedEventSummary[];
}

/** Chave do override no manifesto: `<sourceKey>:<eventId>`. */
export function overrideIndexKey(event: Pick<EventSummary, "sourceKey" | "id">): string {
  return `${event.sourceKey}:${event.id}`;
}

/**
 * Mescla os eventos do índice com as entradas do manifesto de overrides.
 * Eventos com override ganham `hasOverride: true` e o campo `override`.
 * Puro — exportado para testes.
 */
export function mergeEventsWithOverridesIndex(
  events: EventSummary[],
  overrides: Record<string, OverridesIndexEntry>
): MergedEventSummary[] {
  return events.map((event) => {
    const entry = overrides[overrideIndexKey(event)];
    if (!entry?.extendData) return event;
    return { ...event, ...entry.extendData, hasOverride: true, override: entry };
  });
}

async function fetchOverridesIndex(): Promise<OverridesIndexFile | null> {
  try {
    const res = await fetch(OVERRIDES_INDEX_URL);
    if (!res.ok) return null; // 404 = manifesto ainda não gerado
    const data = (await res.json()) as OverridesIndexFile;
    return data?.overrides ? data : null;
  } catch {
    return null;
  }
}

/**
 * Fallback legado: usa a flag `hasOverride` do index.json e busca cada
 * `<eventId>.override.json` individualmente.
 */
async function mergeViaIndividualFetches(
  events: EventSummary[]
): Promise<MergedEventSummary[]> {
  return Promise.all(
    events.map(async (event) => {
      if (!event.hasOverride) return event;
      const override = await fetchEventOverride(event.source, event.sourceId, event.id);
      if (!override) return event;
      return {
        ...event,
        ...override.extendData,
        hasOverride: true,
        override: {
          extendData: override.extendData,
          ownerHandle: override.ownerHandle,
          updatedAt: override.updatedAt,
        },
      };
    })
  );
}

/**
 * Carrega `/events/index.json` + overrides mesclados.
 * Lança erro apenas se o índice principal estiver indisponível.
 */
export async function fetchEventsIndexMerged(): Promise<MergedEventsIndex> {
  const indexRes = await fetch(EVENTS_MANIFEST_URL);
  if (!indexRes.ok) {
    throw new Error("Events index unavailable");
  }
  const payload = (await indexRes.json()) as EventIndexFile;

  const manifesto = await fetchOverridesIndex();
  if (manifesto) {
    return {
      sources: payload.sources,
      events: mergeEventsWithOverridesIndex(payload.events, manifesto.overrides),
    };
  }

  return {
    sources: payload.sources,
    events: await mergeViaIndividualFetches(payload.events),
  };
}
