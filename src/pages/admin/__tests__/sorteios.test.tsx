import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminSorteiosPage from "../sorteios";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");
jest.mock(
  "../../../components/AdminNavbar",
  () => require("../../../test-utils/admin-component-mocks").mockAdminNavbarModule,
);
jest.mock(
  "../../../components/AdminPageContainer",
  () => require("../../../test-utils/admin-component-mocks").mockAdminPageContainerModule,
);

describe("/admin/sorteios", () => {
  beforeEach(() => {
    resetRouterMocks();
  });

  it("redireciona para home quando não autenticado como admin", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      authFetch: jest.fn() as any,
      user: { sub: "u-1" } as any,
    }));

    render(<AdminSorteiosPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("valida criação de sorteio quando faltam campos obrigatórios", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/club/raffles/all")) return jsonResponse([]);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<AdminSorteiosPage />);

    await screen.findByText(/Novo sorteio/i);
    fireEvent.click(screen.getByRole("button", { name: /Criar sorteio/i }));

    expect(await screen.findByText(/Informe o título do sorteio/i)).toBeInTheDocument();
  });

  it("carrega sorteios e executa ações de sortear/cancelar", async () => {
    const authFetch = jest.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/club/raffles/all")) {
        return jsonResponse([
          {
            id: "raffle-1",
            title: "Sorteio de Maio",
            description: "Mensal",
            costInCoins: 10,
            status: "open",
            closesAt: "2026-05-20T12:00:00.000Z",
            drawAt: null,
            winnerId: null,
          },
        ]);
      }
      if (url.endsWith("/club/raffles/raffle-1/draw") && options?.method === "POST") {
        return jsonResponse({ ok: true });
      }
      if (url.endsWith("/club/raffles/raffle-1") && options?.method === "DELETE") {
        return jsonResponse({ ok: true });
      }
      if (url.endsWith("/club/raffles/raffle-1/entries")) {
        return jsonResponse([]);
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<AdminSorteiosPage />);

    expect(await screen.findByText("Sorteio de Maio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver participantes/i }));
    expect(await screen.findByText(/Nenhum participante até agora/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sortear/i }));
    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/raffles/raffle-1/draw"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/raffles/raffle-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
