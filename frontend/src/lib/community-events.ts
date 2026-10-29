import type { EventSummary } from "./events";

/**
 * Helpers de eventos compartilhados pelas páginas das comunidades parceiras
 * (wrappers do portal e builds tenant). Antes duplicados byte-idênticos em
 * `community-devparana.ts` e `community-campostechpg.ts` (ambos derivados 1:1
 * das páginas-fonte Docusaurus) — as duas libs re-exportam daqui.
 */

// ── Próximos eventos (home das comunidades) ────────────────────────────────

/**
 * Próximos eventos da comunidade: mesma derivação do `UpcomingEventsSection`
 * original — filtra por `sourceKeys` e `status !== "completed"`, ordena ASC
 * por `startAt` e limita (default 3, como o slice do original).
 */
export function upcomingCommunityEvents(
  events: EventSummary[],
  sourceKeys: string[],
  limit = 3,
): EventSummary[] {
  if (sourceKeys.length === 0) return [];
  return events
    .filter(
      (event) =>
        sourceKeys.includes(event.sourceKey) && event.status !== "completed",
    )
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .slice(0, limit);
}

/** Formata a data do card de evento (Intl pt-BR `dateStyle: "full"`, `timeStyle: "short"` no timezone do evento). */
export function formatFullEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}
