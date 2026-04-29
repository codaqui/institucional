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
  it("returns empty string for empty input", () => {
    expect(formatDocument("")).toBe("");
  });

  it("formats a full CPF (11 digits)", () => {
    expect(formatDocument("12345678909")).toBe("123.456.789-09");
  });

  it("strips non-digits before formatting CPF", () => {
    expect(formatDocument("123.456.789-09")).toBe("123.456.789-09");
  });

  it("formats partial CPF (up to 11 digits)", () => {
    expect(formatDocument("123456")).toBe("123.456");
  });

  it("formats a full CNPJ (14 digits)", () => {
    expect(formatDocument("44593429000105")).toBe("44.593.429/0001-05");
  });

  it("strips non-digits before formatting CNPJ", () => {
    expect(formatDocument("44.593.429/0001-05")).toBe("44.593.429/0001-05");
  });

  it("formats partial CNPJ (12 digits)", () => {
    expect(formatDocument("445934290001")).toBe("44.593.429/0001");
  });
});
