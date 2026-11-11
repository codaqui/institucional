import { createElement } from "react";
import type { Transaction } from "../../../lib/transaction";
import { deriveTransactionMeta, formatBRL, formatDate } from "../../../lib/transaction";
import { formatDocument } from "../../../lib/document";

interface LedgerReceiptInput {
  tx: Transaction;
  accountId: string;
  siteUrl: string;
  apiUrl?: string;
  companyData?: { name: string; cnpj: string | null } | null;
  donorHandle?: string;
}

export interface CompanyReceipt {
  generatedAt: string;
  company: { cnpj: string; name: string; tradeName: string | null; responsibleName: string | null };
  beneficiary: { name: string; cnpj: string; address: string };
  donation: { month: string; amountBRL: number; stripeInvoiceId: string; paidAt: string };
  signatureStatement: string;
}

interface ReceiptViewModel {
  id: string;
  donorLabel: string;
  donorHeading: string;
  amountBRL: number;
  paidAt: string;
  destination: string;
  typeLabel: string;
  reference: string | null;
  verifyUrl: string;
  declaration?: string;
  isTestMode?: boolean;
}

const normalizeSiteUrl = (siteUrl: string) => siteUrl.replace(/\/$/, "");

async function renderAndDownload(model: ReceiptViewModel, siteUrl: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }, { QRCodeSVG }, { createRoot }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
    import("qrcode.react"),
    import("react-dom/client"),
  ]);

  const container = document.createElement("div");
  container.id = "__receipt_pdf_container__";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "var(--cq-bg-surface)";
  document.body.appendChild(container);
  const root = createRoot(container);

  const field = (heading: string, value: string) => createElement(
    "div",
    { style: { background: "var(--cq-bg-sunken)", borderRadius: "6px", padding: "12px 14px" } },
    createElement("div", { style: { color: "var(--cq-text-secondary)", fontSize: "11px", marginBottom: "2px" } }, heading),
    createElement("div", { style: { fontWeight: 600, overflowWrap: "anywhere" } }, value),
  );

  root.render(createElement(
    "div",
    {
      style: {
        fontFamily: "var(--cq-font-family-base)",
        padding: "40px 48px",
        color: "var(--cq-text-primary)",
        background: "var(--cq-bg-surface)",
        fontSize: "13px",
        lineHeight: 1.5,
        width: "794px",
        boxSizing: "border-box",
      },
    },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid var(--cq-color-primary-700)", paddingBottom: "16px", marginBottom: "24px" } },
      createElement(
        "div",
        null,
        createElement("img", {
          src: `${normalizeSiteUrl(siteUrl)}/img/logo.png`,
          alt: "Codaqui",
          style: { height: "40px", display: "block" },
          onError: (event: React.SyntheticEvent<HTMLImageElement>) => { event.currentTarget.style.display = "none"; },
        }),
        createElement("div", { style: { marginTop: "4px", color: "var(--cq-text-secondary)", fontSize: "11px" } }, "Associação Codaqui — CNPJ 44.593.429/0001-05"),
      ),
      createElement(
        "div",
        { style: { textAlign: "right" } },
        createElement("div", { style: { fontSize: "18px", fontWeight: 700, color: "var(--cq-color-primary-700)" } }, "COMPROVANTE DE DOAÇÃO"),
        model.isTestMode && createElement("div", { style: { fontSize: "11px", color: "var(--cq-color-error)", fontWeight: 600 } }, "MODO TESTE — não é um pagamento real"),
      ),
    ),
    createElement(
      "div",
      { style: { background: "var(--cq-color-primary-50)", border: "1px solid var(--cq-color-primary-200)", borderRadius: "8px", padding: "16px 20px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
      createElement(
        "div",
        null,
        createElement("div", { style: { color: "var(--cq-text-secondary)", fontSize: "11px" } }, "Valor doado"),
        createElement("div", { style: { fontSize: "28px", fontWeight: 800, color: "var(--cq-color-primary-800)" } }, formatBRL(model.amountBRL)),
      ),
      createElement(
        "div",
        { style: { textAlign: "right" } },
        createElement("div", { style: { color: "var(--cq-text-secondary)", fontSize: "11px" } }, "Data"),
        createElement("div", { style: { fontWeight: 600 } }, formatDate(model.paidAt)),
      ),
    ),
    createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" } },
      field("Destinatário", model.destination),
      field("Intermediário", "Stripe Payments"),
      field("Tipo", model.typeLabel),
      field(model.donorHeading, model.donorLabel),
    ),
    model.reference && createElement(
      "div",
      { style: { background: "var(--cq-bg-sunken)", borderRadius: "6px", padding: "10px 14px", marginBottom: "20px", fontFamily: "var(--cq-font-family-mono)", fontSize: "11px", overflowWrap: "anywhere" } },
      `ID Stripe: ${model.reference}`,
    ),
    model.declaration && createElement(
      "div",
      { style: { borderLeft: "3px solid var(--cq-color-primary-700)", padding: "8px 14px", marginBottom: "20px", color: "var(--cq-text-secondary)" } },
      model.declaration,
    ),
    createElement(
      "div",
      { style: { borderTop: "1px solid var(--cq-border-default)", paddingTop: "20px", display: "flex", gap: "24px", alignItems: "flex-start" } },
      createElement(QRCodeSVG, { value: model.verifyUrl, size: 80, level: "M", title: model.verifyUrl }),
      createElement(
        "div",
        { style: { flex: 1 } },
        createElement("div", { style: { fontWeight: 600, marginBottom: "4px" } }, "Verificação de autenticidade"),
        createElement("div", { style: { color: "var(--cq-text-secondary)", fontSize: "11px", overflowWrap: "anywhere" } }, "Acesse o QR Code ou o link abaixo para confirmar esta transação na página de transparência pública."),
        createElement("div", { style: { color: "var(--cq-link)", fontSize: "11px", marginTop: "4px", overflowWrap: "anywhere" } }, model.verifyUrl),
        createElement("div", { style: { color: "var(--cq-text-disabled)", fontSize: "10px", marginTop: "8px" } }, `Referência: ${model.id}`),
      ),
    ),
  ));

  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      width: 794,
      windowWidth: 794,
    });
    const widthMm = 210;
    const heightMm = Math.max((canvas.height / canvas.width) * widthMm, 297);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [widthMm, heightMm] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, (canvas.height / canvas.width) * widthMm);
    pdf.save(`comprovante-doacao-${model.id.slice(0, 8)}.pdf`);
  } finally {
    root.unmount();
    container.remove();
  }
}

