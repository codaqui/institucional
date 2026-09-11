import type { EventDetailFile, EventItem, EventSourceConfig } from "../data/events";
import { buildEventPublicPath } from "./event-path";

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

/**
 * URL da página pública do evento (rota estática por evento).
 * Internos com slug usam `/eventos/<slug>`; demais usam
 * `/eventos/<source>/<sourceId>/<id>`.
 */
export function getEventDetailPagePath(event: {
  source?: string;
  sourceId?: string;
  id: string;
  slug?: string | null;
}): string {
  return buildEventPublicPath(event);
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

/** Config da fonte interna — espelha o source montado pelo backend em getPublicManagedEvents. */
const INTERNAL_SOURCE_CONFIG: EventSourceConfig = {
  source: "internal",
  sourceId: "codaqui",
  type: "internal",
  label: "Codaqui",
  emoji: "🌱",
  description: "Eventos organizados pela Associação Codaqui.",
  ctaLabel: "Ver eventos",
  ctaHref: "/eventos",
};

/** Shape de `event` em GET /events/public/managed/:id (serializeEvent do backend). */
interface PublicManagedEventPayload {
  id: string;
  slug?: string | null;
  title: string;
  summary: string;
  imageUrl?: string | null;
  location?: string | null;
  startAt: string;
  endAt?: string | null;
  timezone?: string | null;
  status?: string;
}

/**
 * Fallback ao vivo para eventos internos: quando o snapshot estático ainda não
 * existe (sync horário não rodou após a publicação), busca o evento publicado
 * direto na API pública e mapeia para o shape EventItem — mesma montagem do
 * backend (`toEventItem` em events.service.ts).
 */
async function fetchInternalEventFromApi(
  eventId: string,
  apiUrl?: string
): Promise<EventDetailFile | null> {
  try {
    const path = `/events/public/managed/${encodeURIComponent(eventId)}`;
    const res = await fetch(apiUrl ? `${apiUrl}${path}` : path);
    if (!res.ok) return null;
    const data = (await res.json()) as { event: PublicManagedEventPayload };
    const raw = data.event;
    const startAt = new Date(raw.startAt);
    const endAt = raw.endAt ? new Date(raw.endAt) : null;
    const now = new Date();
    // Mesma regra de deriveItemStatus do backend (events.service.ts).
    const status: EventItem["status"] =
      raw.status === "canceled"
        ? "canceled"
        : endAt && now > endAt
          ? "completed"
          : now < startAt
            ? "scheduled"
            : "active";
    return {
      source: INTERNAL_SOURCE_CONFIG,
      event: {
        id: raw.id,
        ...(raw.slug ? { slug: raw.slug } : {}),
        title: raw.title,
        summary: raw.summary ?? "",
        startAt: startAt.toISOString(),
        ...(endAt && { endAt: endAt.toISOString() }),
        timezone: raw.timezone ?? "",
        platform: "Site Codaqui",
        host: "Codaqui",
        location: raw.location ?? "",
        href: getEventDetailPagePath({
          source: "internal",
          sourceId: "codaqui",
          id: raw.id,
          slug: raw.slug ?? null,
        }),
        tags: [],
        ctaLabel: "Inscrever-se",
        status,
        ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
      },
    };
  } catch {
    return null;
  }
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
 * 1. Lê o snapshot estático (fonte única de verdade para metadados base).
 *    Evento interno sem snapshot faz fallback para a API pública do backend
 *    (`/events/public/managed/:id`), cobrindo o período entre a publicação e
 *    o próximo sync horário.
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
  let base = await fetchJsonOrNull<EventDetailFile>(basePath);

  // Fallback ao vivo: evento interno recém-publicado ainda pode não ter
  // snapshot (o sync horário grava o JSON depois). Fontes externas mantêm
  // o comportamento atual (erro) — sem fallback.
  if (!base && source === "internal") {
    base = await fetchInternalEventFromApi(eventId, apiUrl);
  }

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
