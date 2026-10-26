import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import LancamentoApp from "../LancamentoApp";
import { renderWithMui } from "../../../../../test/render-mui";
import type { AuthUser } from "../../../../../lib/auth-client";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta os
// campos que precisa no beforeEach/corpo (mesmo padrão de AppNavIsland.test).
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  isEventOrganizer: false,
  isEventFinance: false,
  isEventHost: false,
  isEventChecker: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    isEventOrganizer: authState.isEventOrganizer,
    isEventFinance: authState.isEventFinance,
    isEventHost: authState.isEventHost,
    isEventChecker: authState.isEventChecker,
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

type MockResponse = Pick<Response, "ok" | "status" | "json">;

function jsonResponse(
  data: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): MockResponse {
  return {
    ok,
    status,
    json: async () => data,
  };
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: "sub-1",
    githubId: "github-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles: ["membro"],
    ...overrides,
  };
}

function mockAdminAccess(): void {
  authState.user = makeUser({ sub: "admin-1", roles: ["membro", "admin"] });
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = true;
}

function mockEmptyData(): void {
  authState.authFetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/ledger/accounts")) return jsonResponse([]);
    if (url.endsWith("/account-transfers")) return jsonResponse({ data: [] });
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

async function renderAndWaitForInitialRequests(): Promise<void> {
  renderWithMui(<LancamentoApp />);
  await waitFor(() => {
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ledger/accounts"),
    );
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/account-transfers"),
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

describe("/admin/lancamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isFinanceAnalyzer = false;
    authState.isEventOrganizer = false;
    authState.isEventFinance = false;
    authState.isEventHost = false;
    authState.isEventChecker = false;
    window.history.pushState({}, "", "/admin/lancamento");
  });

  it("redireciona quando usuário não tem permissão financeira", async () => {
    const replace = stubLocation();
    try {
      authState.user = makeUser({ sub: "u1" });
      authState.ready = true;
      authState.isLoggedIn = true;

      renderWithMui(<LancamentoApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { role: "event_organizer", label: "organizador de eventos" },
    { role: "event_finance", label: "financeiro de eventos" },
    { role: "event_host", label: "anfitrião de evento" },
    { role: "event_checker", label: "credenciador" },
  ])("redireciona $label para a home", async ({ role }) => {
    const replace = stubLocation();
    try {
      authState.user = makeUser({ sub: "u1", roles: ["membro", role] });
      authState.ready = true;
      authState.isLoggedIn = true;
      authState.isEventOrganizer = role === "event_organizer";
      authState.isEventFinance = role === "event_finance";
      authState.isEventHost = role === "event_host";
      authState.isEventChecker = role === "event_checker";

      renderWithMui(<LancamentoApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("não redireciona finance-analyzer e renderiza a página", async () => {
    const replace = stubLocation();
    try {
      mockEmptyData();
      authState.user = makeUser({
        sub: "finance-1",
        roles: ["membro", "finance-analyzer"],
      });
      authState.ready = true;
      authState.isLoggedIn = true;
      authState.isAdmin = false;
      authState.isFinanceAnalyzer = true;

      renderWithMui(<LancamentoApp />);

      await waitFor(() => {
        expect(authState.authFetch).toHaveBeenCalledWith(
          expect.stringContaining("/ledger/accounts"),
        );
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });

      expect(replace).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: /Revisar lançamento/i }),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("abre na aba Transferências quando a URL traz ?tab=transferencias", async () => {
    window.history.pushState({}, "", "/admin/lancamento?tab=transferencias");
    mockEmptyData();
    mockAdminAccess();

    await renderAndWaitForInitialRequests();

    expect(
      screen.getByText("Solicitações de transferência"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Revisar lançamento/i }),
    ).not.toBeInTheDocument();
  });

  it("valida campos obrigatórios no lançamento direto", async () => {
    mockEmptyData();
    mockAdminAccess();
    await renderAndWaitForInitialRequests();

    fireEvent.click(screen.getByRole("button", { name: /Revisar lançamento/i }));

    expect(
      await screen.findByText(/Preencha os campos obrigatórios/i),
    ).toBeInTheDocument();
  });

  it("cria conta externa e aprova solicitação de transferência pendente", async () => {
    authState.authFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (url.endsWith("/ledger/accounts") && !options) {
          return jsonResponse([
            { id: "a-1", name: "Conta A", type: "INTERNAL", projectKey: "tesouro" },
            { id: "a-2", name: "Conta B", type: "INTERNAL", projectKey: "devparana" },
          ]);
        }
        if (url.endsWith("/account-transfers") && !options) {
          return jsonResponse({
            data: [
              {
                id: "t-1",
                amount: 150,
                reason: "Ajuste de caixa",
                status: "pending",
                requestedBy: { name: "Pessoa", githubHandle: "pessoa" },
                reviewedBy: null,
                reviewNote: null,
                reviewedAt: null,
                createdAt: "2026-05-18T10:00:00.000Z",
                sourceAccount: { name: "Conta A" },
                destinationAccount: { name: "Conta B" },
              },
            ],
          });
        }
        if (url.endsWith("/ledger/accounts") && options?.method === "POST") {
          return jsonResponse({ id: "ext-1" });
        }
        if (
          url.endsWith("/account-transfers/t-1/approve") &&
          options?.method === "PATCH"
        ) {
          return jsonResponse({ ok: true });
        }
        return jsonResponse(null, { ok: false, status: 404 });
      },
    );

    mockAdminAccess();
    await renderAndWaitForInitialRequests();

    fireEvent.click(
      screen.getByRole("button", { name: /Criar conta externa/i }),
    );
    fireEvent.change(screen.getByLabelText(/Nome da conta/i), {
      target: { value: "Gateway PIX Manual" },
    });
    fireEvent.change(screen.getByLabelText(/Project key/i), {
      target: { value: "pix-manual-codaqui" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar conta/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ledger/accounts"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    const createCall = authState.authFetch.mock.calls.find(
      ([url, opts]) =>
        String(url).endsWith("/ledger/accounts") &&
        (opts as RequestInit)?.method === "POST",
    );
    const createBody = JSON.parse(
      (createCall?.[1] as RequestInit).body as string,
    ) as {
      name: string;
      type: string;
      projectKey: string;
    };
    expect(createBody).toEqual({
      name: "Gateway PIX Manual",
      type: "EXTERNAL",
      projectKey: "pix-manual-codaqui",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Criar conta externa/i }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("tab", { name: /Transferências \(1 pendente\)/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Aprovar/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /^Aprovar$/i }),
    );

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/account-transfers/t-1/approve"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
