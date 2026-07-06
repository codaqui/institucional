import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MembroPage from "../index";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");

const loggedUser = {
  sub: "user-1",
  name: "Mentoria Codaqui",
  handle: "mentoriacodaqui",
  avatarUrl: "https://example.com/avatar.png",
  role: "member",
};

describe("/membro", () => {
  beforeEach(() => {
    resetRouterMocks();
    if (jest.isMockFunction(globalThis.fetch)) {
      const fetchMock = globalThis.fetch as jest.Mock;
      fetchMock.mockReset();
    }
  });

  it("redireciona quando usuário não está logado", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      isLoggedIn: false,
      user: null,
      authFetch: jest.fn() as any,
    }));

    (globalThis.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("exibe distinção pessoal x business em doações e assinaturas em abas separadas", async () => {
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
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      user: loggedUser as any,
      authFetch: authFetch as any,
    }));

    (globalThis.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    expect(await screen.findByText(/1 pessoal · 1 business/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Histórico de Doações/i }));

    expect(await screen.findAllByText("Pessoal")).toHaveLength(1);
    expect(await screen.findAllByText("Business")).toHaveLength(1);
    expect(screen.queryByText("Mensal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Assinaturas Recorrentes/i }));
    expect(await screen.findAllByText("Mensal")).toHaveLength(2);
    expect(await screen.findAllByText("Pessoal")).toHaveLength(1);
    expect(await screen.findAllByText("Business")).toHaveLength(1);
  });

  it("dispara carregamento paginado ao trocar página de assinaturas e doações nas abas corretas", async () => {
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
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      user: loggedUser as any,
      authFetch: authFetch as any,
    }));

    (globalThis.fetch as any) = jest.fn(() => Promise.resolve(jsonResponse([])));

    render(<MembroPage />);

    fireEvent.click(await screen.findByRole("tab", { name: /Histórico de Doações/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /Assinaturas Recorrentes/i }));

    fireEvent.click(await screen.findByRole("button", { name: /go to page 2/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Histórico de Doações/i }));
    fireEvent.click(await screen.findByRole("button", { name: /go to page 2/i }));

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
