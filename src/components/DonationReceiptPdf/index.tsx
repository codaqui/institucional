/**
 * DonationReceiptPdf
 * Renderiza um recibo de doação em um elemento invisível e faz download
 * como PDF via jsPDF + html2canvas.
 *
 * Uso: chame generateReceiptPdf(tx, accountId, siteUrl)
 */
import React from "react";
import type { Transaction } from "../../utils/transaction";
import {
  deriveTransactionMeta,
  formatBRL,
  formatDate,
} from "../../utils/transaction";
import { formatDocument } from "../../utils/document";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ReceiptData {
  tx: Transaction;
  accountId: string;
  siteUrl: string;
  /** API base URL — usado para buscar nome de exibição do doador PF */
  apiUrl?: string;
  /** Dados da empresa para doações PJ */
  companyData?: { name: string; cnpj: string | null } | null;
  /** GitHub handle do doador PF (sem @) */
  donorHandle?: string;
}

// ─── Gerador de PDF ──────────────────────────────────────────────────────────

export async function generateReceiptPdf(
  { tx, accountId, siteUrl, apiUrl, companyData, donorHandle: donorHandleProp }: ReceiptData
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const meta = deriveTransactionMeta(tx, accountId);
  const verifyUrl = `${siteUrl}/transparencia?tx=${tx.id}`;
  const isBusiness = meta.type === "donation-business";

  // Fetch member display name for PF donation
  let donorDisplayName: string | null = null;
  const handle = donorHandleProp ?? meta.donorHandle?.replace("@", "");
  if (!isBusiness && handle && apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/members/by-handle/${handle}`);
      if (res.ok) {
        const data = await res.json();
        donorDisplayName = data.name ?? null;
      }
    } catch {
      // Non-blocking — use handle as fallback
    }
  }

  // Monta elemento temporário fora do viewport
  const container = document.createElement("div");
  container.id = "__receipt_pdf_container__";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";   // A4 width @ 96dpi
  container.style.minHeight = "auto";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  // Importa QRCode no browser
  const QRCode = (await import("qrcode.react")).QRCodeSVG;
  const ReactDOM = await import("react-dom/client");
  const { createElement } = await import("react");

  // Componente do recibo
  const ReceiptContent = () => {
    const isTestMode =
      tx.description?.includes("pi_test_") ||
      tx.referenceId?.startsWith("stripe-pi:pi_test_") ||
      tx.referenceId?.startsWith("stripe-refund:pi_test_") ||
      false;

    // Donor line: PJ = "Empresa (CNPJ: XX.XXX/XXXX-XX)" | PF = "Nome (@handle)"
    let donorLabel = "Doação anônima";
    if (isBusiness) {
      if (companyData) {
        const cnpjLabel = companyData.cnpj ? ` (CNPJ: ${formatDocument(companyData.cnpj)})` : "";
        donorLabel = `${companyData.name}${cnpjLabel}`;
      } else {
        donorLabel = meta.companyInfo?.name ?? "Empresa";
      }
    } else if (donorDisplayName) {
      donorLabel = `${donorDisplayName} (@${handle})`;
    } else if (handle) {
      donorLabel = `@${handle}`;
    }

    return createElement(
      "div",
      {
        style: {
          fontFamily: "'Segoe UI', Arial, sans-serif",
          padding: "40px 48px",
          color: "#1a1a1a",
          fontSize: "13px",
          lineHeight: "1.5",
          width: "794px",
          boxSizing: "border-box" as const,
        },
      },
      // Header
      createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "3px solid #22c55e",
            paddingBottom: "16px",
            marginBottom: "24px",
          },
        },
        createElement(
          "div",
          null,
          createElement("img", {
            src: `${siteUrl}/img/logo.png`,
            alt: "Codaqui",
            style: { height: "40px", display: "block" },
            onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            },
          }),
          createElement(
            "div",
            { style: { marginTop: "4px", color: "#6b7280", fontSize: "11px" } },
            "Associação Codaqui — CNPJ 44.593.429/0001-05"
          )
        ),
        createElement(
          "div",
          { style: { textAlign: "right" } },
          createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "700", color: "#22c55e" } },
            "COMPROVANTE DE DOAÇÃO"
          ),
          isTestMode &&
            createElement(
              "div",
              {
                style: {
                  fontSize: "11px",
                  color: "#ef4444",
                  fontWeight: "600",
                  marginTop: "2px",
                },
              },
              "⚠ MODO TESTE — não é um pagamento real"
            )
        )
      ),
      // Valor em destaque
      createElement(
        "div",
        {
          style: {
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          },
        },
        createElement(
          "div",
          null,
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px" } },
            "Valor doado"
          ),
          createElement(
            "div",
            { style: { fontSize: "28px", fontWeight: "800", color: "#16a34a" } },
            formatBRL(Number(tx.amount))
          )
        ),
        createElement(
          "div",
          { style: { textAlign: "right" } },
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px" } },
            "Data"
          ),
          createElement(
            "div",
            { style: { fontWeight: "600" } },
            formatDate(tx.createdAt)
          )
        )
      ),
      // Detalhes
      createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "20px",
          },
        },
        // Destinatário
        createElement(
          "div",
          {
            style: {
              background: "#f9fafb",
              borderRadius: "6px",
              padding: "12px 14px",
            },
          },
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px", marginBottom: "2px" } },
            "Destinatário"
          ),
          createElement(
            "div",
            { style: { fontWeight: "600" } },
            tx.destinationAccount?.name ?? "—"
          )
        ),
        // Intermediário
        createElement(
          "div",
          {
            style: {
              background: "#f9fafb",
              borderRadius: "6px",
              padding: "12px 14px",
            },
          },
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px", marginBottom: "2px" } },
            "Intermediário"
          ),
          createElement(
            "div",
            { style: { fontWeight: "600" } },
            "Stripe Payments"
          )
        ),
        // Tipo
        createElement(
          "div",
          {
            style: {
              background: "#f9fafb",
              borderRadius: "6px",
              padding: "12px 14px",
            },
          },
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px", marginBottom: "2px" } },
            "Tipo"
          ),
          createElement(
            "div",
            { style: { fontWeight: "600" } },
            meta.config.label
          )
        ),
        // Doador / Empresa
        createElement(
          "div",
          {
            style: {
              background: "#f9fafb",
              borderRadius: "6px",
              padding: "12px 14px",
            },
          },
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px", marginBottom: "2px" } },
            isBusiness ? "Empresa Doadora" : "Doador"
          ),
          createElement(
            "div",
            { style: { fontWeight: "600", wordBreak: "break-all" } },
            donorLabel
          )
        )
      ),
      // ID de referência Stripe
      meta.paymentIntentId &&
        createElement(
          "div",
          {
            style: {
              background: "#fafafa",
              borderRadius: "6px",
              padding: "10px 14px",
              marginBottom: "20px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#374151",
            },
          },
          createElement(
            "span",
            { style: { color: "#6b7280" } },
            "ID Stripe: "
          ),
          meta.paymentIntentId
        ),
      // QR Code + URL de verificação
      createElement(
        "div",
        {
          style: {
            borderTop: "1px solid #e5e7eb",
            paddingTop: "20px",
            display: "flex",
            gap: "24px",
            alignItems: "flex-start",
          },
        },
        createElement(QRCode as React.ComponentType<{ value: string; size: number; level: string }>, {
          value: verifyUrl,
          size: 80,
          level: "M",
        }),
        createElement(
          "div",
          { style: { flex: 1 } },
          createElement(
            "div",
            { style: { fontWeight: "600", marginBottom: "4px" } },
            "Verificação de autenticidade"
          ),
          createElement(
            "div",
            { style: { color: "#6b7280", fontSize: "11px", wordBreak: "break-all" } },
            "Acesse o QR Code ou o link abaixo para confirmar esta transação na página de transparência pública."
          ),
          createElement(
            "div",
            {
              style: {
                color: "#22c55e",
                fontSize: "11px",
                marginTop: "4px",
                wordBreak: "break-all",
              },
            },
            verifyUrl
          ),
          createElement(
            "div",
            {
              style: {
                color: "#9ca3af",
                fontSize: "10px",
                marginTop: "8px",
              },
            },
            `ID da transação: ${tx.id}`
          )
        )
      )
    );
  };

  const root = ReactDOM.createRoot(container);
  root.render(createElement(ReceiptContent, null));

  // Aguarda renderização
  await new Promise<void>((resolve) => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });

    // A4: 210 x 297 mm. Calculamos a altura proporcional.
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const imgWidthMm = A4_WIDTH_MM;
    const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

    // Se o conteúdo couber em A4, usamos o tamanho fixo; caso contrário, expandimos.
    const pdfHeight = Math.max(imgHeightMm, A4_HEIGHT_MM);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [A4_WIDTH_MM, pdfHeight],
    });

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm);

    const filename = `comprovante-doacao-${tx.id.slice(0, 8)}.pdf`;
    pdf.save(filename);
  } finally {
    root.unmount();
    container.remove();
  }
}
