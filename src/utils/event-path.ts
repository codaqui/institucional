import type { EventItem, EventStatus } from "../data/events";

/**
 * Path estático de um evento externo (ou interno legado sem slug):
 * `/eventos/<source>/<sourceId>/<id>`. Cada segmento é codificado
 * individualmente (encodeURIComponent), pois ids de fontes externas podem
 * conter caracteres especiais (ex.: slug com ":").
 */
export function buildEventPath(
  source: string,
  sourceId: string,
  eventId: string
): string {
  return `/eventos/${encodeURIComponent(source)}/${encodeURIComponent(sourceId)}/${encodeURIComponent(eventId)}`;
}

/** Path estático de um evento interno identificado pela slug (`/eventos/<slug>`). */
export function buildEventSlugPath(slug: string): string {
  return `/eventos/${encodeURIComponent(slug)}`;
}

/**
 * Path público canônico de um evento: internos com slug usam
 * `/eventos/<slug>`; demais (externos e internos legados sem slug) usam
 * `/eventos/<source>/<sourceId>/<id>`.
 */
export function buildEventPublicPath(event: {
  source?: string;
  sourceId?: string;
  id: string;
  slug?: string | null;
}): string {
  const source = event.source ?? "internal";
  if (source === "internal" && event.slug) {
    return buildEventSlugPath(event.slug);
  }
  return buildEventPath(source, event.sourceId ?? "codaqui", event.id);
}

const DEFAULT_OG_IMAGE = "/img/og-codaqui.jpg";

/**
 * Resolve a imagem OG de um evento para URL absoluta.
 * URLs externas são usadas como estão; caminhos relativos (`/img/...`) são
 * prefixados com a URL do site; na ausência de imagem, cai no card padrão.
 */
export function resolveEventImageUrl(
  imageUrl: string | undefined,
  siteUrl: string
): string {
  if (!imageUrl) return `${siteUrl}${DEFAULT_OG_IMAGE}`;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${siteUrl}${path}`;
}

/** Trunca o summary para uso em meta description (~160 chars). */
export function truncateEventSummary(summary: string, maxLength = 160): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

const EVENT_STATUS_SCHEMA: Record<EventStatus, string> = {
  scheduled: "EventScheduled",
  active: "EventScheduled",
  completed: "EventCompleted",
  canceled: "EventCancelled",
};

export interface EventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  eventStatus: string;
  location: { "@type": "Place"; name: string };
  organizer: { "@type": "Organization"; name: string };
  image?: string;
  url: string;
}

/** Monta o JSON-LD (schema.org/Event) da página estática de detalhe. */
export function buildEventJsonLd(
  event: EventItem,
  absoluteUrl: string
): EventJsonLd {
  const origin = new URL(absoluteUrl).origin;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: truncateEventSummary(event.summary ?? ""),
    startDate: event.startAt,
    ...(event.endAt ? { endDate: event.endAt } : {}),
    eventStatus: `https://schema.org/${
      EVENT_STATUS_SCHEMA[event.status ?? "scheduled"]
    }`,
    location: { "@type": "Place", name: event.location },
    organizer: { "@type": "Organization", name: event.host },
    ...(event.imageUrl
      ? { image: resolveEventImageUrl(event.imageUrl, origin) }
      : {}),
    url: absoluteUrl,
  };
}
