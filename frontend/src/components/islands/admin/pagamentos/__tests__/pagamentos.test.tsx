import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  authState,
  jsonResponse,
  makeVendorFetchMock,
  resetVendorTxAuthState,
  type VendorTxFetchOverrides,
} from "../../../../../test/vendor-tx-fixtures";
import PagamentosApp from "../PagamentosApp";

const payment = {
  id: "p1",
  vendorId: "v1",
  sourceAccountId: "a1",
  amount: 10050,
  description: "Hospedagem AWS",
  receiptUrl: null,
  internalReceiptUrl: null,
  paidByUserId: "u1",
  occurredAt: "2026-01-15T14:30:00Z",
  createdAt: "2026-01-15T14:30:00Z",
  vendor: { name: "Acme Ltda" },
  sourceAccount: { name: "Banco Principal" },
  registeredBy: {
    name: "Ana",
    avatarUrl: "https://avatars.com/ana.png",
    githubHandle: "ana",
  },
};

interface FetchOverrides extends VendorTxFetchOverrides {
  templates?: unknown;
  payments?: unknown;
  paymentsStatus?: number;
}

function defaultFetchMock(overrides: FetchOverrides = {}) {
  return makeVendorFetchMock(overrides, (url, o) => {
    if (url.includes("/vendors/templates")) {
      return jsonResponse(o.templates ?? []);
    }
    if (url.includes("/vendors/payments")) {
      return jsonResponse(o.payments ?? [], o.paymentsStatus ?? 200);
    }
    return null;
  });
}

describe("PagamentosApp", () => {
  beforeEach(() => {
    resetVendorTxAuthState(() => defaultFetchMock());
  });

  it("redireciona para / quando pronto e deslogado", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    try {
      authState.isLoggedIn = false;
      render(<PagamentosApp />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("exibe estado vazio no histórico de pagamentos", async () => {
    render(<PagamentosApp />);
    await screen.findByRole("heading", { name: "Pagamentos a Fornecedores" });
    await userEvent.click(screen.getByRole("tab", { name: "Histórico (0)" }));
    expect(
      await screen.findByText("Nenhum pagamento registrado."),
    ).toBeInTheDocument();
  });

  it("exibe erro de carregamento quando a API falha", async () => {
    authState.authFetch = defaultFetchMock({
      payments: { message: "boom" },
      paymentsStatus: 500,
    });
    render(<PagamentosApp />);
    expect(await screen.findByText("Erro ao carregar dados.")).toBeInTheDocument();
  });

  it("cria template via POST /vendors/templates", async () => {
    render(<PagamentosApp />);
    await screen.findByRole("heading", { name: "Pagamentos a Fornecedores" });
    await userEvent.click(screen.getByRole("tab", { name: "Templates (0)" }));
    await userEvent.click(screen.getByRole("button", { name: "Novo Template" }));

    await userEvent.type(
      screen.getByLabelText("Nome do template *"),
      "Contador mensal",
    );
    const vendorInput = screen.getByLabelText("Fornecedor *");
    await userEvent.click(vendorInput);
    await userEvent.type(vendorInput, "Acme");
    await userEvent.click(await screen.findByRole("option", { name: /acme/i }));
    fireEvent.mouseDown(screen.getByLabelText("Conta de Origem *"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Banco Principal (BANK)"));
    await userEvent.type(screen.getByLabelText("Valor padrão (R$) *"), "150.75");
    await userEvent.type(
      screen.getByLabelText("Descrição padrão *"),
      "Honorários do contador",
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar Template" }));

    await waitFor(() =>
      expect(authState.authFetch).toHaveBeenCalledWith(
        "https://api.test/vendors/templates",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Contador mensal",
            vendorId: "v1",
            sourceAccountId: "a1",
            amount: 15075,
            description: "Honorários do contador",
          }),
        }),
      ),
    );
  });

  it("exclui pagamento com confirmação via ModalConfirm", async () => {
    authState.authFetch = defaultFetchMock({ payments: [payment] });
    render(<PagamentosApp />);
    await screen.findByRole("heading", { name: "Pagamentos a Fornecedores" });
    await userEvent.click(screen.getByRole("tab", { name: "Histórico (1)" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Excluir pagamento" }),
    );
    expect(await screen.findByText("Excluir pagamento?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(authState.authFetch).toHaveBeenCalledWith(
        "https://api.test/vendors/payments/p1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
