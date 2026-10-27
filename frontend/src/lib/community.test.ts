import { describe, expect, it } from "vitest";
import {
  communityBasePath,
  loadTenantConfig,
  tenantCssVars,
  tenantNav,
} from "./community";

describe("loadTenantConfig", () => {
  it("resolve o config da T.I. Social (slug, cores e features)", async () => {
    const config = await loadTenantConfig("tisocial");
    expect(config.slug).toBe("tisocial");
    expect(config.theme.primary).toBe("#8DC044");
    expect(config.features.donations).toBe(true);
    expect(config.basePath).toBe("/comunidades/tisocial");
  });

  it("resolve os configs de elasnocodigo e devparana", async () => {
    const elas = await loadTenantConfig("elasnocodigo");
    expect(elas.slug).toBe("elasnocodigo");
    expect(elas.theme.primary).toBe("#9c27b0");

    const devpr = await loadTenantConfig("devparana");
    expect(devpr.slug).toBe("devparana");
    expect(devpr.features.transparency).toBe(true);
  });

  it("lança para tenant desconhecido", async () => {
    await expect(loadTenantConfig("nope")).rejects.toThrow(/desconhecido/);
  });
});

describe("tenantCssVars", () => {
  it("mapeia as 5 chaves do theme para CSS vars da comunidade", async () => {
    const config = await loadTenantConfig("tisocial");
    expect(tenantCssVars(config)).toEqual({
      "--community-primary": "#8DC044",
      "--community-primary-dark": "#424143",
      "--community-primary-light": "#a6d16a",
      "--community-accent": "#424143",
      "--community-footer-bg": "#424143",
    });
  });
});

describe("tenantNav", () => {
  it("achata itens com submenu para o link do primeiro `to`", async () => {
    const config = await loadTenantConfig("tisocial");
    expect(tenantNav(config)).toEqual([
      { label: "Início", to: "/comunidades/tisocial" },
      { label: "Sobre", to: "/comunidades/tisocial/docs" },
      { label: "Campanhas", to: "/comunidades/tisocial/blog" },
      { label: "Apoiar", to: "/comunidades/tisocial/apoiar" },
      { label: "Transparência", to: "/comunidades/tisocial/transparencia" },
    ]);
  });

  it("preserva itens sem submenu como estão", async () => {
    const config = await loadTenantConfig("devparana");
    const nav = tenantNav(config);
    expect(nav).toHaveLength(4);
    expect(nav[0]).toEqual({ label: "Início", to: "/comunidades/devparana" });
    expect(nav[1]).toEqual({
      label: "Sobre",
      to: "/comunidades/devparana/docs",
    });
  });
});

describe("communityBasePath", () => {
  it("retorna o basePath da config (/comunidades/<slug>)", async () => {
    const config = await loadTenantConfig("tisocial");
    expect(communityBasePath(config)).toBe("/comunidades/tisocial");
  });
});
