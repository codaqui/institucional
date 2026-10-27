import { describe, expect, it } from "vitest";
import {
  DEVPARANA_DOC_SLUGS,
  devparanaDocsDir,
  loadDevparanaDocIndex,
  loadDevparanaRfcDocs,
} from "./community-devparana-docs";

describe("devparanaDocsDir", () => {
  it("resolve o diretório canônico dos docs no repo", () => {
    expect(devparanaDocsDir()).toMatch(/comunidades\/devparana\/docs$/);
  });
});

describe("loadDevparanaDocIndex", () => {
  it("extrai o título do frontmatter e renderiza o corpo markdown", async () => {
    const doc = await loadDevparanaDocIndex();
    expect(doc.title).toBe("Introdução");
    expect(doc.html).toContain("<h1");
    expect(doc.html).toContain("DevParaná");
    // Links internos preservados (no build tenant o _redirects resolve a rota limpa).
    expect(doc.html).toContain('href="/comunidades/devparana/rfcs"');
    // Frontmatter não vaza no HTML.
    expect(doc.html).not.toContain("sidebar_position");
  });
});

describe("loadDevparanaRfcDocs", () => {
  it("lista os dois RFCs com slugs de rota, ids e frontmatter normalizado", () => {
    const docs = loadDevparanaRfcDocs();
    expect(docs.map((d) => d.slug)).toEqual([
      "rfcs/projeto-embaixadores",
      "rfcs/devparana-na-estrada-2026",
    ]);
    // Os slugs derivados da fonte batem com as rotas previstas pela rota docs.
    expect(docs.map((d) => d.slug).sort()).toEqual(
      DEVPARANA_DOC_SLUGS.filter((s) => s !== "index")
        .slice()
        .sort(),
    );

    const [rfc001, rfc002] = docs;
    expect(rfc001.frontmatter).toMatchObject({
      rfcId: "001",
      title: "RFC 001 — Projeto Embaixadores",
      status: "Ready",
      writtenAt: "31 Out 2025",
      publishedAt: "10 Nov 2025",
    });
    expect(rfc001.frontmatter.authors).toEqual([
      { name: "Everton Tavares", email: "ivo@devpr.org" },
    ]);
    expect(rfc001.frontmatter.approvers?.length).toBe(6);
    expect(rfc001.frontmatter.timeline).toHaveLength(2);

    expect(rfc002.frontmatter).toMatchObject({
      rfcId: "002",
      status: "Ready",
    });
    expect(rfc002.editPath).toBe(
      "comunidades/devparana/docs/rfcs/002-devparana-na-estrada-2026.mdx",
    );
  });
});
