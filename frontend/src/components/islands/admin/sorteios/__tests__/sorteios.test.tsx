import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import SorteiosApp from "../SorteiosApp";
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

const openRaffle = {
  id: "raffle-1",
  title: "Sorteio de Maio",
  description: "Mensal",
  costInCoins: 10,
  status: "open",
  closesAt: "2026-05-20T12:00:00.000Z",
  drawAt: null,
  winnerId: null,
};

describe("/admin/sorteios", () => {
  beforeEach(() => {
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  it("redireciona para home quando não autenticado como admin", async () => {
    const replace = stubLocation();
    try {
      authState.ready = true;
      authState.isLoggedIn = true; // membro comum, sem role admin
      renderWithMui(<SorteiosApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("valida criação de sorteio quando faltam campos obrigatórios", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/club/raffles/all")) return jsonResponse([]);
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<SorteiosApp />);

    await screen.findByText(/Novo sorteio/i);
    fireEvent.click(screen.getByRole("button", { name: /Criar sorteio/i }));

    expect(await screen.findByText(/Informe o título do sorteio/i)).toBeInTheDocument();
  });

  it("carrega sorteios e executa ações de sortear/cancelar", async () => {
    authState.authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/club/raffles/all")) {
        return jsonResponse([openRaffle]);
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
    mockAdmin();

    renderWithMui(<SorteiosApp />);

    expect(await screen.findByText("Sorteio de Maio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver participantes/i }));
    expect(await screen.findByText(/Nenhum participante até agora/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Sortear$/i }));

    // O sorteio exige confirmação via ModalConfirm antes do POST
    expect(await screen.findByText("Sortear vencedor?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sortear agora/i }));
    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/raffles/raffle-1/draw"),
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Sortear vencedor?")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/club/raffles/raffle-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
