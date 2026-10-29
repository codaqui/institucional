import { describe, it, expect } from "vitest";
import { loadEventsIndex } from "./events";
import { eventRouteParam } from "./event-path";

describe("rotas de eventos (snapshot real)", () => {
  it("gera um param único por evento", () => {
    const { events } = loadEventsIndex();
    const params = events.map((e) => eventRouteParam(e));
    expect(new Set(params).size).toBe(params.length);
  });

  it("todo param é não-vazio e sem espaços", () => {
    const { events } = loadEventsIndex();
    for (const e of events) {
      const p = eventRouteParam(e);
      expect(p.length).toBeGreaterThan(0);
      expect(p).not.toMatch(/\s/);
    }
  });
});
