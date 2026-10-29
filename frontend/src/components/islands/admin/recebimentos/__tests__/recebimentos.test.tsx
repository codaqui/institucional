import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  authState,
  jsonResponse,
  makeVendorFetchMock,
  resetVendorTxAuthState,
  type VendorTxFetchOverrides,
} from "../../../../../test/vendor-tx-fixtures";
import RecebimentosApp from "../RecebimentosApp";

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

interface FetchOverrides extends VendorTxFetchOverrides {
  receipts?: unknown;
}

function defaultFetchMock(overrides: FetchOverrides = {}) {
  return makeVendorFetchMock(overrides, (url, o) => {
    if (url.includes("/vendors/receipts")) {
      return jsonResponse(o.receipts ?? []);
    }
    return null;
  });
}

describe("RecebimentosApp", () => {
  beforeEach(() => {
    resetVendorTxAuthState(() => defaultFetchMock());
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
