import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyReceiptDownload from "../company/CompanyReceiptDownload";
import { generateCompanyReceiptPdf } from "../../DonationReceiptPdf/index.tsx";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock("../../DonationReceiptPdf/index.tsx", () => ({ generateCompanyReceiptPdf: vi.fn() }));

const receipt = {
  generatedAt: "2026-07-15T12:00:00.000Z",
  company: { cnpj: "44.593.429/0001-05", name: "Empresa Aliada", tradeName: "Aliada", responsibleName: "Responsável" },
  beneficiary: { name: "Associação Codaqui", cnpj: "44.593.429/0001-05", address: "Maringá, Paraná, Brasil" },
  donation: { month: "2026-07", amountBRL: 200, stripeInvoiceId: "in_abc123", paidAt: "2026-07-10T12:00:00.000Z" },
  signatureStatement: "Declaração da doação.",
};

describe("CompanyReceiptDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SITE", "https://codaqui.dev");
    mocks.authFetch.mockResolvedValue(jsonResponse(receipt));
    vi.mocked(generateCompanyReceiptPdf).mockResolvedValue(undefined);
  });

  it("consulta o mês selecionado e gera o PDF autenticado", async () => {
    const user = userEvent.setup();
    renderWithMui(<CompanyReceiptDownload receiptUrl="/companies/company-1/receipt" />);
    const currentMonth = new Date().toISOString().slice(0, 7);

    await user.click(screen.getByRole("button", { name: "Baixar comprovante PDF" }));
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith(`/companies/company-1/receipt?month=${currentMonth}`));
    expect(generateCompanyReceiptPdf).toHaveBeenCalledWith(receipt, "https://codaqui.dev");

    fireEvent.change(screen.getByLabelText(/Mês do comprovante/), { target: { value: "2026-07" } });
    await user.click(screen.getByRole("button", { name: "Baixar comprovante PDF" }));
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/companies/company-1/receipt?month=2026-07"));
  });

  it("mostra erro quando não existe fatura no mês e não gera arquivo", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockResolvedValue(jsonResponse({ message: "Nenhuma fatura paga encontrada para o mês informado" }, { status: 404 }));
    renderWithMui(<CompanyReceiptDownload receiptUrl="/companies/company-1/receipt" />);

    await user.click(screen.getByRole("button", { name: "Baixar comprovante PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma fatura paga encontrada para o mês informado");
    expect(generateCompanyReceiptPdf).not.toHaveBeenCalled();
  });

  it("impede downloads concorrentes", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    mocks.authFetch.mockReturnValue(new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    renderWithMui(<CompanyReceiptDownload receiptUrl="/companies/company-1/receipt" />);
    const button = screen.getByRole("button", { name: "Baixar comprovante PDF" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.authFetch).toHaveBeenCalledTimes(1);

    resolveFetch?.(jsonResponse(receipt));
    await waitFor(() => expect(generateCompanyReceiptPdf).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeEnabled());
  });
});
