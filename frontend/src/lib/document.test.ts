import { describe, it, expect } from "vitest";
import { formatDocument, stripToDigits } from "./document";

describe("formatDocument", () => {
  it("formata CPF de 11 dígitos", () => {
    expect(formatDocument("12345678909")).toBe("123.456.789-09");
  });
  it("formata CNPJ de 14 dígitos", () => {
    expect(formatDocument("44593429000105")).toBe("44.593.429/0001-05");
  });
  it("formata entrada parcialmente mascarada (sanitiza antes)", () => {
    expect(formatDocument("123.456.789-09")).toBe("123.456.789-09");
    expect(formatDocument("44.593.429/0001-05")).toBe("44.593.429/0001-05");
  });
  it("formata progressivamente entradas parciais", () => {
    expect(formatDocument("123")).toBe("123");
    expect(formatDocument("1234")).toBe("123.4");
    expect(formatDocument("12345678")).toBe("123.456.78");
  });
  it("retorna vazio para entrada sem dígitos", () => {
    expect(formatDocument("")).toBe("");
    expect(formatDocument("abc")).toBe("");
  });
});

describe("stripToDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(stripToDigits("44.593.429/0001-05")).toBe("44593429000105");
    expect(stripToDigits("")).toBe("");
  });
});
