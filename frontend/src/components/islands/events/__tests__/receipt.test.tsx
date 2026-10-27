/**
 * Testes do recibo autenticado de compra (`/eventos/comprovante?order=`) —
 * port de `src/pages/eventos/comprovante.tsx` (Docusaurus) para Vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import ReceiptApp from "../ReceiptApp";
import { renderWithMui } from "../../../../test/render-mui";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo (mesmo padrão do dashboard
// de membro e do AppNavIsland).
const authState = vi.hoisted(() => ({
  isLoggedIn: false,
  ready: false,
  login: vi.fn(),
  authFetch: vi.fn(),
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: null,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: false,
    login: authState.login,
    logout: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, options: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const receipt = {
  orderId: "ord-123",
  eventTitle: "Encontro DevParaná",
  buyerName: "Maria Silva",
  buyerEmail: "maria@example.com",
  attendees: [{ name: "João Souza", email: "joao@example.com" }],
  items: [{ ticketName: "Geral", quantity: 2, unitPriceCents: 2500 }],
  totalCents: 5000,
  paidAt: "2026-10-20T18:00:00.000Z",
  termsVersion: "v1.2",
  verificationCode: "COD-1234",
};

describe("/eventos/comprovante", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/eventos/comprovante?order=ord-123");
    authState.ready = true;
    authState.isLoggedIn = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama login com returnTo do pathname+search quando deslogado", async () => {
    renderWithMui(<ReceiptApp />);

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith({
        returnTo: "/eventos/comprovante?order=ord-123",
      });
    });
    expect(authState.authFetch).not.toHaveBeenCalled();
  });

  it("mostra skeleton enquanto o recibo carrega", () => {
    authState.isLoggedIn = true;
    authState.authFetch.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithMui(<ReceiptApp />);

    expect(container.querySelector(".MuiSkeleton-root")).not.toBeNull();
  });

  it("carrega e renderiza o recibo quando logado", async () => {
    authState.isLoggedIn = true;
    authState.authFetch.mockResolvedValue(jsonResponse(receipt));

    renderWithMui(<ReceiptApp />);

    expect(await screen.findByText("Encontro DevParaná")).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      "/events/orders/ord-123/receipt",
    );
    expect(screen.getByText("COD-1234")).toBeInTheDocument();
    expect(screen.getByText("ord-123")).toBeInTheDocument();
    expect(screen.getByText(/João Souza/)).toBeInTheDocument();
    expect(screen.getByText("2x Geral")).toBeInTheDocument();
    // Item (2x R$ 25,00) + Total. O formatBRL usa NBSP como separador e o
    // matcher de texto não normaliza a agulha — regex com \s tolera ambos.
    expect(await screen.findAllByText(/R\$\s*50,00/)).toHaveLength(2);
    expect(screen.getByText(/Termos de compra aceitos/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Imprimir/i }),
    ).toBeInTheDocument();
  });

  it("exibe Alert com a mensagem de erro quando o recibo falha", async () => {
    authState.isLoggedIn = true;
    authState.authFetch.mockResolvedValue(
      new Response("Pedido não encontrado", { status: 404 }),
    );

    renderWithMui(<ReceiptApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pedido não encontrado",
    );
  });

  it("exibe Alert com fallback quando a resposta de erro é vazia", async () => {
    authState.isLoggedIn = true;
    authState.authFetch.mockResolvedValue(new Response("", { status: 500 }));

    renderWithMui(<ReceiptApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o comprovante.",
    );
  });
});
