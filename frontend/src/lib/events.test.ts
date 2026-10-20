import { describe, it, expect } from "vitest";
import { loadEventsIndex } from "./events";

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
