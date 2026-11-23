import { describe, expect, it } from "vitest";
import { DONATION_TARGETS, TESOURO } from "./donation-targets";

describe("donation targets", () => {
  it("offers treasury and real communities to both donation flows", () => {
    expect(TESOURO.id).toBe("tesouro-geral");
    expect(DONATION_TARGETS[0]).toEqual(TESOURO);
    expect(DONATION_TARGETS.some((target) => target.id === "devparana")).toBe(true);
    expect(DONATION_TARGETS.every((target) => target.name.length > 0)).toBe(true);
  });
});
