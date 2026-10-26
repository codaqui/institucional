import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import CarteirasApp from "../CarteirasApp";
import { renderWithMui } from "../../../../../test/render-mui";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta os
// campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: null,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const rowMember = {
  id: "tx-1",
  ownerType: "member",
  ownerHandle: "octocat",
  ownerName: "Monalisa Octocat",
  ownerAvatarUrl: null,
  coinType: "sort_coin",
  amount: 50,
  source: "manual_admin",
  referenceId: "manual:tx-1",
  description: "Bônus de mentoria",
  createdAt: "2026-05-18T10:00:00.000Z",
};

const rowCompany = {
  id: "tx-2",
  ownerType: "company",
  ownerHandle: "44593429000105",
  ownerName: "Mentoria Codaqui",
  ownerAvatarUrl: null,
  coinType: "sort_coin",
  amount: -20,
  source: "raffle_entry",
  referenceId: null,
  description: null,
  createdAt: "2026-05-19T12:00:00.000Z",
};

function mockAllTransactions() {
  authState.authFetch.mockImplementation(async (url: string) => {
    if (url.includes("/club/admin/wallet/all-transactions?type=all&page=1&limit=50")) {
      return jsonResponse({ data: [rowMember, rowCompany], total: 120 });
    }
    if (url.includes("/club/admin/wallet/all-transactions?type=all&page=2&limit=50")) {
      return jsonResponse({ data: [rowMember], total: 120 });
    }
    if (url.includes("/club/admin/wallet/all-transactions?type=company&page=1&limit=50")) {
      return jsonResponse({ data: [rowCompany], total: 60 });
    }
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

describe("/admin/carteiras", () => {
  beforeEach(() => {
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isFinanceAnalyzer = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  it("redireciona para home quando logado sem admin nem finance-analyzer", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    try {
      authState.ready = true;
      authState.isLoggedIn = true;
      renderWithMui(<CarteirasApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("permite acesso a finance-analyzer e lista movimentações paginadas", async () => {
    mockAllTransactions();
    authState.ready = true;
    authState.isLoggedIn = true;
    authState.isFinanceAnalyzer = true;

    renderWithMui(<CarteirasApp />);

    expect(await screen.findByText("Monalisa Octocat")).toBeInTheDocument();
    expect(screen.getByText("Mentoria Codaqui")).toBeInTheDocument();
    expect(screen.getByText(/120 transação\(ões\) encontrada\(s\)/i)).toBeInTheDocument();
    // "+50" (membro) e "-20" (empresa)
    expect(screen.getByText("+50 SortCoins")).toBeInTheDocument();
    expect(screen.getByText("-20 SortCoins")).toBeInTheDocument();
  });

  it("solicita a página 2 ao trocar a paginação", async () => {
    mockAllTransactions();
    authState.ready = true;
    authState.isLoggedIn = true;
    authState.isAdmin = true;

    renderWithMui(<CarteirasApp />);

    await screen.findByText("Monalisa Octocat");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/admin/wallet/all-transactions?type=all&page=2&limit=50"),
      );
    });
  });

  it("refiltra do zero (page=1) ao mudar o tipo de titular", async () => {
    mockAllTransactions();
    authState.ready = true;
    authState.isLoggedIn = true;
    authState.isAdmin = true;

    renderWithMui(<CarteirasApp />);

    await screen.findByText("Monalisa Octocat");
    fireEvent.mouseDown(screen.getByLabelText("Tipo de titular"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Somente empresas"));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/admin/wallet/all-transactions?type=company&page=1&limit=50"),
      );
    });
  });

  it("abre o diálogo de detalhes ao clicar no olho da transação", async () => {
    mockAllTransactions();
    authState.ready = true;
    authState.isLoggedIn = true;
    authState.isAdmin = true;

    renderWithMui(<CarteirasApp />);

    await screen.findByText("Monalisa Octocat");
    fireEvent.click(screen.getAllByRole("button", { name: /ver detalhes da transação/i })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Detalhes da transação")).toBeInTheDocument();
    expect(within(dialog).getByText(/^ID:/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Bônus de mentoria/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Monalisa Octocat/)).toBeInTheDocument();
  });
});
