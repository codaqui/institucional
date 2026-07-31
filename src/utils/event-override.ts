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
 * Override de metadados de um evento, versionado em
 * `static/events/<source>/<sourceId>/<eventId>.override.json`.
 */
export interface EventOverride {
  eventId: string;
  sourceKey: string;
  extendData: EventExtendData;
  ownerId?: string;
  ownerHandle: string;
  updatedAt: string;
  reason?: string;
}

/** Evento base mesclado com o override (quando existente). */
export type EventWithOverride = EventItem & EventExtendData;

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

/** Mescla o evento base com o `extendData` do override (quando presente). */
export function mergeEventWithOverride(
  base: EventItem,
  override: EventOverride | null
): EventWithOverride {
  return { ...base, ...override?.extendData };
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

/** Busca apenas o override de um evento (404/ausente = null). */
export async function fetchEventOverride(
  source: string,
  sourceId: string,
  eventId: string
): Promise<EventOverride | null> {
  return fetchJsonOrNull<EventOverride>(
    getEventOverridePath(source, sourceId, eventId)
  );
}

/**
 * Carrega o evento base + override em paralelo e retorna o evento mesclado.
 * Override ausente (404) é tratado como `null`. Lança erro se o evento base
 * não existir.
 */
export async function loadEventWithOverride(
  source: string,
  sourceId: string,
  eventId: string
): Promise<{
  event: EventWithOverride;
  override: EventOverride | null;
  source: EventDetailFile["source"];
}> {
  const basePath = `/events/${source}/${sourceId}/${eventId}.json`;

  const [base, override] = await Promise.all([
    fetchJsonOrNull<EventDetailFile>(basePath),
    fetchEventOverride(source, sourceId, eventId),
  ]);

  if (!base) throw new Error(`Evento não encontrado: ${eventId}`);

  return {
    event: mergeEventWithOverride(base.event, override),
    override,
    source: base.source,
  };
}
