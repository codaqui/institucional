import { describe, expect, it } from "vitest";
import {
  formatSupportCountLabel,
  formatSupportCurrency,
} from "./company-support";

describe("formatSupportCurrency", () => {
  it("formata reais sem casas decimais", () => {
    expect(formatSupportCurrency(1500)).toMatch(/1\.500/);
    expect(formatSupportCurrency(1500)).toMatch(/R\$/);
  });
});

describe("formatSupportCountLabel", () => {
  it("usa singular para 1 apoio", () => {
    expect(formatSupportCountLabel(1)).toBe("1 apoio");
  });

  it("usa plural para mais de 1", () => {
    expect(formatSupportCountLabel(5)).toBe("5 apoios");
    expect(formatSupportCountLabel(0)).toBe("0 apoios");
  });
});
