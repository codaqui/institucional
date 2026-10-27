// Teste do gate de allow-list por tenant: em builds TENANT=<slug> (Cloudflare
// Pages) as rotas canônicas do site whitelabel precisam existir em dist/.
// Fixture com rootDir fake (src/content + src-tenants) + dist fake — espelha
// o padrão de build-tenant-redirects.test.mjs.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkTenantUrls, requiredUrls } from "./tenant-urls.mjs";

/** @type {string[]} */
const fixtures = [];

function makeRoot() {
  const dir = mkdtempSync(join(tmpdir(), "tenant-urls-"));
  fixtures.push(dir);
  return dir;
}

/** Cria um rootDir fake: blog/docs de tisocial + pages do tenant. */
function makeTisocialRoot() {
  const root = makeRoot();
  const blogDir = join(root, "src", "content", "community-blog", "tisocial");
  mkdirSync(blogDir, { recursive: true });
  writeFileSync(
    join(blogDir, "2025-04-15-pascoa.md"),
    "---\nslug: pascoa-2025\ntitle: Páscoa\n---\n\nconteúdo\n",
  );
  writeFileSync(
    join(blogDir, "2026-03-15-pascoa.md"),
    "---\nslug: pascoa-2026\ntitle: Páscoa 2026\n---\n\nconteúdo\n",
  );
  // Sem slug no frontmatter — não entra na allow-list.
  writeFileSync(join(blogDir, "2025-01-01-rascunho.md"), "---\ntitle: Sem slug\n---\n\n");
  // Não-.md (authors.yml) é ignorado.
  writeFileSync(join(blogDir, "authors.yml"), "tisocial:\n  name: T.I. Social\n");
  const docsDir = join(root, "src", "content", "community-docs", "tisocial");
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(join(root, "src-tenants", "tisocial", "pages", "blog", "tags"), {
    recursive: true,
  });
  mkdirSync(join(root, "src-tenants", "tisocial", "pages", "docs"), { recursive: true });
  return root;
}

/** Cria um dist fake com as URLs dadas ("/" → dist/index.html). */
function makeDist(root, urls) {
  const dist = join(root, "dist");
  for (const url of urls) {
    const file =
      url === "/"
        ? join(dist, "index.html")
        : join(dist, `${url.slice(1)}/index.html`);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "<html></html>");
  }
  return dist;
}

afterEach(() => {
  while (fixtures.length) rmSync(fixtures.pop(), { recursive: true, force: true });
});

describe("requiredUrls", () => {
  it("base: /, /apoiar, /transparencia, /equipe para qualquer tenant", () => {
    const root = makeRoot();
    expect(requiredUrls({ tenant: "devparana", rootDir: root })).toEqual([
      "/",
      "/apoiar",
      "/transparencia",
      "/equipe",
    ]);
  });

  it("com community-blog: /blog, slugs dos frontmatters e /blog/tags", () => {
    const root = makeTisocialRoot();
    expect(requiredUrls({ tenant: "tisocial", rootDir: root })).toEqual([
      "/",
      "/apoiar",
      "/transparencia",
      "/equipe",
      "/blog",
      "/blog/pascoa-2025",
      "/blog/pascoa-2026",
      "/blog/tags",
      "/docs",
    ]);
  });

  it("/blog/tags fica de fora quando o tenant não tem a rota de tags", () => {
    const root = makeRoot();
    const blogDir = join(root, "src", "content", "community-blog", "elasnocodigo");
    mkdirSync(blogDir, { recursive: true });
    writeFileSync(join(blogDir, "post.md"), "---\nslug: post\n---\n");
    const urls = requiredUrls({ tenant: "elasnocodigo", rootDir: root });
    expect(urls).toContain("/blog");
    expect(urls).toContain("/blog/post");
    expect(urls).not.toContain("/blog/tags");
    expect(urls).not.toContain("/docs");
  });

  it("/docs entra quando o tenant tem a rota docs nas pages", () => {
    const root = makeRoot();
    mkdirSync(join(root, "src-tenants", "devparana", "pages", "docs"), {
      recursive: true,
    });
    expect(requiredUrls({ tenant: "devparana", rootDir: root })).toContain("/docs");
  });

  it("rejeita tenant desconhecido", () => {
    expect(() => requiredUrls({ tenant: "inexistente", rootDir: makeRoot() })).toThrow(
      /Tenant desconhecido/,
    );
  });
});

describe("checkTenantUrls", () => {
  it("retorna missing vazio quando tudo existe no dist", () => {
    const root = makeTisocialRoot();
    const required = requiredUrls({ tenant: "tisocial", rootDir: root });
    const dist = makeDist(root, required);
    const result = checkTenantUrls({ distDir: dist, tenant: "tisocial", rootDir: root });
    expect(result.missing).toEqual([]);
    expect(result.present).toHaveLength(required.length);
  });

  it("lista as URLs faltantes sem duplicar as presentes", () => {
    const root = makeTisocialRoot();
    const dist = makeDist(root, ["/", "/apoiar", "/transparencia", "/equipe"]);
    const result = checkTenantUrls({ distDir: dist, tenant: "tisocial", rootDir: root });
    expect(result.missing).toEqual([
      "/blog",
      "/blog/pascoa-2025",
      "/blog/pascoa-2026",
      "/blog/tags",
      "/docs",
    ]);
    expect(result.present).toEqual(["/", "/apoiar", "/transparencia", "/equipe"]);
  });

  it("aceita o formato Docusaurus de página (<url>.html na raiz)", () => {
    const root = makeRoot();
    const dist = join(root, "dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "index.html"), "");
    writeFileSync(join(dist, "apoiar.html"), "");
    writeFileSync(join(dist, "transparencia.html"), "");
    writeFileSync(join(dist, "equipe.html"), "");
    const result = checkTenantUrls({ distDir: dist, tenant: "devparana", rootDir: root });
    expect(result.missing).toEqual([]);
  });

  it("falha quando o dist não existe", () => {
    const root = makeRoot();
    const result = checkTenantUrls({
      distDir: join(root, "dist"),
      tenant: "devparana",
      rootDir: root,
    });
    expect(result.distExists).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("só reporta distExists=false para dist de fato ausente", () => {
    const root = makeRoot();
    const dist = makeDist(root, ["/"]);
    expect(existsSync(dist)).toBe(true);
    const result = checkTenantUrls({ distDir: dist, tenant: "devparana", rootDir: root });
    expect(result.distExists).toBe(true);
  });
});
