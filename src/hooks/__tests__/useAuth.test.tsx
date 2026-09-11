/**
 * Tests para o hook useAuth (GitHub OAuth + JWT via cookie httpOnly).
 *
 * - fetch global mockado: o hook hidrata via GET /auth/me no mount.
 * - login/logout navegam via `location.href = url`. O jsdom não implementa
 *   navegação cross-document (emite "Not implemented: navigation" sem
 *   expor a URL), então as URLs de redirect são capturadas com um spy em
 *   `URL.prototype.toString` — o hook sempre passa por `new URL(...).toString()`
 *   para montar o destino.
 *
 * Nota: o mock de useDocusaurusContext não define siteConfig.url, então em
 * jsdom (origin http://localhost) resolveApiUrl cai no branch whitelabel e
 * apiUrl = "http://localhost".
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth, type AuthUser } from "../useAuth";
import { jsonResponse } from "../../test-utils/http";

const API_ORIGIN = "http://localhost";

const memberProfile: AuthUser = {
  sub: "uuid-1",
  githubId: "123",
  handle: "endersonmenezes",
  name: "Enderson",
  avatarUrl: "https://avatars.githubusercontent.com/u/123",
  roles: ["membro", "admin", "event_organizer"],
};

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

let urlToStringSpy: jest.SpyInstance<string, []>;
let consoleErrorSpy: jest.SpyInstance<void, unknown[]>;

function serializedUrls(): string[] {
  return urlToStringSpy.mock.results
    .filter((r) => r.type === "return")
    .map((r) => r.value);
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.sessionStorage.clear();
  urlToStringSpy = jest.spyOn(URL.prototype, "toString");
  // Silencia o "Not implemented: navigation" do jsdom nos redirects.
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  urlToStringSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

function mockMeOk(profile: AuthUser = memberProfile) {
  fetchMock.mockResolvedValue(jsonResponse(profile));
}

describe("estado inicial e hidratação (GET /auth/me)", () => {
  it("começa deslogado e hidrata o usuário quando /auth/me responde ok", async () => {
    mockMeOk();

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(`${API_ORIGIN}/auth/me`, {
      credentials: "include",
    });
    expect(result.current.user).toEqual(memberProfile);
    expect(result.current.isLoggedIn).toBe(true);
  });

  it("expõe flags de papel derivadas de roles", async () => {
    mockMeOk();

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isEventOrganizer).toBe(true);
    expect(result.current.isFinanceAnalyzer).toBe(false);
    expect(result.current.isEventFinance).toBe(false);
    expect(result.current.isEventHost).toBe(false);
    expect(result.current.isEventChecker).toBe(false);
  });

  it("mantém usuário null quando /auth/me responde 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, { ok: false, status: 401 }));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.user).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("mantém usuário null quando /auth/me falha (rede)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.user).toBeNull();
  });
});

describe("authFetch", () => {
  it("prefixa paths relativos com a apiUrl e envia credentials + Content-Type", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await act(async () => {
      await result.current.authFetch("/members", { method: "POST", body: "{}" });
    });

    expect(fetchMock).toHaveBeenLastCalledWith(`${API_ORIGIN}/members`, {
      method: "POST",
      body: "{}",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(result.current.user).toEqual(memberProfile);
  });

  it("usa URLs absolutas sem prefixar", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    fetchMock.mockResolvedValue(jsonResponse({}));
    await act(async () => {
      await result.current.authFetch("https://api.example.com/x");
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.example.com/x",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("mescla headers customizados com o default", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    fetchMock.mockResolvedValue(jsonResponse({}));
    await act(async () => {
      await result.current.authFetch("/x", {
        headers: { "X-Custom": "1" },
      });
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_ORIGIN}/x`,
      expect.objectContaining({
        headers: { "Content-Type": "application/json", "X-Custom": "1" },
      }),
    );
  });

  it("limpa o usuário (logout automático) em resposta 401", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    fetchMock.mockResolvedValue(jsonResponse(null, { ok: false, status: 401 }));
    await act(async () => {
      await result.current.authFetch("/members");
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });
});

describe("login", () => {
  it("monta redirect para /auth/github com returnTo=/auth/callback e salva contexto", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.login({ returnTo: "/admin/eventos", communitySlug: "tisocial" });
    });

    expect(globalThis.sessionStorage.getItem("codaqui_auth_return")).toBe("/admin/eventos");
    expect(globalThis.sessionStorage.getItem("codaqui_auth_community")).toBe("tisocial");

    const redirect = serializedUrls().find((u) => u.includes("/auth/github"));
    expect(redirect).toBeDefined();
    const parsed = new URL(redirect!);
    expect(parsed.origin).toBe(API_ORIGIN);
    expect(parsed.pathname).toBe("/auth/github");
    expect(parsed.searchParams.get("returnTo")).toBe(`${API_ORIGIN}/auth/callback`);
    expect(parsed.searchParams.get("login")).toBeNull();
  });

  it("usa o pathname atual quando returnTo não é informado e limpa community", async () => {
    mockMeOk();
    globalThis.sessionStorage.setItem("codaqui_auth_community", "velha");

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.login();
    });

    // jsdom roda em http://localhost/ — pathname "/"
    expect(globalThis.sessionStorage.getItem("codaqui_auth_return")).toBe("/");
    expect(globalThis.sessionStorage.getItem("codaqui_auth_community")).toBeNull();
  });

  it("adiciona login= vazio quando switchAccount=true", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.login({ switchAccount: true });
    });

    const redirect = serializedUrls().find((u) => u.includes("/auth/github"));
    expect(redirect).toBeDefined();
    const parsed = new URL(redirect!);
    expect(parsed.searchParams.has("login")).toBe(true);
    expect(parsed.searchParams.get("login")).toBe("");
  });
});

describe("logout", () => {
  it("limpa o usuário e navega para /auth/logout", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    // Sem returnTo: nenhuma URL é serializada (href é template literal direto)
    expect(serializedUrls().filter((u) => u.includes("returnTo"))).toEqual([]);
  });

  it("inclui returnTo absoluto e salva contexto da comunidade", async () => {
    mockMeOk();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.logout({ returnTo: "/comunidades/tisocial", communitySlug: "tisocial" });
    });

    expect(globalThis.sessionStorage.getItem("codaqui_auth_logout_return")).toBe(
      "/comunidades/tisocial",
    );
    expect(globalThis.sessionStorage.getItem("codaqui_auth_community")).toBe("tisocial");

    expect(serializedUrls()).toContain(`${API_ORIGIN}/comunidades/tisocial`);
  });
});
