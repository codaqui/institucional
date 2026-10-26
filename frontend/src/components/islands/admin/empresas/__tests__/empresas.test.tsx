import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import EmpresasApp from "../EmpresasApp";
import { renderWithMui } from "../../../../../test/render-mui";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta os
// campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: null,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: false,
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

function mockAdmin() {
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = true;
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

const company = {
  id: "c-1",
  name: "Mentoria Codaqui",
  cnpj: "44593429000105",
  logoUrl: null,
  websiteUrl: "https://codaqui.dev",
  status: "active",
  responsibleMemberId: "owner-1",
  responsibleGithubHandle: "mentoriacodaqui",
  subscriptionAmountCents: 50000,
  sortCoinBalance: 300,
  totalSupportedReais: 1500,
  supportCount: 5,
  monthsSupporting: 4,
  createdAt: "2026-05-18T10:00:00.000Z",
};

describe("/admin/empresas", () => {
  beforeEach(() => {
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  it("redireciona para home quando não autenticado", async () => {
    const replace = stubLocation();
    try {
      authState.ready = true;
      renderWithMui(<EmpresasApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("carrega listagem paginada e busca detalhes ao expandir card", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({
          items: [company],
          total: 20,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes(`/companies/${company.id}/members`)) {
        return jsonResponse([{ id: "m-1", memberId: "colab1", addedAt: "2026-05-18T10:00:00.000Z" }]);
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<EmpresasApp />);

    expect(await screen.findByText("Mentoria Codaqui")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.500 em apoios/i)).toBeInTheDocument();
    expect(screen.getByText(/5 apoios/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));

    expect(await screen.findByText(/Colaboradores \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("@colab1")).toBeInTheDocument();
    expect(screen.getByText("sort_coin")).toBeInTheDocument();
  });

  it("solicita próxima página ao trocar paginação", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [company], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/companies/admin/list?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<EmpresasApp />);

    await screen.findByText("Mentoria Codaqui");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/companies/admin/list?page=2&limit=10"),
      );
    });
  });

  it("atualiza status via PATCH ao trocar o Select", async () => {
    authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [company], total: 1, page: 1, limit: 10 });
      }
      if (url.includes(`/companies/${company.id}/status`) && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<EmpresasApp />);

    await screen.findByText("Mentoria Codaqui");
    fireEvent.mouseDown(screen.getByLabelText("Status de Mentoria Codaqui"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(await screen.findByRole("option", { name: /suspensa/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/status`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "suspended" }),
        }),
      );
    });
  });
});
