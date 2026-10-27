// Teste do script pós-build que gera dist/_redirects em builds de tenant
// (Cloudflare Pages): o site da comunidade vive em rotas limpas (/apoiar…),
// mas os configs das comunidades apontam links para /comunidades/<slug>/…
// (basePath do portal). As duas regras 301 devolvem esses paths para a raiz.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildRedirectsText,
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
  });

  it("rejeita TENANT desconhecido", () => {
    const dist = makeDist();
    expect(() =>
      writeTenantRedirects({ tenant: "inexistente", distDir: dist }),
    ).toThrow(/TENANT desconhecido/);
  });
});
