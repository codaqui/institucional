import { describe, expect, it } from "vitest";
import { isExcludedFromSitemap } from "../src/lib/sitemap-filter.mjs";

describe("isExcludedFromSitemap", () => {
  it.each([
    "/404",
    "/busca",
    "/descadastro",
    "/eventos/detalhe",
    "/eventos/comprovante",
    "/eventos/convite",
    "/quero/apoiar",
    "/blog/archive/2024/post",
    "/admin",
    "/admin/horas",
    "/auth/callback",
    "/membro",
    "/membro/horas",
    "/membros/empresa",
    "/membros/empresa/editar",
    "/team",
    "/contact",
    "/conduta",
    "/ong",
    "/timeline",
    "/sobre/timeline",
    "/pais_responsaveis",
  ])("excludes %s", (pathname) => {
    expect(isExcludedFromSitemap(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/eventos",
    "/eventos/meetup/devparana/123",
    "/blog/archive",
    "/administrativo",
    "/autores",
    "/membros",
    "/membros/perfil",
    "/sobre/conduta",
  ])("keeps %s", (pathname) => {
    expect(isExcludedFromSitemap(pathname)).toBe(false);
  });
});
