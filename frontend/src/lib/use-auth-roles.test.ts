// @vitest-environment jsdom
// renderHook precisa de DOM; o glob do vitest.config só envia *.test.tsx para
// jsdom, e este arquivo segue o nome do brief (.test.ts).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./use-auth";

const baseUser = {
  sub: "uuid",
  githubId: "1",
  handle: "octocat",
  name: "Octo",
  avatarUrl: "https://x",
};

function mockAuthMe(user: object | null, status = user ? 200 : 401) {
  // Aceita qualquer base resolvida por resolveApiUrl — este arquivo testa os
  // helpers de role, não a resolução da URL (coberta em use-auth-api-url).
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/auth/me")) {
        return new Response(user ? JSON.stringify(user) : "", { status });
      }
      throw new Error(`URL inesperada: ${url}`);
    }),
  );
}

describe("useAuth — helpers de role", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("finance-analyzer ativa só isFinanceAnalyzer", async () => {
    mockAuthMe({ ...baseUser, roles: ["membro", "finance-analyzer"] });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.isFinanceAnalyzer).toBe(true);
    expect(result.current.isEventFinance).toBe(false);
    expect(result.current.isEventHost).toBe(false);
    expect(result.current.isEventChecker).toBe(false);
  });

  it("roles combinadas de evento ativam os três helpers de evento", async () => {
    mockAuthMe({
      ...baseUser,
      roles: ["event_finance", "event_host", "event_checker"],
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.isEventFinance).toBe(true);
    expect(result.current.isEventHost).toBe(true);
    expect(result.current.isEventChecker).toBe(true);
    expect(result.current.isFinanceAnalyzer).toBe(false);
  });

  it("sem usuário todos os helpers são false", async () => {
    mockAuthMe(null);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.user).toBeNull();
    expect(result.current.isFinanceAnalyzer).toBe(false);
    expect(result.current.isEventFinance).toBe(false);
    expect(result.current.isEventHost).toBe(false);
    expect(result.current.isEventChecker).toBe(false);
  });
});
