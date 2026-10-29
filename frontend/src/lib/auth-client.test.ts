import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMe, authFetch, startLogin, startLogout } from "./auth-client";

const API = "http://localhost:3001";
const user = {
  sub: "uuid",
  githubId: "1",
  handle: "octocat",
  name: "Octo",
  avatarUrl: "https://x",
  roles: ["membro"],
};

describe("fetchMe", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("retorna o usuário quando 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(user), { status: 200 })),
    );
    expect(await fetchMe(API)).toEqual(user);
  });

  it("retorna null quando 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    expect(await fetchMe(API)).toBeNull();
  });

  it("retorna null em erro de rede", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await fetchMe(API)).toBeNull();
  });
});

describe("authFetch", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("envia credentials include e Content-Type JSON", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", spy);
    await authFetch(API, "/events", { method: "POST", body: "{}" });
    const [url, init] = spy.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(`${API}/events`);
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("dispara onUnauthorized em 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const onUnauthorized = vi.fn();
    await authFetch(API, "/events", {}, onUnauthorized);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("aceita URL absoluta sem prefixar apiUrl", async () => {
    const spy = vi.fn(
      async (_url: string) => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", spy);
    await authFetch(API, "https://outro.dev/x");
    expect(spy.mock.calls[0][0]).toBe("https://outro.dev/x");
  });
});

describe("startLogin / startLogout", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("login redireciona para /auth/github com returnTo=/auth/callback absoluto", () => {
    // Node não tem `location`: stubamos um objeto plano com as props usadas
    // (spread de URL não copia os getters, que vivem no protótipo).
    const currentUrl = new URL("http://localhost:4321/eventos?status=success");
    vi.stubGlobal("location", {
      href: "",
      origin: currentUrl.origin,
      pathname: currentUrl.pathname,
      search: currentUrl.search,
    });
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => session.set(k, v),
      removeItem: (k: string) => session.delete(k),
      getItem: (k: string) => session.get(k),
    });
    startLogin(API);
    const redirect = new URL((globalThis as any).location.href);
    expect(redirect.origin).toBe(API);
    expect(redirect.pathname).toBe("/auth/github");
    expect(redirect.searchParams.get("returnTo")).toBe(
      "http://localhost:4321/auth/callback",
    );
    expect(session.get("codaqui_auth_return")).toBe("/eventos?status=success");
  });

  it("logout chama /auth/logout e limpa estado via callback", () => {
    // `origin` é necessária: startLogout monta a URL absoluta do returnTo.
    vi.stubGlobal("location", { href: "", origin: "http://localhost:4321" });
    startLogout(API, { returnTo: "/" });
    const href = (globalThis as any).location.href as string;
    expect(href.startsWith(`${API}/auth/logout?returnTo=`)).toBe(true);
  });
});
