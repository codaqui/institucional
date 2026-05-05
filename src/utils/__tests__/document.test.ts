import { formatDocument, stripToDigits } from "../document";

describe("stripToDigits", () => {
  it("keeps digits unchanged", () => {
    expect(stripToDigits("12345")).toBe("12345");
  });

  it("removes dots, dashes and slashes", () => {
    expect(stripToDigits("123.456.789-09")).toBe("12345678909");
  });

  it("removes all non-digit characters", () => {
    expect(stripToDigits("abc")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(stripToDigits("")).toBe("");
  });
});

describe("formatDocument", () => {
  it.each([
    ["returns empty string for empty input", "", ""],
    ["formats a full CPF (11 digits)", "12345678909", "123.456.789-09"],
    ["strips non-digits before formatting CPF", "123.456.789-09", "123.456.789-09"],
    ["formats partial CPF (up to 11 digits)", "123456", "123.456"],
    ["formats a full CNPJ (14 digits)", "44593429000105", "44.593.429/0001-05"],
    ["strips non-digits before formatting CNPJ", "44.593.429/0001-05", "44.593.429/0001-05"],
    ["formats partial CNPJ (12 digits)", "445934290001", "44.593.429/0001"],
  ])("%s", (_label, input, expected) => {
    expect(formatDocument(input)).toBe(expected);
  });
});
