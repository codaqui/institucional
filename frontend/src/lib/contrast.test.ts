import { describe, expect, it } from "vitest";
import { contrastRatio, wcagBadge } from "./contrast";

// Pares de contraste medidos no guia normativo do DS (docs/plans/codaqui-1-0/design-system.md)
// e nos comentários de frontend/src/styles/tokens.css.
describe("contrastRatio", () => {
  it.each([
    // [fg, bg, razão esperada]
    ["#378369", "#FFFFFF", 4.55], // primary-700 sobre branco — cor acionável AA
    ["#57B593", "#FFFFFF", 2.49], // verde de marca sobre branco — reprova AA
    ["#2C6753", "#FFFFFF", 6.62], // primary-800 — AAA texto normal
    ["#1C4538", "#FFFFFF", 10.73], // primary-900
    ["#696169", "#FFFFFF", 5.98], // neutral-600 — texto secundário AA
    ["#3A2F39", "#FFFFFF", 12.76], // ameixa da marca
    ["#2F6FED", "#FFFFFF", 4.55], // info (claro)
    ["#2C7A4B", "#FFFFFF", 5.26], // success (claro)
    ["#B45309", "#FFFFFF", 5.02], // warning (claro)
    ["#C0392B", "#FFFFFF", 5.44], // error (claro)
    // Foregrounds semânticos dark (Task 5 — tokens.css:183-186)
    ["#8FB3F9", "#1E2A45", 6.78], // info dark
    ["#5CB87A", "#16301F", 5.82], // success dark
    ["#E8963C", "#3A2410", 6.15], // warning dark
    ["#E8826F", "#3D1B17", 5.74], // error dark
  ])("%s sobre %s ≈ %s:1", (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 1);
  });

  it("é simétrica (fg/bg invertidos dão a mesma razão)", () => {
    expect(contrastRatio("#FFFFFF", "#378369")).toBeCloseTo(
      contrastRatio("#378369", "#FFFFFF"),
      6,
    );
  });

  it("branco sobre branco = 1:1; preto sobre branco = 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("aceita hex de 3 dígitos e sem '#'", () => {
    expect(contrastRatio("#FFF", "#000")).toBeCloseTo(21, 1);
    expect(contrastRatio("378369", "FFFFFF")).toBeCloseTo(4.55, 1);
  });
});

describe("wcagBadge", () => {
  it("classifica AAA (≥7), AA (≥4.5), AA-grande (≥3) e reprova (<3)", () => {
    expect(wcagBadge("#1C4538", "#FFFFFF")).toBe("AAA"); // 10.73
    expect(wcagBadge("#378369", "#FFFFFF")).toBe("AA"); // 4.55
    expect(wcagBadge("#499F81", "#FFFFFF")).toBe("AA 18pt+"); // ~3.2 (texto grande)
    expect(wcagBadge("#57B593", "#FFFFFF")).toBeNull(); // 2.49 — reprova
  });
});
