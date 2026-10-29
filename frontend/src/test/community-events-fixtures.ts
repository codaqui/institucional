import { describe, expect, it } from "vitest";
import type { EventSummary } from "../lib/events";

/** Campos de exibição específicos por comunidade — o restante do eventFixture é idêntico. */
export interface CommunityEventDisplay {
  platform: EventSummary["platform"];
  host: string;
  location: string;
  href: string;
  ctaLabel: string;
}

export const CAMPOSTECH_EVENT_DISPLAY: CommunityEventDisplay = {
  platform: "sympla",
  host: "CamposTech",
  location: "Ponta Grossa",
  href: "https://www.sympla.com.br/produtor/camposvalley",
  ctaLabel: "Ver na Sympla",
};

export const DEVPARANA_EVENT_DISPLAY: CommunityEventDisplay = {
  platform: "meetup",
  host: "DevParaná",
  location: "Maringá",
  href: "https://www.meetup.com/pt-BR/developerparana/",
  ctaLabel: "Ver no Meetup",
};

export type CommunityEventFixtureFn = (
  id: string,
  sourceKey: string,
  startAt: string,
  status?: EventSummary["status"],
) => EventSummary;

/** Scaffolding idêntico entre os testes das libs de comunidade. */
export function makeCommunityEventFixture(
  display: CommunityEventDisplay,
  id: string,
  sourceKey: string,
  startAt: string,
  status: EventSummary["status"] = "scheduled",
): EventSummary {
  return {
    id,
    source: sourceKey.split(":")[0],
    sourceId: sourceKey.split(":")[1] ?? "",
    sourceKey,
    itemPath: `x/${id}.json`,
    title: `Evento ${id}`,
    summary: "",
    startAt,
    timezone: "America/Sao_Paulo",
    ...display,
    tags: [],
    status,
  };
}

type UpcomingFn = (
  events: EventSummary[],
  sourceKeys: string[],
  limit?: number,
) => EventSummary[];

/**
 * Bloco upcomingCommunityEvents idêntico em community-campostechpg/devparana —
 * ambas as libs re-exportam a mesma implementação de `./community-events`.
 * `otherSourceKey` é o sourceKey "distrator" (evento fora do filtro).
 */
export function describeUpcomingCommunityEvents(
  upcoming: UpcomingFn,
  eventFixture: CommunityEventFixtureFn,
  sourceKey: string,
  otherSourceKey: string,
) {
  describe("upcomingCommunityEvents", () => {
    const events: EventSummary[] = [
      eventFixture("a", sourceKey, "2030-01-10T18:00:00Z"),
      eventFixture("b", sourceKey, "2030-01-05T18:00:00Z", "completed"),
      eventFixture("c", sourceKey, "2030-01-02T18:00:00Z"),
      eventFixture("d", otherSourceKey, "2030-01-01T18:00:00Z"),
      eventFixture("e", sourceKey, "2030-01-08T18:00:00Z", "active"),
    ];

    it("filtra por sourceKey, exclui completed, ordena ASC e limita", () => {
      const result = upcoming(events, [sourceKey]);
      expect(result.map((e) => e.id)).toEqual(["c", "e", "a"]);
    });

    it("respeita o limite customizado", () => {
      const result = upcoming(events, [sourceKey], 2);
      expect(result.map((e) => e.id)).toEqual(["c", "e"]);
    });

    it("retorna vazio sem sourceKeys", () => {
      expect(upcoming(events, [])).toEqual([]);
    });
  });
}

/** Bloco formatFullEventDate idêntico em community-campostechpg/devparana. */
export function describeFormatFullEventDate(
  formatFullEventDate: (date: string, timeZone: string) => string,
) {
  describe("formatFullEventDate", () => {
    it("formata em pt-BR com data completa e hora curta no timezone do evento", () => {
      const formatted = formatFullEventDate("2030-06-15T18:30:00Z", "America/Sao_Paulo");
      expect(formatted).toContain("15 de junho de 2030");
      expect(formatted).toMatch(/15:30/);
    });
  });
}
