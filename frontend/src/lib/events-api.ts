/**
 * "Front API" de eventos: ponto único para carregar o índice estático de
 * eventos SEMPRE mesclado com os overrides de metadados.
 *
 * Port de `src/lib/events-api.ts` (Docusaurus) para a ilha Astro — roda no
 * cliente, então lê o snapshot via `fetch` e mescla os overrides públicos do
 * backend como fallback para refletir overrides criados entre dois syncs.
 */

import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSourceSummary,
  type EventSummary,
} from "./events";

/** Evento da listagem já mesclado com o payload do override (quando existe). */
export type MergedEventSummary = EventSummary & Record<string, unknown>;

export interface MergedEventsIndex {
  sources: EventSourceSummary[];
  events: MergedEventSummary[];
}

interface PublicOverride {
  sourceKey: string;
  eventId: string;
  ownerHandle: string;
  updatedAt: string;
  reason?: string | null;
  payload: Record<string, unknown>;
}

function makeEventKey(sourceKey: string, eventId: string): string {
  return `${sourceKey}::${eventId}`;
}

async function fetchPublicOverrides(apiUrl?: string): Promise<PublicOverride[]> {
  try {
    const path = "/events/overrides/public";
    const res = await fetch(apiUrl ? `${apiUrl}${path}` : path);
    if (!res.ok) return [];
    return (await res.json()) as PublicOverride[];
  } catch {
    return [];
  }
}

/**
 * Carrega `/events/index.json` e mescla overrides do backend que ainda não
 * estejam no snapshot. É o ponto único de leitura para garantir que todas as
 * páginas consumam a mesma fonte de verdade.
 */
export async function fetchEventsIndexMerged(
  apiUrl?: string,
): Promise<MergedEventsIndex> {
  const [indexRes, overrides] = await Promise.all([
    fetch(EVENTS_MANIFEST_URL),
    fetchPublicOverrides(apiUrl),
  ]);
  if (!indexRes.ok) {
    throw new Error("Events index unavailable");
  }
  const payload = (await indexRes.json()) as EventIndexFile;

  if (overrides.length === 0) {
    return {
      sources: payload.sources,
      events: payload.events as MergedEventSummary[],
    };
  }

  const overrideMap = new Map(
    overrides.map((o) => [makeEventKey(o.sourceKey, o.eventId), o]),
  );

  const events = (payload.events as MergedEventSummary[]).map((event) => {
    const key = makeEventKey(event.sourceKey, event.id);
    const override = overrideMap.get(key);
    if (!override) return event;
    return {
      ...event,
      ...override.payload,
      hasOverride: true,
      _override: {
        ownerHandle: override.ownerHandle,
        updatedAt: override.updatedAt,
        reason: override.reason ?? null,
      },
    };
  });

  return {
    sources: payload.sources,
    events,
  };
}
