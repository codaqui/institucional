import { describe, expect, it } from "vitest";
import { shouldApplySourceFilter } from "./event-source-filter";

describe("shouldApplySourceFilter", () => {
  it("aplica filtro com sourceKey válido", () => {
    expect(
      shouldApplySourceFilter(
        new URLSearchParams("source=meetup:devparana"),
        new Set(["meetup:devparana"]),
      ),
    ).toBe(true);
  });

  it("sem query: não filtra", () => {
    expect(shouldApplySourceFilter(new URLSearchParams(), new Set())).toBe(false);
  });

  it("sourceKey desconhecido: não filtra (fallback = todos)", () => {
    expect(
      shouldApplySourceFilter(new URLSearchParams("source=inexistente"), new Set()),
    ).toBe(false);
  });

  it("sourceKey vazio: não filtra", () => {
    expect(
      shouldApplySourceFilter(new URLSearchParams("source="), new Set(["a"])),
    ).toBe(false);
  });
});
