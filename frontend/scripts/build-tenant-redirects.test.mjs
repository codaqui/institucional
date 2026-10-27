// Teste do script pós-build de tenants (Cloudflare Pages): gera dist/_redirects
// (301 de /comunidades/<slug>/* para as rotas limpas) e dist/robots.txt
// (Sitemap apontando para o domínio próprio do tenant — o public/robots.txt
// compartilhado aponta para o sitemap da Codaqui, errado nos whitelabels).
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildRedirectsText,
  buildRobotsText,
  writeTenantRedirects,
} from "./build-tenant-redirects.mjs";

/** @type {string[]} */
const fixtures = [];

function makeDist() {
  const dir = mkdtempSync(join(tmpdir(), "tenant-redirects-"));
  fixtures.push(dir);
  mkdirSync(join(dir, "dist"), { recursive: true });
  return join(dir, "dist");
}

afterEach(() => {
  while (fixtures.length) rmSync(fixtures.pop(), { recursive: true, force: true });
});

describe("buildRedirectsText", () => {
  it("emite as duas regras 301 do slug da comunidade", () => {
    expect(buildRedirectsText("tisocial")).toBe(
      "/comunidades/tisocial / 301\n" +
        "/comunidades/tisocial/* /:splat 301\n",
    );
  });
});

describe("buildRobotsText", () => {
  it("aponta o Sitemap para o domínio próprio do tenant", () => {
    expect(buildRobotsText("https://devparana.org")).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://devparana.org/sitemap-index.xml\n",
    );
  });
});

describe("writeTenantRedirects", () => {
  it("com TENANT=tisocial escreve dist/_redirects com as 2 linhas corretas", () => {
    const dist = makeDist();
    const wrote = writeTenantRedirects({ tenant: "tisocial", distDir: dist });
    expect(wrote).toBe(true);
    const file = join(dist, "_redirects");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(
      "/comunidades/tisocial / 301\n" +
        "/comunidades/tisocial/* /:splat 301\n",
    );
  });

  it("com TENANT escreve também dist/robots.txt com o Sitemap do tenant", () => {
    const dist = makeDist();
    writeTenantRedirects({ tenant: "tisocial", distDir: dist });
    const robots = join(dist, "robots.txt");
    expect(existsSync(robots)).toBe(true);
    expect(readFileSync(robots, "utf8")).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://tisocial.org.br/sitemap-index.xml\n",
    );
  });

  it("robots.txt do devparana usa o site do tenants.config", () => {
    const dist = makeDist();
    writeTenantRedirects({ tenant: "devparana", distDir: dist });
    expect(readFileSync(join(dist, "robots.txt"), "utf8")).toContain(
      "Sitemap: https://devparana.org/sitemap-index.xml",
    );
  });

  it("resolve o slug pelo tenants.config (community do tenant)", () => {
    const dist = makeDist();
    writeTenantRedirects({ tenant: "devparana", distDir: dist });
    expect(readFileSync(join(dist, "_redirects"), "utf8")).toContain(
      "/comunidades/devparana / 301",
    );
  });

  it("sem TENANT não escreve nada", () => {
    const dist = makeDist();
    const wrote = writeTenantRedirects({ tenant: null, distDir: dist });
    expect(wrote).toBe(false);
    expect(existsSync(join(dist, "_redirects"))).toBe(false);
    expect(existsSync(join(dist, "robots.txt"))).toBe(false);
  });

  it("rejeita TENANT desconhecido", () => {
    const dist = makeDist();
    expect(() =>
      writeTenantRedirects({ tenant: "inexistente", distDir: dist }),
    ).toThrow(/TENANT desconhecido/);
  });
});
