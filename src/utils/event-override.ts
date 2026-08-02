import type { EventDetailFile, EventItem } from "../data/events";

/**
 * Palestrante de um evento — campo disponível apenas via override
 * (organizador preenche manualmente).
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

/**
 * Campos sobrescrevíveis de um evento (`extendData` do override).
 * Campos que nunca são sobrescrevíveis: id, startAt, endAt, href,
 * source, sourceId, status.
 */
export interface EventExtendData {
  imageUrl?: string;
  summary?: string;
  location?: string;
  tags?: string[];
  featured?: boolean;
  title?: string;
  speakers?: EventSpeaker[];
  /** Link de inscrição externo (quando diferente de `href`). */
  registrationUrl?: string;
  /** Pós-evento: link para slides. */
  slidesUrl?: string;
  /** Pós-evento: gravação (YouTube, etc.). */
  videoUrl?: string;
  /** GitHub Discussion, fórum, etc. */
  discussionUrl?: string;
  /** Carga horária em minutos (0–1000) — alimenta certificados de eventos externos. */
  workloadMinutes?: number;
}

/**
 * Override de metadados de um evento persistido no banco.
 * O campo `payload` equivale ao antigo `extendData`.
 */
export interface EventOverride {
  sourceKey: string;
  eventId: string;
  payload: EventExtendData;
  ownerHandle: string;
  updatedAt: string;
  reason?: string | null;
}

/**
 * Metadados de override anexados ao evento pelo sync de snapshots.
 * Permite exibir o badge "Verificado por @handle" sem chamada extra.
 */
export interface EventOverrideMeta {
  ownerHandle: string;
  updatedAt: string;
  reason?: string | null;
}

/** Evento base mesclado com o override (quando existente). */
export type EventWithOverride = EventItem & EventExtendData & {
  _override?: EventOverrideMeta;
};

export function getEventOverridePath(
  source: string,
  sourceId: string,
  eventId: string
): string {
  return `/events/${source}/${sourceId}/${eventId}.override.json`;
}

/** URL da página de detalhe do evento (query params). */
export function getEventDetailPagePath(
  source: string,
  sourceId: string,
  eventId: string
): string {
  const params = new URLSearchParams({ source, sourceId, id: eventId });
  return `/eventos/detalhe?${params.toString()}`;
}

/** Mescla o evento base com o `payload` do override (quando presente). */
export function mergeEventWithOverride(
  base: EventItem,
  override: EventOverride | null
): EventWithOverride {
  return { ...base, ...override?.payload };
}

async function fetchJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function overrideMetaFromEvent(event: EventWithOverride): EventOverride | null {
  if (!event._override) return null;
  return {
    sourceKey: "",
    eventId: event.id,
    payload: {},
    ownerHandle: event._override.ownerHandle,
    updatedAt: event._override.updatedAt,
    reason: event._override.reason,
  };
}

/**
 * @deprecated Overrides agora são aplicados no snapshot pelo sync.
 * Mantido para compatibilidade — retorna null.
 */
export async function fetchEventOverride(): Promise<null> {
  return null;
}

async function fetchOverrideFromApi(
  source: string,
  sourceId: string,
  eventId: string,
  apiUrl?: string
): Promise<EventOverride | null> {
  try {
    const path = `/events/overrides/${encodeURIComponent(source + ":" + sourceId)}/${encodeURIComponent(eventId)}`;
    const res = await fetch(apiUrl ? `${apiUrl}${path}` : path);
    if (!res.ok) return null;
    const data = (await res.json()) as EventOverride;
    return data;
  } catch {
    return null;
  }
}

/**
 * Carrega o evento do snapshot e aplica o override mais recente.
 *
 * Estratégia:
 * 1. Lê o snapshot estático (fonte única de verdade para metadatos base).
 * 2. Se o snapshot já veio com override aplicado pelo sync (`_override`), usa ele.
 * 3. Caso contrário, consulta a API pública `/events/overrides/:sourceKey/:eventId`
 *    para refletir overrides criados após o último sync (experiência imediata
 *    sem esperar o próximo pipeline).
 */
export async function loadEventWithOverride(
  source: string,
  sourceId: string,
  eventId: string,
  apiUrl?: string
): Promise<{
  event: EventWithOverride;
  override: EventOverride | null;
  source: EventDetailFile["source"];
}> {
  const basePath = `/events/${source}/${sourceId}/${eventId}.json`;
  const base = await fetchJsonOrNull<EventDetailFile>(basePath);

  if (!base) throw new Error(`Evento não encontrado: ${eventId}`);

  const event = base.event as EventWithOverride;
  let override = overrideMetaFromEvent(event);

  if (!override) {
    override = await fetchOverrideFromApi(source, sourceId, eventId, apiUrl);
    if (override) {
      Object.assign(event, override.payload);
      event._override = {
        ownerHandle: override.ownerHandle,
        updatedAt: override.updatedAt,
        reason: override.reason,
      };
    }
  }

  return {
    event,
    override,
    source: base.source,
  };
}
