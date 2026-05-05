/**
 * Tests para resolveCommunityFromPath.
 *
 * Função pura que mapeia pathname → CommunitySiteConfig. Usada pelos
 * theme overrides (Navbar/Footer/BlogLayout) para detectar contexto
 * whitelabel.
 */

import { resolveCommunityFromPath } from "../community-context";

describe("resolveCommunityFromPath", () => {
  it("retorna null para pathname undefined", () => {
    expect(resolveCommunityFromPath(undefined)).toBeNull();
  });

  it("retorna null para pathname vazio", () => {
    expect(resolveCommunityFromPath("")).toBeNull();
  });

  it("retorna null para path fora de comunidade", () => {
    expect(resolveCommunityFromPath("/blog")).toBeNull();
    expect(resolveCommunityFromPath("/sobre/equipe")).toBeNull();
    expect(resolveCommunityFromPath("/")).toBeNull();
  });

  it("resolve match exato de basePath para tisocial", () => {
    const result = resolveCommunityFromPath("/comunidades/tisocial");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("tisocial");
  });

  it("resolve subpaths de uma comunidade", () => {
    expect(resolveCommunityFromPath("/comunidades/tisocial/apoiar")?.slug).toBe("tisocial");
    expect(resolveCommunityFromPath("/comunidades/tisocial/blog")?.slug).toBe("tisocial");
    expect(resolveCommunityFromPath("/comunidades/tisocial/blog/2026/03/26/x")?.slug).toBe("tisocial");
  });

  it("não confunde basePath substring com outra rota", () => {
    // path `/comunidades/tisocialx` não deve casar com basePath `/comunidades/tisocial`
    expect(resolveCommunityFromPath("/comunidades/tisocialx")).toBeNull();
  });
});
