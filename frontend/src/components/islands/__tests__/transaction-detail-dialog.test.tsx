import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionDetailDialog from "../TransactionDetailDialog";
import { generateReceiptPdf } from "../DonationReceiptPdf/index.tsx";
import type { Transaction } from "../../../lib/transaction";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

vi.mock("../DonationReceiptPdf/index.tsx", () => ({ generateReceiptPdf: vi.fn() }));

const accountId = "acc-codaqui";
const apiUrl = "https://api.codaqui.dev";
const baseTx: Transaction = {
  id: "tx-abc12345",
  amount: 250,
  description: "Doação de @octocat via Stripe",
  referenceId: "stripe-pi:pi_abc123",
  createdAt: "2026-07-15T12:00:00.000Z",
  sourceAccount: { id: "stripe", name: "Stripe" },
  destinationAccount: { id: accountId, name: "Codaqui" },
};

function renderDialog(tx: Transaction) {
  return renderWithMui(<TransactionDetailDialog tx={tx} accountId={accountId} apiUrl={apiUrl} onClose={vi.fn()} />);
}

describe("TransactionDetailDialog — comprovantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SITE", "https://codaqui.dev");
    vi.mocked(generateReceiptPdf).mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { status: 404 })));
  });

  it("gera PDF de doação PF com origem e handle", async () => {
    const user = userEvent.setup();
    renderDialog(baseTx);

    await user.click(await screen.findByRole("button", { name: "Baixar comprovante PDF" }));

    await waitFor(() => expect(generateReceiptPdf).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      apiUrl,
      siteUrl: "https://codaqui.dev",
      donorHandle: "@octocat",
    })));
  });

  it("gera PDF empresarial com nome e CNPJ públicos", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === `${apiUrl}/companies/company-1/public`) {
        return jsonResponse({ id: "company-1", name: "Empresa Aliada", cnpj: "44593429000105" });
      }
      return jsonResponse({}, { status: 404 });
    });
    renderDialog({
      ...baseTx,
      description: "Assinatura mensal empresarial — Empresa: Empresa Aliada [company-1] — Sessão in_abc123",
      referenceId: "in_abc123",
    });

    await user.click(await screen.findByRole("button", { name: "Baixar comprovante PDF" }));

    await waitFor(() => expect(generateReceiptPdf).toHaveBeenCalledWith(expect.objectContaining({
      companyData: { name: "Empresa Aliada", cnpj: "44593429000105" },
    })));
  });

  it("não oferece comprovante para movimentações que não são doações", async () => {
    renderDialog({ ...baseTx, referenceId: "vendor-payment:vp-1" });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baixar comprovante PDF" })).not.toBeInTheDocument();
  });

  it("mostra erro e reabilita o botão quando a geração falha", async () => {
    const user = userEvent.setup();
    vi.mocked(generateReceiptPdf).mockRejectedValue(new Error("Falha ao gerar PDF"));
    renderDialog(baseTx);

    const button = await screen.findByRole("button", { name: "Baixar comprovante PDF" });
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao gerar PDF");
    await waitFor(() => expect(button).toBeEnabled());
  });
});
