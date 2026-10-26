import { describe, it, expect } from "vitest";
import { vendorLabel, formatCurrencyCents, formatDateTimeBR } from "./vendor-format";

describe("vendorLabel", () => {
  it("inclui o documento formatado quando presente", () => {
    expect(vendorLabel({ name: "Acme", document: "44593429000105" })).toBe(
      "Acme (44.593.429/0001-05)",
    );
  });

  it("retorna apenas o nome quando não há documento", () => {
    expect(vendorLabel({ name: "Acme", document: null })).toBe("Acme");
  });
});

describe("formatCurrencyCents", () => {
  it("formata centavos em reais no locale pt-BR", () => {
    expect(formatCurrencyCents(123456)).toBe("R$ 1.234,56");
    expect(formatCurrencyCents(100)).toBe("R$ 1,00");
  });
});

describe("formatDateTimeBR", () => {
  it("formata ISO em dd/mm/aaaa hh:mm", () => {
    // Sem sufixo Z o ISO é interpretado no fuso local — evita dependência de TZ do runner.
    const formatted = formatDateTimeBR("2026-01-15T14:30:00");
    expect(formatted).toMatch(/^15\/01\/2026.*14:30$/);
  });
});
