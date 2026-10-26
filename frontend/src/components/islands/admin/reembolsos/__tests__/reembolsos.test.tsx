import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import ReembolsosApp from "../ReembolsosApp";
import { renderWithMui } from "../../../../../test/render-mui";
import type { AuthUser } from "../../../../../lib/auth-client";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function makeUser(roles: string[]): AuthUser {
  return {
    sub: "sub-1",
    githubId: "github-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles,
  };
}

function mockLoggedIn(roles: string[]) {
  authState.user = makeUser(roles);
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = roles.includes("admin");
  authState.isFinanceAnalyzer = roles.includes("finance-analyzer");
}

/** O saldo das contas vem de um fetch público (sem auth). */
function stubBalancesFetch() {
  const fetchMock = vi.fn(async () => jsonResponse([]));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

describe("/admin/reembolsos", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isFinanceAnalyzer = false;
    authState.authFetch = vi.fn(async (url: string) => {
      if (url.includes("/reimbursements")) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse(null, { status: 404 });
    });
    stubBalancesFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { role: "event_organizer", label: "organizador de eventos" },
    { role: "event_host", label: "anfitrião de evento" },
    { role: "event_checker", label: "credenciador" },
    { role: "event_finance", label: "financeiro de eventos" },
    { role: "membro", label: "membro comum" },
  ])("redireciona $label para a home", async ({ role }) => {
    const replace = stubLocation();
    try {
      mockLoggedIn(["membro", role]);

      renderWithMui(<ReembolsosApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
      expect(authState.authFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { role: "admin", label: "admin" },
    { role: "finance-analyzer", label: "finance analyzer" },
  ])("permite acesso a $label", async ({ role }) => {
    const balancesFetch = stubBalancesFetch();
    try {
      mockLoggedIn(["membro", role]);

      renderWithMui(<ReembolsosApp />);

      await waitFor(() => {
        expect(authState.authFetch).toHaveBeenCalledWith(
          expect.stringContaining("/reimbursements"),
        );
      });

      // saldos via endpoint público (fetch global, sem auth)
      expect(balancesFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ledger/community-balances"),
      );
      expect(screen.getByRole("tab", { name: /Pendentes/i })).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhuma solicitação pendente/i),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
