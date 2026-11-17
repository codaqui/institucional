import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import {
  authState,
  jsonResponse,
  mockLoggedIn,
  resetAuthState,
} from "../../../../../test/admin-auth-fixtures";
import { renderWithMui } from "../../../../../test/render-mui";
import StripeFeeReconciliationPanel from "../StripeFeeReconciliationPanel";

const result = {
  paymentIntentId: "pi_reconcile",
  chargeId: "ch_reconcile",
  balanceTransactionId: "txn_reconcile",
  feeReferenceId: "stripe-fee:txn_reconcile",
  feeCents: 837,
  transactionId: "tx-fee",
};

describe("StripeFeeReconciliationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    mockLoggedIn(["membro", "admin"]);
  });

  it("creates a missing fee and disables the action while pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    authState.authFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderWithMui(<StripeFeeReconciliationPanel />);

    fireEvent.change(screen.getByLabelText(/PaymentIntent/i), {
      target: { value: "pi_reconcile" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Consultar e reconciliar/i }),
    );

    expect(screen.getByRole("button", { name: /Consultando/i })).toBeDisabled();
    resolveRequest?.(
      jsonResponse({ ...result, status: "created" }, { status: 201 }),
    );

    expect(
      await screen.findByText(/Taxa de R\$ 8,37 criada no ledger/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      "/stripe/reconcile-fee",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ paymentIntentId: "pi_reconcile" }),
      }),
    );
  });

  it("reports an existing fee without presenting it as newly created", async () => {
    authState.authFetch.mockResolvedValue(
      jsonResponse({ ...result, status: "already_exists" }),
    );
    renderWithMui(<StripeFeeReconciliationPanel />);

    fireEvent.change(screen.getByLabelText(/PaymentIntent/i), {
      target: { value: "pi_reconcile" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Consultar e reconciliar/i }),
    );

    expect(
      await screen.findByText(
        /já estava registrada; nenhum lançamento foi duplicado/i,
      ),
    ).toBeInTheDocument();
  });

  it("reports a balance transaction without a fee", async () => {
    authState.authFetch.mockResolvedValue(
      jsonResponse({ ...result, status: "no_fee", feeCents: 0 }),
    );
    renderWithMui(<StripeFeeReconciliationPanel />);

    fireEvent.change(screen.getByLabelText(/PaymentIntent/i), {
      target: { value: "pi_reconcile" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Consultar e reconciliar/i }),
    );

    expect(
      await screen.findByText(/não possui taxa a registrar/i),
    ).toBeInTheDocument();
  });

  it("shows the API error and preserves the PaymentIntent", async () => {
    authState.authFetch.mockResolvedValue(
      jsonResponse(
        { message: "Stripe temporariamente indisponível" },
        { status: 502 },
      ),
    );
    renderWithMui(<StripeFeeReconciliationPanel />);

    fireEvent.change(screen.getByLabelText(/PaymentIntent/i), {
      target: { value: "pi_reconcile" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Consultar e reconciliar/i }),
    );

    expect(
      await screen.findByText("Stripe temporariamente indisponível"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/PaymentIntent/i)).toHaveValue("pi_reconcile");
  });

  it("rejects an invalid ID without calling the API", async () => {
    renderWithMui(<StripeFeeReconciliationPanel />);

    fireEvent.change(screen.getByLabelText(/PaymentIntent/i), {
      target: { value: "cs_invalid" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Consultar e reconciliar/i }),
    );

    expect(
      await screen.findByText(/Informe um PaymentIntent válido/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).not.toHaveBeenCalled();
  });
});
