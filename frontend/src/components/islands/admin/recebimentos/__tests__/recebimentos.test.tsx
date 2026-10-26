import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecebimentosApp from "../RecebimentosApp";

const authState = vi.hoisted(() => ({
  ready: true,
  isLoggedIn: true,
  isAdmin: true,
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
    isEventOrganizer: false,
    isEventFinance: false,
    isEventHost: false,
    isEventChecker: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

vi.mock("../../../../../lib/config", () => ({
  API_URL: "https://api.test",
  STRIPE_PUBLISHABLE_KEY: "",
}));

const vendors = [
  {
    id: "v1",
    name: "Acme Ltda",
    document: "44593429000105",
    website: null,
    accountId: "av1",
  },
  {
    id: "v2",
    name: "Fornecedor X",
    document: null,
    website: null,
    accountId: "av2",
  },
];

const accounts = [
  { id: "a1", name: "Banco Principal", type: "BANK" },
  { id: "a2", name: "Conta Externa", type: "EXTERNAL" },
];

const receipt = {
  id: "r1",
  vendorId: "v1",
  destinationAccountId: "a1",
  amount: 25000,
  description: "Repasse Sympla",
  receiptUrl: null,
  internalReceiptUrl: null,
  registeredByUserId: "u1",
  occurredAt: "2026-01-10T10:00:00Z",
  createdAt: "2026-01-10T10:00:00Z",
  vendor: { name: "Acme Ltda" },
  destinationAccount: { name: "Banco Principal" },
  registeredBy: {
    name: "Ana",
    avatarUrl: "https://avatars.com/ana.png",
    githubHandle: "ana",
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface FetchOverrides {
  vendors?: unknown;
  accounts?: unknown;
  receipts?: unknown;
}

function defaultFetchMock(overrides: FetchOverrides = {}) {
  return vi.fn((url: string) => {
    if (url.includes("/vendors/receipts")) {
      return Promise.resolve(jsonResponse(overrides.receipts ?? []));
    }
    if (url.includes("/vendors")) {
      return Promise.resolve(jsonResponse(overrides.vendors ?? vendors));
    }
    if (url.includes("/ledger/accounts")) {
      return Promise.resolve(jsonResponse(overrides.accounts ?? accounts));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

describe("RecebimentosApp", () => {
  beforeEach(() => {
    authState.ready = true;
    authState.isLoggedIn = true;
    authState.isAdmin = true;
    authState.isFinanceAnalyzer = false;
    authState.authFetch = defaultFetchMock();
  });

  it("exibe estado vazio no histórico de recebimentos", async () => {
    render(<RecebimentosApp />);
    await screen.findByRole("heading", { name: "Recebimentos de Fornecedores" });
    await userEvent.click(screen.getByRole("tab", { name: "Histórico (0)" }));
    expect(
      await screen.findByText("Nenhum recebimento registrado."),
    ).toBeInTheDocument();
  });

  it("registra recebimento via form (POST /vendors/receipts)", async () => {
    render(<RecebimentosApp />);
    await screen.findByRole("heading", { name: "Recebimentos de Fornecedores" });

    const vendorInput = screen.getByLabelText(
      "Fornecedor / Origem do recebimento *",
    );
    await userEvent.click(vendorInput);
    await userEvent.type(vendorInput, "Acme");
    await userEvent.click(await screen.findByRole("option", { name: /acme/i }));
    fireEvent.mouseDown(screen.getByLabelText("Conta de Destino *"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Banco Principal (BANK)"));
    await userEvent.type(screen.getByLabelText("Valor (R$) *"), "250");
    await userEvent.type(screen.getByLabelText("Descrição *"), "Repasse Sympla");
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar Recebimento" }),
    );

    expect(await screen.findByText("Confirmar recebimento")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(authState.authFetch).toHaveBeenCalledWith(
        "https://api.test/vendors/receipts",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId: "v1",
            destinationAccountId: "a1",
            amount: 25000,
            description: "Repasse Sympla",
          }),
        }),
      ),
    );
  });

  it("exclui recebimento com confirmação via ModalConfirm", async () => {
    authState.authFetch = defaultFetchMock({ receipts: [receipt] });
    render(<RecebimentosApp />);
    await screen.findByRole("heading", { name: "Recebimentos de Fornecedores" });
    await userEvent.click(screen.getByRole("tab", { name: "Histórico (1)" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Excluir recebimento" }),
    );
    expect(await screen.findByText("Excluir recebimento?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(authState.authFetch).toHaveBeenCalledWith(
        "https://api.test/vendors/receipts/r1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
