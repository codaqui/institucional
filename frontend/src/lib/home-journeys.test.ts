import { describe, expect, it } from "vitest";
import type { EventSummary } from "./events";
import { getCommunityHomeHref, selectUpcomingHomeActivities } from "./home-journeys";

const NOW = new Date("2026-12-01T12:00:00.000Z");

function event(overrides: Partial<EventSummary>): EventSummary {
  return {
    id: "event-1",
    title: "Evento",
    summary: "Resumo",
    startAt: "2026-12-02T12:00:00.000Z",
    timezone: "America/Sao_Paulo",
    platform: "meetup",
    host: "Comunidade",
    location: "Maringá",
    href: "https://example.com/event",
    tags: [],
    ctaLabel: "Detalhes",
    status: "scheduled",
    source: "meetup",
    sourceId: "community",
    sourceKey: "meetup:community",
    itemPath: "event.json",
    ...overrides,
  };
}

describe("selectUpcomingHomeActivities", () => {
  it("returns the next three valid activities in chronological order", () => {
    const activities = selectUpcomingHomeActivities([
      event({ id: "fourth", startAt: "2026-12-05T12:00:00.000Z" }),
      event({ id: "past", startAt: "2026-11-30T12:00:00.000Z" }),
      event({ id: "third", startAt: "2026-12-04T12:00:00.000Z" }),
      event({ id: "invalid", startAt: "not-a-date" }),
      event({ id: "cancelled", startAt: "2026-12-02T12:00:00.000Z", status: "canceled" }),
      event({ id: "completed", startAt: "2026-12-02T12:00:00.000Z", status: "completed" }),
      event({ id: "second", startAt: "2026-12-03T12:00:00.000Z" }),
      event({ id: "first", startAt: "2026-12-02T12:00:00.000Z" }),
    ], NOW);

    expect(activities.map((activity) => activity.href)).toEqual([
      "/eventos/meetup/community/first",
      "/eventos/meetup/community/second",
      "/eventos/meetup/community/third",
    ]);
  });

  it("uses the internal slug and respects the requested limit", () => {
    const activities = selectUpcomingHomeActivities([
      event({
        id: "internal-id",
        slug: "encontro-codaqui",
        source: "internal",
        sourceId: "codaqui",
        startAt: "2026-12-02T12:00:00.000Z",
      }),
      event({ id: "external id", startAt: "2026-12-03T12:00:00.000Z" }),
    ], NOW, 2);

    expect(activities.map((activity) => activity.href)).toEqual([
      "/eventos/encontro-codaqui",
      "/eventos/meetup/community/external%20id",
    ]);
  });

  it("maps only public display fields and returns an empty list when none qualify", () => {
    expect(selectUpcomingHomeActivities([
      event({
        title: "Encontro real",
        summary: "Resumo real",
        location: "Online",
        imageUrl: "https://example.com/image.jpg",
        startAt: "2026-12-02T12:00:00.000Z",
      }),
    ], NOW)).toEqual([{
      title: "Encontro real",
      summary: "Resumo real",
      startAt: "2026-12-02T12:00:00.000Z",
      location: "Online",
      href: "/eventos/meetup/community/event-1",
      imageUrl: "https://example.com/image.jpg",
    }]);

    expect(selectUpcomingHomeActivities([
      event({ startAt: "2026-11-01T12:00:00.000Z" }),
    ], NOW)).toEqual([]);
  });
});

describe("getCommunityHomeHref", () => {
  it("uses the primary public link when available", () => {
    expect(getCommunityHomeHref({
      slug: "devparana",
      links: [{ type: "website", label: "Site", url: "https://devparana.com" }],
    })).toBe("https://devparana.com");
  });

  it("falls back to the portal community page instead of an empty link", () => {
    expect(getCommunityHomeHref({ slug: "coda qui", links: [] }))
      .toBe("/comunidades/coda%20qui");
  });
});
