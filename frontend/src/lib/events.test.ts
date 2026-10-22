import { describe, it, expect } from "vitest";
import {
  loadEventsIndex,
  partitionEvents,
  formatEventOrganizers,
  type EventSummary,
} from "./events";

describe("loadEventsIndex", () => {
  it("lê o snapshot real do monorepo (static/events/index.json)", () => {
    const index = loadEventsIndex();
    expect(Array.isArray(index.events)).toBe(true);
    expect(index.events.length).toBeGreaterThan(0);
    const first = index.events[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("source");
    expect(first).toHaveProperty("sourceKey");
    expect(first).toHaveProperty("startAt");
  });
});

function makeEvent(partial: Partial<EventSummary>): EventSummary {
  return {
    id: "e1",
    title: "Evento",
    summary: "Resumo",
    startAt: "2030-01-01T10:00:00-03:00",
    timezone: "America/Sao_Paulo",
    platform: "Discord",
    host: "Codaqui",
    location: "Online",
    href: "https://example.com",
    tags: [],
    ctaLabel: "Ver",
    source: "internal",
    sourceId: "codaqui",
    sourceKey: "internal:codaqui",
    itemPath: "/events/internal/codaqui/e1.json",
    ...partial,
  };
}

describe("partitionEvents", () => {
  const now = new Date("2026-10-22T12:00:00-03:00").getTime();

  it("separa futuros (ASC) de passados (DESC)", () => {
    const future1 = makeEvent({ id: "f1", startAt: "2026-11-01T10:00:00-03:00" });
    const future2 = makeEvent({ id: "f2", startAt: "2026-12-01T10:00:00-03:00" });
    const past1 = makeEvent({ id: "p1", startAt: "2026-10-01T10:00:00-03:00" });
    const past2 = makeEvent({ id: "p2", startAt: "2026-09-01T10:00:00-03:00" });
    const { upcoming, past } = partitionEvents(
      [future2, past1, future1, past2],
      now,
    );
    expect(upcoming.map((e) => e.id)).toEqual(["f1", "f2"]);
    expect(past.map((e) => e.id)).toEqual(["p1", "p2"]);
  });

  it("cancelados ficam sempre na agenda, mesmo com startAt passado", () => {
    const canceled = makeEvent({
      id: "c1",
      startAt: "2026-01-01T10:00:00-03:00",
      status: "canceled",
    });
    const { upcoming, past } = partitionEvents([canceled], now);
    expect(upcoming.map((e) => e.id)).toEqual(["c1"]);
    expect(past).toEqual([]);
  });

  it('"completed" vai pro histórico mesmo com startAt futuro', () => {
    const completed = makeEvent({
      id: "done1",
      startAt: "2027-01-01T10:00:00-03:00",
      status: "completed",
    });
    const { upcoming, past } = partitionEvents([completed], now);
    expect(upcoming).toEqual([]);
    expect(past.map((e) => e.id)).toEqual(["done1"]);
  });

  it("startAt inválido (NaN) fica na agenda — melhor visível do que sumido", () => {
    const broken = makeEvent({ id: "b1", startAt: "não-é-data" });
    const { upcoming, past } = partitionEvents([broken], now);
    expect(upcoming.map((e) => e.id)).toEqual(["b1"]);
    expect(past).toEqual([]);
  });

  it("featured: futuros ASC primeiro, depois passados DESC", () => {
    const ff = makeEvent({
      id: "ff",
      startAt: "2026-11-01T10:00:00-03:00",
      featured: true,
    });
    const fp = makeEvent({
      id: "fp",
      startAt: "2026-10-01T10:00:00-03:00",
      status: "completed",
      featured: true,
    });
    const normal = makeEvent({ id: "n1" });
    const { featured } = partitionEvents([fp, normal, ff], now);
    expect(featured.map((e) => e.id)).toEqual(["ff", "fp"]);
  });
});

describe("formatEventOrganizers", () => {
  it("sem organizers, usa o host", () => {
    expect(formatEventOrganizers(makeEvent({}))).toBe("Codaqui");
  });

  it("um organizer usa só o nome; vários usam vírgula + 'e'", () => {
    expect(
      formatEventOrganizers(
        makeEvent({ organizers: [{ name: "Ana" }] }),
      ),
    ).toBe("Ana");
    expect(
      formatEventOrganizers(
        makeEvent({
          organizers: [{ name: "Ana" }, { name: "Bia" }, { name: "Caio" }],
        }),
      ),
    ).toBe("Ana, Bia e Caio");
  });
});
