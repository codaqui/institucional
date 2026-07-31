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
 * Os overrides agora são aplicados diretamente nos snapshots pelo sync
 * (scripts/sync-events.mjs), consumindo GET /events/overrides/public do
 * backend. Portanto, /events/index.json já chega com os metadados
 * estendidos e a flag hasOverride preenchida — nenhum fetch extra é
 * necessário no frontend.
 */

/** Evento da listagem já mesclado com o extendData do override (quando existe). */
export type MergedEventSummary = EventSummary &
  EventExtendData & { _override?: EventOverrideMeta };

export interface MergedEventsIndex {
  sources: EventSourceSummary[];
  events: MergedEventSummary[];
}

/**
 * Carrega `/events/index.json`. Os overrides já estão mesclados no snapshot
 * pelo sync; esta função é o ponto único de leitura para garantir que todas
 * as páginas consumam a mesma fonte de verdade.
 */
export async function fetchEventsIndexMerged(): Promise<MergedEventsIndex> {
  const indexRes = await fetch(EVENTS_MANIFEST_URL);
  if (!indexRes.ok) {
    throw new Error("Events index unavailable");
  }
  const payload = (await indexRes.json()) as EventIndexFile;
  return {
    sources: payload.sources,
    events: payload.events as MergedEventSummary[],
  };
}
