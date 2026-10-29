import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MEMBERS_PAGE_SIZE,
  PAGE_WINDOW_SIZE,
  pageWindow,
  rangeLabel,
} from "./pagination";

describe("pagination constants (SET padronizado)", () => {
  it("expõe os tamanhos de página da API", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(DEFAULT_PAGE_SIZE).toBe(50);
    expect(MEMBERS_PAGE_SIZE).toBe(100);
    expect(PAGE_WINDOW_SIZE).toBe(5);
  });
});

describe("pageWindow", () => {
  it("retorna páginas 1..N quando totalPages <= window", () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(3, 5, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("centraliza a janela na página atual", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageWindow(8, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it("mantém a janela completa nas bordas (sem páginas fora do range)", () => {
    const cases: Array<[number, number, number[]]> = [
      [2, 10, [1, 2, 3, 4, 5]],
      [9, 10, [6, 7, 8, 9, 10]],
      [1, 3, [1, 2, 3]],
      [7, 7, [3, 4, 5, 6, 7]],
    ];
    for (const [current, total, expected] of cases) {
      expect(pageWindow(current, total)).toEqual(expected);
      for (const p of pageWindow(current, total)) {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(total);
      }
    }
  });

  it("clampa current fora do range", () => {
    expect(pageWindow(0, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(99, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it("retorna [] quando não há páginas", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("respeita windowSize customizado", () => {
    expect(pageWindow(5, 20, 3)).toEqual([4, 5, 6]);
    expect(pageWindow(1, 20, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("rangeLabel", () => {
  it("monta o intervalo da página corrente", () => {
    expect(rangeLabel(1, 100, 350)).toBe("Mostrando 1–100 de 350");
    expect(rangeLabel(2, 100, 350)).toBe("Mostrando 101–200 de 350");
    expect(rangeLabel(3, 100, 350)).toBe("Mostrando 201–300 de 350");
    expect(rangeLabel(4, 100, 350)).toBe("Mostrando 301–350 de 350");
  });

  it("encerra o intervalo no total na última página", () => {
    expect(rangeLabel(4, 100, 350)).toBe("Mostrando 301–350 de 350");
    expect(rangeLabel(2, 50, 60)).toBe("Mostrando 51–60 de 60");
  });

  it("retorna mensagem de vazio quando total = 0", () => {
    expect(rangeLabel(1, 100, 0)).toBe("Nenhum resultado");
  });

  it("clampa page fora do range", () => {
    expect(rangeLabel(9, 100, 350)).toBe("Mostrando 301–350 de 350");
    expect(rangeLabel(0, 100, 350)).toBe("Mostrando 1–100 de 350");
  });
});
