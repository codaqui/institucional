import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MembroPage from "../index";
import { useAuth } from "../../../hooks/useAuth";

const replaceMock = jest.fn();

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => ({ replace: replaceMock }),
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

const loggedUser = {
  sub: "user-1",
  name: "Mentoria Codaqui",
  handle: "mentoriacodaqui",
  avatarUrl: "https://example.com/avatar.png",
  role: "member",
};

describe("/membro", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
  });

  it("redireciona quando usuário não está logado", async () => {
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: false,
      user: null,
      authFetch: jest.fn() as any,
      logout: jest.fn(),
      login: jest.fn(),
      refreshUser: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    (global.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("exibe distinção pessoal x business em assinaturas e doações", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations?page=1&limit=10")) {
        return jsonResponse({
          items: [
            {
              id: "d-1",
              amount: 100,
              description: "Doação pessoal",
              community: "Tesouro Codaqui",
              referenceId: "ref-1",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
            {
              id: "d-2",
              amount: 200,
              description: "Doação empresa Business",
              community: "Tesouro Codaqui",
              referenceId: "ref-2",
              createdAt: "2026-05-19T10:00:00.000Z",
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes("/stripe/my-subscriptions?page=1&limit=10")) {
        return jsonResponse({
          items: [
            {
              id: "s-1",
              status: "active",
              interval: "month",
              amount: 1000,
              currency: "brl",
              communityId: "tesouro-geral",
              entityType: "member",
              companyId: null,
              currentPeriodEnd: 1_800_000_000,
              cancelAtPeriodEnd: false,
            },
            {
              id: "s-2",
              status: "active",
              interval: "month",
              amount: 2000,
              currency: "brl",
              communityId: "tesouro-geral",
              entityType: "business",
              companyId: "company-1",
              currentPeriodEnd: 1_800_000_000,
              cancelAtPeriodEnd: false,
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      user: loggedUser as any,
      authFetch: authFetch as any,
      logout: jest.fn(),
      login: jest.fn(),
      refreshUser: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    (global.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    expect(await screen.findByText(/1 pessoal · 1 business/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Histórico de Doações/i }));

    expect(await screen.findAllByText("Pessoal")).toHaveLength(2);
    expect(await screen.findAllByText("Business")).toHaveLength(2);
  });

  it("dispara carregamento paginado ao trocar página de assinaturas e doações", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations?page=1&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/stripe/my-subscriptions?page=1&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/stripe/my-donations?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      if (url.includes("/stripe/my-subscriptions?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      user: loggedUser as any,
      authFetch: authFetch as any,
      logout: jest.fn(),
      login: jest.fn(),
      refreshUser: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    (global.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    fireEvent.click(await screen.findByRole("tab", { name: /Histórico de Doações/i }));

    const pageButtons = await screen.findAllByRole("button", { name: /go to page 2/i });
    fireEvent.click(pageButtons[0]);
    fireEvent.click(pageButtons[1]);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/stripe/my-subscriptions?page=2&limit=10"),
      );
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/stripe/my-donations?page=2&limit=10"),
      );
    });
  });
});

