import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminEmpresasPage from "../empresas";
import { useAuth } from "../../../hooks/useAuth";

const pushMock = jest.fn();

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => ({ push: pushMock }),
}));
jest.mock("../../../components/AdminNavbar", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-navbar" />,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

type MockResponse = Pick<Response, "ok" | "status" | "json">;

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => data,
  };
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
    pushMock.mockReset();
  });

  it("redireciona para home quando não autenticado", async () => {
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: false,
      isAdmin: false,
      authFetch: jest.fn() as any,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isFinanceAnalyzer: false,
    } as any);

    render(<AdminEmpresasPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/");
    });
  });

  it("carrega listagem paginada e busca detalhes ao expandir card", async () => {
    const authFetch = jest.fn(async (url: string) => {
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
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isFinanceAnalyzer: false,
    } as any);

    render(<AdminEmpresasPage />);

    expect(await screen.findByText("Mentoria Codaqui")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.500 em apoios/i)).toBeInTheDocument();
    expect(screen.getByText(/5 apoios/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));

    expect(await screen.findByText(/Colaboradores \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("@colab1")).toBeInTheDocument();
    expect(screen.getByText("sort_coin")).toBeInTheDocument();
  });

  it("solicita próxima página ao trocar paginação", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [company], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/companies/admin/list?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isFinanceAnalyzer: false,
    } as any);

    render(<AdminEmpresasPage />);

    await screen.findByText("Mentoria Codaqui");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/companies/admin/list?page=2&limit=10"),
      );
    });
  });
});
