import { describe, it, expect } from "vitest";
import {
  isCodaquiOrigin,
  isLocalDevHost,
  resolveApiUrl,
  resolveApiUrlFor,
  resolveCodaquiUrl,
  resolveCodaquiUrlFor,
} from "./api-url";
import { API_URL } from "./config";

const SITE_URL = "https://codaqui.dev";
const CONFIGURED_API = "https://api.codaqui.dev";

describe("isCodaquiOrigin", () => {
  it("aceita siteUrl exato e dev local (Docusaurus :3000/:3030, Astro :4321)", () => {
    expect(isCodaquiOrigin("https://codaqui.dev", SITE_URL)).toBe(true);
    expect(isCodaquiOrigin("http://localhost:3000", SITE_URL)).toBe(true);
    expect(isCodaquiOrigin("http://localhost:3030", SITE_URL)).toBe(true);
    expect(isCodaquiOrigin("http://localhost:4321", SITE_URL)).toBe(true);
  });
  it("rejeita whitelabel (prod e dev)", () => {
    expect(isCodaquiOrigin("https://tisocial.org.br", SITE_URL)).toBe(false);
    expect(isCodaquiOrigin("http://tisocial.localhost:8787", SITE_URL)).toBe(false);
  });
});

describe("isLocalDevHost", () => {
  it("identifica localhost puro e *.localhost", () => {
    expect(isLocalDevHost("localhost")).toBe(true);
    expect(isLocalDevHost("localhost:3000")).toBe(true);
    expect(isLocalDevHost("tisocial.localhost:8787")).toBe(true);
  });
  it("não confunde substring", () => {
    expect(isLocalDevHost("notlocalhost.com")).toBe(false);
    expect(isLocalDevHost("codaqui.dev")).toBe(false);
  });
});

describe("resolveApiUrlFor", () => {
  it("SSR (origin undefined) retorna o configured", () => {
    expect(resolveApiUrlFor(undefined, CONFIGURED_API, SITE_URL)).toBe(CONFIGURED_API);
  });
  it("origem Codaqui retorna o configured", () => {
    expect(resolveApiUrlFor("https://codaqui.dev", CONFIGURED_API, SITE_URL)).toBe(
      CONFIGURED_API,
    );
    expect(resolveApiUrlFor("http://localhost:4321", CONFIGURED_API, SITE_URL)).toBe(
      CONFIGURED_API,
    );
  });
  it("origem whitelabel retorna a própria origin (same-origin via Worker)", () => {
    expect(
      resolveApiUrlFor("https://tisocial.org.br", CONFIGURED_API, SITE_URL),
    ).toBe("https://tisocial.org.br");
    expect(
      resolveApiUrlFor("http://tisocial.localhost:8787", CONFIGURED_API, SITE_URL),
    ).toBe("http://tisocial.localhost:8787");
  });
});

describe("resolveCodaquiUrlFor", () => {
  it("SSR/prod retorna siteUrl + baseUrl", () => {
    expect(resolveCodaquiUrlFor(undefined, SITE_URL, "/")).toBe("https://codaqui.dev/");
    expect(resolveCodaquiUrlFor("tisocial.org.br", SITE_URL, "/blog/")).toBe(
      "https://codaqui.dev/blog/",
    );
  });
  it("dev local volta para o dev server Codaqui", () => {
    expect(resolveCodaquiUrlFor("tisocial.localhost:8787", SITE_URL, "/")).toBe(
      "http://localhost:3000/",
    );
  });
});

describe("wrappers (delegam ao config do Astro)", () => {
  it("resolveApiUrl usa API_URL do config.ts como configured", () => {
    // Vitest roda em node (sem window): cai no branch SSR → configured.
    expect(resolveApiUrl(SITE_URL)).toBe(API_URL);
  });
  it("resolveCodaquiUrl em SSR retorna siteUrl + baseUrl", () => {
    expect(resolveCodaquiUrl(SITE_URL, "/")).toBe("https://codaqui.dev/");
  });
});
