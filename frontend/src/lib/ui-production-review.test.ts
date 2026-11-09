import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

describe("revisão de produção — Giscus, header e tema", () => {
  it("hidrata os comentários do blog e das assembleias no carregamento", () => {
    const blog = readSource("layouts/BlogPostLayout.astro");
    const assembly = readSource("pages/assembleias/[slug].astro");

    expect(blog).toContain("<GiscusIsland client:load />");
    expect(assembly).toContain("<GiscusIsland client:load config={commentsConfig} />");
  });

  it("usa uma lupa acessível e remove Buscar/API dos links diretos", () => {
    const header = readSource("components/astro/SiteHeader.astro");

    expect(header).toContain('aria-label="Buscar"');
    expect(header).toContain('aria-hidden="true"');
    expect(header).not.toContain('label: "Buscar"');
    expect(header).not.toContain('label: "API"');
  });

  it("descobre a documentação pública da API pela transparência", () => {
    const transparency = readSource("components/islands/TransparencyApp.tsx");

    expect(transparency).toContain('href="/desenvolvedores/api"');
    expect(transparency).not.toContain("${apiUrl}/docs");
  });

  it("declara os dois esquemas de cor antes do paint", () => {
    const layout = readSource("layouts/BaseLayout.astro");
    const tokens = readSource("styles/tokens.css");

    expect(layout).toContain('<meta name="color-scheme" content="light dark" />');
    expect(tokens).toMatch(/:root\s*{[^}]*color-scheme:\s*light;/s);
    expect(tokens).toMatch(/\[data-theme="dark"\]\s*{[^}]*color-scheme:\s*dark;/s);
  });
});
