/**
 * Tests para api-url helpers.
 *
 * Usamos as versões puras (resolveApiUrlFor / resolveCodaquiUrlFor) para
 * evitar a dor de mockar `window.location` em jsdom (non-configurable).
 * As funções públicas resolveApiUrl/resolveCodaquiUrl apenas delegam.
 */

import {
  isCodaquiOrigin,
  isLocalDevHost,
  resolveApiUrl,
  resolveApiUrlFor,
  resolveCodaquiUrl,
  resolveCodaquiUrlFor,
} from "../api-url";

const SITE_URL = "https://codaqui.dev";
const API_URL = "https://api.codaqui.dev";

describe("isCodaquiOrigin", () => {
  it("aceita siteUrl exato", () => {
    expect(isCodaquiOrigin("https://codaqui.dev", SITE_URL)).toBe(true);
  });
  it("aceita Docusaurus dev :3000", () => {
    expect(isCodaquiOrigin("http://localhost:3000", SITE_URL)).toBe(true);
  });
  it("aceita Docusaurus dev :3030", () => {
    expect(isCodaquiOrigin("http://localhost:3030", SITE_URL)).toBe(true);
  });
  it("rejeita whitelabel prod", () => {
    expect(isCodaquiOrigin("https://tisocial.org.br", SITE_URL)).toBe(false);
  });
  it("rejeita whitelabel dev", () => {
    expect(isCodaquiOrigin("http://tisocial.localhost:8787", SITE_URL)).toBe(false);
  });
});

describe("isLocalDevHost", () => {
  it("identifica localhost puro", () => {
    expect(isLocalDevHost("localhost")).toBe(true);
    expect(isLocalDevHost("localhost:3000")).toBe(true);
  });
  it("identifica *.localhost", () => {
    expect(isLocalDevHost("tisocial.localhost:8787")).toBe(true);
  });
  it("não confunde substring", () => {
    expect(isLocalDevHost("notlocalhost.com")).toBe(false);
    expect(isLocalDevHost("codaqui.dev")).toBe(false);
    expect(isLocalDevHost("tisocial.org.br")).toBe(false);
  });
});

describe("resolveApiUrlFor", () => {
  it("SSR (origin undefined) retorna o configured", () => {
    expect(resolveApiUrlFor(undefined, API_URL, SITE_URL)).toBe(API_URL);
  });
  it("origem Codaqui prod retorna o configured", () => {
    expect(resolveApiUrlFor("https://codaqui.dev", API_URL, SITE_URL)).toBe(API_URL);
  });
  it("origem Docusaurus dev :3000 retorna o configured", () => {
    expect(resolveApiUrlFor("http://localhost:3000", API_URL, SITE_URL)).toBe(API_URL);
  });
  it("origem Docusaurus dev :3030 retorna o configured", () => {
    expect(resolveApiUrlFor("http://localhost:3030", API_URL, SITE_URL)).toBe(API_URL);
  });
  it("origem whitelabel dev (*.localhost:8787) retorna a própria origin", () => {
    expect(
      resolveApiUrlFor("http://tisocial.localhost:8787", API_URL, SITE_URL),
    ).toBe("http://tisocial.localhost:8787");
  });
  it("origem whitelabel prod (tisocial.org.br) retorna a própria origin", () => {
    expect(resolveApiUrlFor("https://tisocial.org.br", API_URL, SITE_URL)).toBe(
      "https://tisocial.org.br",
    );
  });
});

describe("resolveCodaquiUrlFor", () => {
  it("SSR (host undefined) retorna siteUrl + baseUrl", () => {
    expect(resolveCodaquiUrlFor(undefined, SITE_URL, "/")).toBe("https://codaqui.dev/");
  });
  it("prod codaqui.dev retorna siteUrl + baseUrl", () => {
    expect(resolveCodaquiUrlFor("codaqui.dev", SITE_URL, "/")).toBe("https://codaqui.dev/");
  });
  it("prod whitelabel tisocial.org.br retorna siteUrl + baseUrl", () => {
    expect(resolveCodaquiUrlFor("tisocial.org.br", SITE_URL, "/")).toBe(
      "https://codaqui.dev/",
    );
  });
  it("dev *.localhost:8787 retorna http://localhost:3000 + baseUrl", () => {
    expect(resolveCodaquiUrlFor("tisocial.localhost:8787", SITE_URL, "/")).toBe(
      "http://localhost:3000/",
    );
  });
  it("dev localhost:3000 retorna http://localhost:3000 + baseUrl", () => {
    expect(resolveCodaquiUrlFor("localhost:3000", SITE_URL, "/")).toBe(
      "http://localhost:3000/",
    );
  });
  it("preserva baseUrl não-/", () => {
    expect(resolveCodaquiUrlFor("codaqui.dev", SITE_URL, "/blog/")).toBe(
      "https://codaqui.dev/blog/",
    );
  });
});

describe("resolveApiUrl (wrapper que lê window)", () => {
  it("em jsdom (origin = http://localhost) retorna a própria origin (whitelabel)", () => {
    // jsdom default origin é http://localhost — não bate com nenhum host Codaqui
    // (não é :3000 nem :3030), então cai no branch whitelabel.
    expect(resolveApiUrl(API_URL, SITE_URL)).toBe("http://localhost");
  });
});

describe("resolveCodaquiUrl (wrapper que lê window)", () => {
  it("em jsdom (host = localhost) é detectado como dev local", () => {
    // jsdom default host é "localhost" (sem porta) — bate em isLocalDevHost.
    expect(resolveCodaquiUrl(SITE_URL, "/")).toBe("http://localhost:3000/");
  });
});
