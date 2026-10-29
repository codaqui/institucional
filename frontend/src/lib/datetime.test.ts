import { describe, it, expect } from "vitest";
import { toDateTimeLocal, fromDateTimeLocal } from "./datetime";

describe("toDateTimeLocal", () => {
  it("converte ISO para o formato de <input type=datetime-local>", () => {
    const out = toDateTimeLocal("2026-03-05T15:30:00.000Z");
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it("preserva data/hora no timezone local", () => {
    const out = toDateTimeLocal("2026-03-05T12:00:00");
    expect(out).toBe("2026-03-05T12:00");
  });
  it("retorna vazio para null/undefined/inválido", () => {
    expect(toDateTimeLocal(null)).toBe("");
    expect(toDateTimeLocal(undefined)).toBe("");
    expect(toDateTimeLocal("não-é-data")).toBe("");
  });
});

describe("fromDateTimeLocal", () => {
  it("converte de volta para ISO (round-trip)", () => {
    const iso = fromDateTimeLocal("2026-03-05T12:00");
    expect(iso).toMatch(/^2026-03-05T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  it("retorna undefined para vazio/inválido", () => {
    expect(fromDateTimeLocal("")).toBeUndefined();
    expect(fromDateTimeLocal("lixo")).toBeUndefined();
  });
});
