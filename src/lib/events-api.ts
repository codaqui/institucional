import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSourceSummary,
  type EventSummary,
} from "../data/events";
import type { EventExtendData, EventOverrideMeta } from "../utils/event-override";

/**
 * "Front API" de eventos: ponto único para carregar o índice estático de
 * eventos SEMPRE mesclado com os overrides de metadados.
 *
 * Os overrides são aplicados nos snapshots pelo sync (scripts/sync-events.mjs),
 * consumindo GET /events/overrides/public do backend. Como fallback para
 * refletir overrides criados entre dois syncs, esta função também consulta a
 * API pública e mescla os overrides mais recentes no cliente.
 */

/** Evento da listagem já mesclado com o extendData do override (quando existe). */
export type MergedEventSummary = EventSummary &
  EventExtendData & { _override?: EventOverrideMeta };

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
  payload: EventExtendData;
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

function applyOverrideToEvent(
  event: MergedEventSummary,
  override: PublicOverride
): MergedEventSummary {
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
}

/**
 * Carrega `/events/index.json` e mescla overrides do backend que ainda não
 * estejam no snapshot. É o ponto único de leitura para garantir que todas as
 * páginas consumam a mesma fonte de verdade.
 */
export async function fetchEventsIndexMerged(apiUrl?: string): Promise<MergedEventsIndex> {
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
    overrides.map((o) => [makeEventKey(o.sourceKey, o.eventId), o])
  );

  const events = (payload.events as MergedEventSummary[]).map((event) => {
    const key = makeEventKey(event.sourceKey, event.id);
    const override = overrideMap.get(key);
    if (!override) return event;
    return applyOverrideToEvent(event, override);
  });

  return {
    sources: payload.sources,
    events,
  };
}
