import { describe, it, expect } from "vitest";
import {
  buildEventPath,
  buildEventSlugPath,
  buildEventPublicPath,
  eventRouteParam,
  truncateEventSummary,
  buildEventJsonLd,
} from "./event-path";
import type { EventSummary } from "./events";

const external: EventSummary = {
  id: "ev:123",
  title: "Meetup DevPR",
  summary: "Encontro mensal",
  startAt: "2026-11-10T19:00:00-03:00",
  timezone: "America/Sao_Paulo",
  platform: "meetup",
  host: "DevParaná",
  location: "Curitiba",
  href: "https://meetup.com/x",
  tags: [],
  ctaLabel: "Inscrever-se",
  source: "meetup",
  sourceId: "devparana",
  sourceKey: "meetup:devparana",
  itemPath: "meetup/devparana/ev123.json",
};

const internal: EventSummary = {
  ...external,
  id: "uuid-1",
  slug: "devpr-conf-2026",
  source: "internal",
  sourceId: "codaqui",
  sourceKey: "internal:codaqui",
};

describe("event-path", () => {
  it("monta path de externo codificando segmentos", () => {
    expect(buildEventPath("meetup", "devparana", "ev:123")).toBe(
      "/eventos/meetup/devparana/ev%3A123",
    );
  });

  it("interno com slug usa /eventos/<slug>", () => {
    expect(buildEventSlugPath("devpr-conf-2026")).toBe("/eventos/devpr-conf-2026");
    expect(buildEventPublicPath(internal)).toBe("/eventos/devpr-conf-2026");
  });

  it("interno sem slug cai no formato externo (legado)", () => {
    const { slug, ...semSlug } = internal;
    expect(buildEventPublicPath(semSlug)).toBe(
      "/eventos/internal/codaqui/uuid-1",
    );
  });

  it("eventRouteParam remove o prefixo /eventos/ para o [...path]", () => {
    expect(eventRouteParam(internal)).toBe("devpr-conf-2026");
    expect(eventRouteParam(external)).toBe("meetup/devparana/ev%3A123");
  });

  it("truncateEventSummary corta em 160 chars com reticências", () => {
    const long = "a".repeat(200);
    expect(truncateEventSummary(long)).toHaveLength(160);
    expect(truncateEventSummary("curto")).toBe("curto");
  });

  it("buildEventJsonLd emite schema.org/Event com status mapeado", () => {
    const ld = buildEventJsonLd(
      { ...internal, status: "canceled" },
      "https://codaqui.dev/eventos/devpr-conf-2026",
    );
    expect(ld["@type"]).toBe("Event");
    expect(ld.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(ld.organizer.name).toBe("DevParaná");
  });
});
