import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "../../../lib/transaction";
import { generateCompanyReceiptPdf, generateReceiptPdf } from "./index";

const mocks = vi.hoisted(() => ({
  addImage: vi.fn(),
  save: vi.fn(),
  html2canvas: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: class {
    addImage = mocks.addImage;
    save = mocks.save;
  },
}));

vi.mock("html2canvas", () => ({ default: mocks.html2canvas }));

const accountId = "acc-codaqui";
const baseTx: Transaction = {
  id: "tx-abc12345",
  amount: 250,
  description: "Doação de @octocat via Stripe",
  referenceId: "stripe-pi:pi_abc123",
  createdAt: "2026-07-15T12:00:00.000Z",
  sourceAccount: { id: "stripe", name: "Stripe" },
  destinationAccount: { id: accountId, name: "Codaqui" },
};

const companyReceipt = {
  generatedAt: "2026-07-15T12:00:00.000Z",
  company: { cnpj: "44.593.429/0001-05", name: "Empresa Aliada", tradeName: "Aliada", responsibleName: "Responsável" },
  beneficiary: { name: "Associação Codaqui", cnpj: "44.593.429/0001-05", address: "Maringá, Paraná, Brasil" },
  donation: { month: "2026-07", amountBRL: 200, stripeInvoiceId: "in_abc123", paidAt: "2026-07-10T12:00:00.000Z" },
  signatureStatement: "A Associação Codaqui declara a doação empresarial de julho.",
};

function mockCanvas() {
  let capturedText = "";
  let capturedHtml = "";
  mocks.html2canvas.mockImplementation(async (element: HTMLElement) => {
    capturedText = element.textContent ?? "";
    capturedHtml = element.innerHTML;
    return {
      height: 100,
      width: 100,
      toDataURL: () => "data:image/png;base64,abc",
    };
  });
  return {
    text: () => capturedText,
    html: () => capturedHtml,
  };
}

describe("DonationReceiptPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "Pessoa Doadora" }),
    }));
  });

  it("gera PDF de doação PF com nome, valor e QR da transação", async () => {
    const captured = mockCanvas();

    await generateReceiptPdf({ tx: baseTx, accountId, siteUrl: "https://codaqui.dev", apiUrl: "https://api.codaqui.dev" });

    expect(captured.text()).toContain("Pessoa Doadora (@octocat)");
    expect(captured.text()).toMatch(/R\$\s*250,00/);
    expect(captured.text()).toContain("pi_abc123");
    expect(captured.html()).toContain("https://codaqui.dev/transparencia?tx=tx-abc12345");
    expect(mocks.save).toHaveBeenCalledWith("comprovante-doacao-tx-abc12.pdf");
    expect(document.querySelector("#__receipt_pdf_container__")).toBeNull();
  });

  it("gera PDF empresarial da Transparência com CNPJ", async () => {
    const captured = mockCanvas();
    const tx: Transaction = {
      ...baseTx,
      description: "Assinatura mensal empresarial — Empresa: Empresa Aliada [company-1] — Sessão in_abc123",
      referenceId: "in_abc123",
    };

    await generateReceiptPdf({
      tx,
      accountId,
      siteUrl: "https://codaqui.dev",
      companyData: { name: "Empresa Aliada", cnpj: "44593429000105" },
    });

    expect(captured.text()).toContain("Empresa Aliada (CNPJ: 44.593.429/0001-05)");
    expect(captured.text()).toContain("Doação Empresarial");
    expect(captured.html()).toContain("https://codaqui.dev/transparencia?tx=tx-abc12345");
  });

  it("gera PDF da fatura empresarial com declaração e referência", async () => {
    const captured = mockCanvas();

    await generateCompanyReceiptPdf(companyReceipt, "https://codaqui.dev");

    expect(captured.text()).toContain("Empresa Aliada (CNPJ: 44.593.429/0001-05)");
    expect(captured.text()).toContain("A Associação Codaqui declara a doação empresarial de julho.");
    expect(captured.text()).toContain("in_abc123");
    expect(captured.html()).toContain("https://codaqui.dev/transparencia");
    expect(mocks.save).toHaveBeenCalledWith("comprovante-doacao-in_abc12.pdf");
  });

  it("remove o container quando a renderização falha", async () => {
    mocks.html2canvas.mockRejectedValue(new Error("canvas indisponível"));

    await expect(generateReceiptPdf({ tx: baseTx, accountId, siteUrl: "https://codaqui.dev" }))
      .rejects.toThrow("canvas indisponível");
    expect(document.querySelector("#__receipt_pdf_container__")).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
