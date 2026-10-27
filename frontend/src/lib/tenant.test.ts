import { afterEach, describe, expect, it, vi } from "vitest";
import { getTenant, tenantSite } from "./tenant";

describe("tenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("getTenant() retorna null quando PUBLIC_TENANT vazio (build codaqui)", () => {
    expect(getTenant()).toBeNull();
  });

  it("getTenant() retorna o tenant quando PUBLIC_TENANT está setado", async () => {
    vi.stubEnv("PUBLIC_TENANT", "tisocial");
    const mod = await import("./tenant");
    expect(mod.getTenant()).toBe("tisocial");
  });

  it("tenantSite resolve a URL canônica do tenant", () => {
    expect(tenantSite("tisocial")).toBe("https://tisocial.org.br");
    expect(tenantSite("devparana")).toBe("https://devparana.org");
  });

  it("tenantSite lança para tenant desconhecido", () => {
    expect(() => tenantSite("nope")).toThrow(/desconhecido/);
  });
});
