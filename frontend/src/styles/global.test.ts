import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("./global.css", import.meta.url), "utf8");

describe("impressão de certificados", () => {
  it("restringe a página A4 ao certificado e remove navegação, backdrop e ações", () => {
    expect(globalCss).toMatch(/@media\s+print\s*\{/);
    expect(globalCss).toMatch(/@page\s*\{[^}]*size:\s*A4/s);
    expect(globalCss).toMatch(/@page\s*\{[^}]*margin:\s*12mm/s);
    expect(globalCss).toContain("body > *:not(.print-certificate)");
    expect(globalCss).toContain("body > .print-certificate");
    expect(globalCss).toContain(".certificate-print-area");
    expect(globalCss).toMatch(/\.print-certificate\s+\.no-print\s*\{[^}]*display:\s*none/s);
    expect(globalCss).toMatch(/\.certificate-print-area\s*\{[^}]*break-inside:\s*avoid/s);
    expect(globalCss).toMatch(/\.certificate-print-area\s*\{[^}]*print-color-adjust:\s*exact/s);
    expect(globalCss).not.toContain("!important");
  });
});
