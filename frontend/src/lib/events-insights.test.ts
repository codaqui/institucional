import { describe, expect, it } from "vitest";
import type { EventSummary } from "./events";
import { summarizeEventInsights } from "./events-insights";

function event(overrides: Partial<EventSummary>): EventSummary {
  return {
    id: "event-1",
    title: "Evento",
    summary: "",
    startAt: "2026-01-10T12:00:00.000Z",
    timezone: "America/Sao_Paulo",
    platform: "meetup",
    host: "Codaqui",
    location: "Online",
    href: "https://example.test",
    tags: [],
    ctaLabel: "Participar",
    source: "meetup",
    sourceId: "source-1",
    sourceKey: "meetup:devparana",
    itemPath: "/eventos/1",
    status: "completed",
    ...overrides,
  };
}

describe("summarizeEventInsights", () => {
  it("counts completed events, valid signups and yearly/source breakdowns", () => {
    const result = summarizeEventInsights([
      event({ id: "2025", startAt: "2025-05-01T12:00:00.000Z", userCount: 10 }),
      event({ id: "2026-a", userCount: 20 }),
      event({ id: "2026-b", sourceKey: "discord:codaqui", userCount: 5 }),
      event({ id: "invalid-signup", userCount: -4 }),
      event({ id: "scheduled", status: "scheduled", userCount: 100 }),
      event({ id: "canceled", status: "canceled", userCount: 100 }),
    ]);

    expect(result).toEqual({
      published: 6,
      completed: 4,
      attendeeSignups: 35,
      completedByYear: { 2025: 1, 2026: 3 },
      completedBySource: { "meetup:devparana": 3, "discord:codaqui": 1 },
    });
  });

  it("ignores non-finite signup counts", () => {
    expect(summarizeEventInsights([
      event({ userCount: Number.POSITIVE_INFINITY }),
      event({ userCount: 2.5 }),
    ]).attendeeSignups).toBe(2.5);
  });
});
