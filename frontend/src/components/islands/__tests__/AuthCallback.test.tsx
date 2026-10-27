/**
 * Testes de /auth/callback — upgrade da fase 0.4:
 * default return `/membro`, limpeza de COMMUNITY_KEY no finalize e paridade
 * com o fluxo do Docusaurus (`src/pages/auth/callback.tsx`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuthCallback from "../AuthCallback";
import { COMMUNITY_KEY, RETURN_KEY } from "../../../lib/auth-client";

vi.mock("../../../lib/config", () => ({ API_URL: "http://localhost:3001" }));

const USER = {
  sub: "uuid",
  githubId: "1",
  handle: "octocat",
  name: "Octo",
  avatarUrl: "https://x",
  roles: ["membro"],
};

function stubLocation({
  search = "",
  hash = "",
  pathname = "/auth/callback",
}: { search?: string; hash?: string; pathname?: string } = {}) {
  const replace = vi.fn();
  vi.stubGlobal("location", { search, hash, pathname, replace });
  return replace;
}

function stubFetch({
  finalizeStatus = 200,
  me = USER as typeof USER | null,
}: { finalizeStatus?: number; me?: typeof USER | null } = {}) {
  const spy = vi.fn(async (url: string) => {
    if (url.includes("/auth/finalize")) {
      return new Response("{}", { status: finalizeStatus });
    }
    if (url.includes("/auth/me")) {
      return me
        ? new Response(JSON.stringify(me), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        : new Response("", { status: 401 });
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

function stubSessionStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  });
  return map;
}

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirect do OAuth (status=success + token) → troca em /auth/finalize e vai para /membro por default", async () => {
    const replace = stubLocation({ search: "?status=success", hash: "#token=jwt-1" });
    const session = stubSessionStorage({ [COMMUNITY_KEY]: "tisocial" });
    const fetchSpy = stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/membro"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/auth/finalize",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ token: "jwt-1" }),
      }),
    );
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes("/auth/me"))).toHaveLength(1);
    // limpeza das chaves de auth no finalize
    expect(session.has(RETURN_KEY)).toBe(false);
    expect(session.has(COMMUNITY_KEY)).toBe(false);
  });

  it("redirect do OAuth com return válido salvo → redireciona para ele", async () => {
    const replace = stubLocation({ search: "?status=success", hash: "#token=jwt-1" });
    const session = stubSessionStorage({ [RETURN_KEY]: "/admin/eventos" });
    stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/eventos"));
    expect(session.has(RETURN_KEY)).toBe(false);
    expect(session.has(COMMUNITY_KEY)).toBe(false);
  });

  it("return inválido (URL absoluta) → cai no default /membro", async () => {
    const replace = stubLocation({ search: "?status=success", hash: "#token=jwt-1" });
    stubSessionStorage({ [RETURN_KEY]: "https://evil.example.com/phish" });
    stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/membro"));
  });

  it("return inválido (protocol-relative //) → cai no default /membro", async () => {
    const replace = stubLocation({ search: "?status=success", hash: "#token=jwt-1" });
    stubSessionStorage({ [RETURN_KEY]: "//evil.example.com" });
    stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/membro"));
  });

  it("status=success sem token mas com sessão → redireciona normalmente", async () => {
    const replace = stubLocation({ search: "?status=success" });
    stubSessionStorage();
    const fetchSpy = stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/membro"));
    expect(
      fetchSpy.mock.calls.filter(([u]) => String(u).includes("/auth/finalize")),
    ).toHaveLength(0);
  });

  it("status=error → mostra mensagem de erro e não redireciona", async () => {
    const replace = stubLocation({ search: "?status=error" });
    const fetchSpy = stubFetch();

    render(<AuthCallback />);

    expect(
      await screen.findByText(/não foi possível autenticar/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para o início/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("finalize falha (500) → mostra erro e não redireciona", async () => {
    const replace = stubLocation({ search: "?status=success", hash: "#token=jwt-1" });
    stubSessionStorage();
    stubFetch({ finalizeStatus: 500 });

    render(<AuthCallback />);

    expect(
      await screen.findByText(/não foi possível autenticar/i),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sem status com sessão válida → redireciona para o destino salvo (refresh/histórico)", async () => {
    const replace = stubLocation();
    stubSessionStorage({ [RETURN_KEY]: "/membro/editar" });
    stubFetch();

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/membro/editar"));
  });

  it("sem status e sem sessão → redireciona para a home", async () => {
    const replace = stubLocation();
    stubSessionStorage();
    stubFetch({ me: null });

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
