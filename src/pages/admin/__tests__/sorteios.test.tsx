import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminSorteiosPage from "../sorteios";
import { useAuth } from "../../../hooks/useAuth";

const replaceMock = jest.fn();
const historyMock = { replace: replaceMock };

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => historyMock,
}));
jest.mock("../../../components/AdminNavbar", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-navbar" />,
}));
jest.mock("../../../components/AdminPageContainer", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe("/admin/sorteios", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("redireciona para home quando não autenticado como admin", async () => {
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: false,
      authFetch: jest.fn() as any,
      user: { sub: "u-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isFinanceAnalyzer: false,
    } as any);

    render(<AdminSorteiosPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("valida criação de sorteio quando faltam campos obrigatórios", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/club/raffles/all")) return jsonResponse([]);
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