export async function generateReceiptPdf({
  tx,
  accountId,
  siteUrl,
  apiUrl,
  companyData,
  donorHandle: donorHandleProp,
}: LedgerReceiptInput): Promise<void> {
  const meta = deriveTransactionMeta(tx, accountId);
  const isBusiness = meta.type === "donation-business";
  const handle = (donorHandleProp ?? meta.donorHandle)?.replace("@", "");
  let donorDisplayName: string | null = null;
  if (!isBusiness && handle && apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/members/by-handle/${handle}`);
      if (response.ok) {
        const member = await response.json() as { name?: string };
        donorDisplayName = member.name ?? null;
      }
    } catch {
      donorDisplayName = null;
    }
  }

  let donorLabel = "Doação anônima";
  if (isBusiness) {
    const cnpjLabel = companyData?.cnpj ? ` (CNPJ: ${formatDocument(companyData.cnpj)})` : "";
    donorLabel = companyData ? `${companyData.name}${cnpjLabel}` : meta.companyInfo?.name ?? "Empresa";
  } else if (donorDisplayName) {
    donorLabel = `${donorDisplayName} (@${handle})`;
  } else if (handle) {
    donorLabel = `@${handle}`;
  }

  await renderAndDownload({
    id: tx.id,
    donorLabel,
    donorHeading: isBusiness ? "Empresa Doadora" : "Doador",
    amountBRL: Number(tx.amount),
    paidAt: tx.createdAt,
    destination: tx.destinationAccount?.name ?? "—",
    typeLabel: meta.config.label,
    reference: meta.paymentIntentId ?? tx.referenceId ?? null,
    verifyUrl: `${normalizeSiteUrl(siteUrl)}/transparencia?tx=${tx.id}`,
    isTestMode: tx.description.includes("cs_test_") || tx.description.includes("pi_test_") || tx.referenceId?.startsWith("stripe-pi:pi_test_") || tx.referenceId?.startsWith("stripe-refund:pi_test_"),
  }, siteUrl);
}

export async function generateCompanyReceiptPdf(receipt: CompanyReceipt, siteUrl: string): Promise<void> {
  await renderAndDownload({
    id: receipt.donation.stripeInvoiceId,
    donorLabel: `${receipt.company.name} (CNPJ: ${receipt.company.cnpj})`,
    donorHeading: "Empresa Doadora",
    amountBRL: receipt.donation.amountBRL,
    paidAt: receipt.donation.paidAt,
    destination: receipt.beneficiary.name,
    typeLabel: `Doação Empresarial — Assinatura mensal (${receipt.donation.month})`,
    reference: receipt.donation.stripeInvoiceId,
    verifyUrl: `${normalizeSiteUrl(siteUrl)}/transparencia`,
    declaration: receipt.signatureStatement,
  }, siteUrl);
}
