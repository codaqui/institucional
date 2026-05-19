import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyCompanySection from "../index";
import { useAuth } from "../../../hooks/useAuth";

jest.mock("../../../hooks/useAuth");

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
  id: "company-1",
  name: "Kodak",
  cnpj: "44593429000105",
  status: "active",
  responsibleMemberId: "owner-1",
  websiteUrl: "https://codaqui.dev",
  subscriptionAmountCents: 50000,
};

const baseAuth = {
  ready: true,
  isLoggedIn: true,
  isAdmin: false,
  isFinanceAnalyzer: false,
  refreshUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
};

describe("MyCompanySection", () => {
  it("carrega empresa via fallback de colaborações e renderiza histórico", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
      if (url.includes(`/companies/${company.id}/wallet/transactions`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-1",
              coinType: "sort_coin",
              amount: 100,
              source: "stripe_invoice",
              referenceId: "ref-1",
              description: "Assinatura mensal empresarial",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) {
        return jsonResponse([{ id: "m-1", memberId: "mentoriacodaqui", addedAt: "2026-05-18T10:00:00.000Z" }]);
      }
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 500, supportCount: 1, monthsSupporting: 2 });
      }
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "collab-1", handle: "mentoriacodaqui" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    expect(await screen.findByText("Kodak")).toBeInTheDocument();
    expect(screen.getByText(/Assinatura mensal empresarial/i)).toBeInTheDocument();
    expect(screen.getByText(/Colaboradores podem ver o saldo/i)).toBeInTheDocument();
  });

  it("renderiza aviso quando não há empresa vinculada", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "collab-1", handle: "mentoriacodaqui" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    expect(
      await screen.findByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).toBeInTheDocument();
  });

  it("solicita nova página de transações ao trocar a paginação", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(company);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/wallet/transactions?page=1&limit=20`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-1",
              coinType: "sort_coin",
              amount: 100,
              source: "stripe_invoice",
              referenceId: "ref-1",
              description: "Página 1",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
          ],
          total: 40,
          page: 1,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet/transactions?page=2&limit=20`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-2",
              coinType: "sort_coin",
              amount: 50,
              source: "stripe_invoice",
              referenceId: "ref-2",
              description: "Página 2",
              createdAt: "2026-05-19T10:00:00.000Z",
            },
          ],
          total: 40,
          page: 2,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 500, supportCount: 5, monthsSupporting: 2 });
      }
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "owner-1", handle: "owner" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    await screen.findByText("Página 1");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("page=2&limit=20"));
    });
    expect(await screen.findByText("Página 2")).toBeInTheDocument();
  });
});
