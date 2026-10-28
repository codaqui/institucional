// Teste do script pós-build (Cloudflare Pages): em builds TENANT=<slug> gera
// dist/_redirects (301 de /comunidades/<slug>/* para as rotas limpas) +
// dist/robots.txt (Sitemap do domínio próprio — o public/robots.txt
// compartilhado aponta para o sitemap da Codaqui, errado nos whitelabels);
// no build codaqui (sem TENANT) gera dist/_redirects com os redirects legados
// do Docusaurus (Fase 0.6) e não toca no robots.txt.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCodaquiRedirectsText,
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

describe("buildCodaquiRedirectsText", () => {
  it("emite exatamente as 16 linhas dos redirects legados", () => {
    expect(buildCodaquiRedirectsText()).toBe(
      "/quero/estudar /participe/estudar 301\n" +
        "/quero/apoiar /participe/apoiar 301\n" +
        "/quero/mentoria /participe/mentoria 301\n" +
        "/team /sobre/equipe 301\n" +
        "/contact /contato 301\n" +
        "/conduta /sobre/conduta 301\n" +
        "/ong /sobre/ong 301\n" +
        "/timeline /sobre/insights 301\n" +
        "/sobre/timeline /sobre/insights 301\n" +
        "/pais_responsaveis /sobre/pais-responsaveis 301\n" +
        "/admin/transferencias /admin/lancamento?tab=transferencias 302\n" +
        "/blog/archive /blog 301\n" +
        "/blog/archive/2022 /blog 301\n" +
        "/blog/archive/2023 /blog 301\n" +
        "/blog/archive/2024 /blog 301\n" +
        "/blog/archive/2025 /blog 301\n",
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

  it("sem TENANT escreve dist/_redirects com as 16 linhas dos redirects legados", () => {
    const dist = makeDist();
    const wrote = writeTenantRedirects({ tenant: null, distDir: dist });
    expect(wrote).toBe(true);
    expect(readFileSync(join(dist, "_redirects"), "utf8")).toBe(
      "/quero/estudar /participe/estudar 301\n" +
        "/quero/apoiar /participe/apoiar 301\n" +
        "/quero/mentoria /participe/mentoria 301\n" +
        "/team /sobre/equipe 301\n" +
        "/contact /contato 301\n" +
        "/conduta /sobre/conduta 301\n" +
        "/ong /sobre/ong 301\n" +
        "/timeline /sobre/insights 301\n" +
        "/sobre/timeline /sobre/insights 301\n" +
        "/pais_responsaveis /sobre/pais-responsaveis 301\n" +
        "/admin/transferencias /admin/lancamento?tab=transferencias 302\n" +
        "/blog/archive /blog 301\n" +
        "/blog/archive/2022 /blog 301\n" +
        "/blog/archive/2023 /blog 301\n" +
        "/blog/archive/2024 /blog 301\n" +
        "/blog/archive/2025 /blog 301\n",
    );
  });

  it("sem TENANT não escreve dist/robots.txt (usa o public/ compartilhado)", () => {
    const dist = makeDist();
    writeTenantRedirects({ tenant: null, distDir: dist });
    expect(existsSync(join(dist, "_redirects"))).toBe(true);
    expect(existsSync(join(dist, "robots.txt"))).toBe(false);
  });

  it("sem TENANT com string vazia tem o mesmo comportamento", () => {
    const dist = makeDist();
    const wrote = writeTenantRedirects({ tenant: "", distDir: dist });
    expect(wrote).toBe(true);
    expect(readFileSync(join(dist, "_redirects"), "utf8")).toContain(
      "/team /sobre/equipe 301",
    );
  });

  it("com dist ausente retorna false sem escrever nada", () => {
    const dir = mkdtempSync(join(tmpdir(), "tenant-redirects-"));
    fixtures.push(dir);
    const missing = join(dir, "dist");
    expect(writeTenantRedirects({ tenant: "tisocial", distDir: missing })).toBe(false);
    expect(writeTenantRedirects({ tenant: null, distDir: missing })).toBe(false);
    expect(existsSync(join(missing, "_redirects"))).toBe(false);
  });

  it("rejeita TENANT desconhecido", () => {
    const dist = makeDist();
    expect(() =>
      writeTenantRedirects({ tenant: "inexistente", distDir: dist }),
    ).toThrow(/TENANT desconhecido/);
  });
});
