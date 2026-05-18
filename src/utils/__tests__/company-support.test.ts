import {
  formatSupportCountLabel,
  formatSupportCurrency,
} from "../company-support";

describe("company-support utils", () => {
  it("formats total supported in BRL without decimal digits", () => {
    expect(formatSupportCurrency(500)).toBe("R$ 500");
  });

  it("formats support count label with pluralization", () => {
    expect(formatSupportCountLabel(1)).toBe("1 apoio");
    expect(formatSupportCountLabel(3)).toBe("3 apoios");
  });
});
