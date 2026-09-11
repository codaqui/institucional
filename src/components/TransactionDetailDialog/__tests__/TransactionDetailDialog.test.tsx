import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TransactionDetailDialog from "../index";
import { generateReceiptPdf } from "../../DonationReceiptPdf";
import type { Transaction } from "../../../utils/transaction";

jest.mock("../../DonationReceiptPdf", () => ({
  __esModule: true,
  generateReceiptPdf: jest.fn(() => Promise.resolve()),
}));

const mockGenerateReceiptPdf = generateReceiptPdf as jest.Mock;

const ACCOUNT_ID = "acc-codaqui";
const API_URL = "http://localhost:3001";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-0000000000000001",
    amount: 100,
    description: "Movimentação de teste",
    createdAt: "2026-05-18T10:00:00.000Z",
    sourceAccount: { id: "ext-1", name: "Conta Externa" },
    destinationAccount: { id: ACCOUNT_ID, name: "Codaqui" },
    ...overrides,
  };
}

function renderDialog(tx: Transaction | null, onClose = jest.fn()) {
  return {
    onClose,
    ...render(
      <TransactionDetailDialog
        tx={tx}
        accountId={ACCOUNT_ID}
        apiUrl={API_URL}
        onClose={onClose}
      />,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis.fetch as any) = jest.fn(() =>
    Promise.resolve({ ok: false, status: 404, json: async () => ({}) }),
  );
});

describe("TransactionDetailDialog", () => {
  it("não renderiza nada quando tx é null", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza doação única de doador identificado e gera PDF", async () => {
    renderDialog(
      makeTx({
        amount: 1234.56,
        description: "Doação de @octocat via Stripe Checkout",
        referenceId: "pi_abc123",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Doação")).toBeInTheDocument();
    expect(within(dialog).getByText(/\+\s*R\$\s*1\.234,56/)).toBeInTheDocument();
    expect(within(dialog).getByText("@octocat")).toBeInTheDocument();
    expect(within(dialog).getByText("Pagamento único")).toBeInTheDocument();
    expect(within(dialog).getByText("Stripe Payments")).toBeInTheDocument();
    expect(within(dialog).getByText("Conta Externa")).toBeInTheDocument();
    expect(within(dialog).getByText("Codaqui")).toBeInTheDocument();

    const stripeChip = within(dialog).getByText(/Stripe: pi_abc123/);
    expect(stripeChip.closest("a")).toHaveAttribute(
      "href",
      "https://dashboard.stripe.com/payments/pi_abc123",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /Baixar comprovante PDF/i }));
    await waitFor(() => expect(mockGenerateReceiptPdf).toHaveBeenCalledTimes(1));
    expect(mockGenerateReceiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, apiUrl: API_URL, donorHandle: "@octocat" }),
    );
  });

  it("renderiza assinatura recorrente com chip de recorrência", async () => {
    renderDialog(
      makeTx({
        description: "Assinatura mensal de @maria via Stripe",
        referenceId: "pi_sub1",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Recorrente mensal")).toBeInTheDocument();
    expect(within(dialog).getByText("Assinatura recorrente (mensal)")).toBeInTheDocument();
  });

  it("renderiza doação anônima quando não há handle na descrição", async () => {
    renderDialog(
      makeTx({ description: "Doação via Stripe", referenceId: "cs_checkout1" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Doação anônima")).toBeInTheDocument();
  });

  it("renderiza doação empresarial enriquecida com dados públicos da empresa", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url === `${API_URL}/companies/company-1/public`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "company-1",
            name: "Kodak LTDA",
            cnpj: "44593429000105",
            logoUrl: "https://img/logo.png",
            websiteUrl: "https://kodak.com/",
            responsibleGithubHandle: "ownergh",
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderDialog(
      makeTx({
        description: "Assinatura mensal empresarial — Empresa: Kodak [company-1] — Sessão in_123",
        referenceId: "pi_biz1",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Kodak LTDA")).toBeInTheDocument();
    expect(within(dialog).getByText("Empresa Doadora")).toBeInTheDocument();
    expect(within(dialog).getByText("kodak.com")).toBeInTheDocument();
    expect(within(dialog).getByText("@ownergh")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Assinatura recorrente mensal (CLUB Business)"),
    ).toBeInTheDocument();
  });

  it("renderiza reembolso com solicitante, aprovador e comprovantes", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url === `${API_URL}/reimbursements/public/reimb-1`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "reimb-1",
            status: "paid",
            amount: 250,
            description: "Cabos HDMI para evento",
            receiptUrl: "https://receipt.example.com/nota.pdf",
            internalReceiptUrl: "https://drive.google.com/copia",
            accountName: "DevParaná",
            requester: { handle: "ana", name: "Ana", avatarUrl: "https://av/ana" },
            approver: { handle: "bob", name: "Bob", avatarUrl: "https://av/bob" },
            reviewNote: "Aprovado conforme nota fiscal",
            reviewedAt: "2026-05-19T10:00:00.000Z",
            createdAt: "2026-05-18T10:00:00.000Z",
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderDialog(
      makeTx({
        description: "Reembolso aprovado: Cabos HDMI para evento",
        referenceId: "reimbursement:reimb-1",
        sourceAccount: { id: ACCOUNT_ID, name: "Codaqui" },
        destinationAccount: { id: "ext-ana", name: "Ana (externo)" },
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Reembolso")).toBeInTheDocument();
    expect(within(dialog).getByText(/−\s*R\$\s*100,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/"Cabos HDMI para evento"/)).toBeInTheDocument();
    expect(await within(dialog).findByText("@ana")).toBeInTheDocument();
    expect(within(dialog).getByText("@bob")).toBeInTheDocument();
    expect(within(dialog).getByText(/"Aprovado conforme nota fiscal"/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Comprovante original/i }),
    ).toHaveAttribute("href", "https://receipt.example.com/nota.pdf");
    expect(within(dialog).getByRole("link", { name: /Cópia interna/i })).toHaveAttribute(
      "href",
      "https://drive.google.com/copia",
    );
  });

  it("tolera falha na busca de dados do reembolso", async () => {
    renderDialog(
      makeTx({
        description: "Reembolso aprovado: Taxi",
        referenceId: "reimbursement:reimb-404",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/"Taxi"/)).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(within(dialog).queryByText("Solicitado por")).not.toBeInTheDocument();
  });

  it("renderiza pagamento a fornecedor com cartão, data e registrado por", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/vendors/payments/by-reference/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "vp-1",
            amount: 10000,
            description: "Banner do evento",
            receiptUrl: "https://receipt.example.com/banner.pdf",
            internalReceiptUrl: null,
            occurredAt: "2026-05-10T10:00:00.000Z",
            vendor: {
              name: "PrintShop",
              document: "44593429000105",
              website: "https://printshop.com/",
            },
            registeredBy: { name: "End", avatarUrl: "https://av/end", githubHandle: "end" },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderDialog(
      makeTx({
        description: "Pagamento a fornecedor PrintShop — Banner do evento",
        referenceId: "vendor-payment:vp-1",
        sourceAccount: { id: ACCOUNT_ID, name: "Codaqui" },
        destinationAccount: { id: "ext-vendor", name: "PrintShop (externo)" },
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Pagamento a Fornecedor")).toBeInTheDocument();
    expect(await within(dialog).findByText("Pago a")).toBeInTheDocument();
    expect(within(dialog).getByText("PrintShop")).toBeInTheDocument();
    expect(within(dialog).getByText("44.593.429/0001-05")).toBeInTheDocument();
    expect(within(dialog).getByText("printshop.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Data do pagamento")).toBeInTheDocument();
    expect(within(dialog).getByText("Banner do evento")).toBeInTheDocument();
    expect(within(dialog).getByText("Registrado por")).toBeInTheDocument();
    expect(within(dialog).getByText("@end")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Comprovante original/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: /Cópia interna/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza recebimento de fornecedor consultando endpoint de receipts", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/vendors/receipts/by-reference/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "vr-1",
            amount: 50000,
            description: "Repasse de ingressos",
            receiptUrl: null,
            internalReceiptUrl: "https://drive.google.com/repasse",
            occurredAt: "2026-05-11T10:00:00.000Z",
            vendor: { name: "Sympla", document: null, website: null },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderDialog(
      makeTx({
        description: "Recebimento de fornecedor Sympla — Repasse de ingressos",
        referenceId: "vendor-receipt:vr-1",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Recebimento de Fornecedor")).toBeInTheDocument();
    expect(await within(dialog).findByText("Recebido de")).toBeInTheDocument();
    expect(within(dialog).getByText("Sympla")).toBeInTheDocument();
    expect(within(dialog).getByText("Data do recebimento")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/vendors/receipts/by-reference/${encodeURIComponent("vendor-receipt:vr-1")}`,
    );
  });

  it("renderiza transferência interna com justificativa", async () => {
    renderDialog(
      makeTx({
        description: "Transferência interna aprovada: Ajuste de caixa DevParaná",
        referenceId: "transfer:t-9",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Transferência Interna")).toBeInTheDocument();
    expect(within(dialog).getByText("Justificativa da transferência")).toBeInTheDocument();
    expect(within(dialog).getByText(/"Ajuste de caixa DevParaná"/)).toBeInTheDocument();
  });

  it("renderiza taxa Stripe com charge, balance transaction e link do painel", async () => {
    renderDialog(
      makeTx({
        amount: 5.39,
        description: "Taxa Stripe — Charge ch_999 (referente a pi_777)",
        referenceId: "stripe-fee:txn_123",
        sourceAccount: { id: ACCOUNT_ID, name: "Codaqui" },
        destinationAccount: { id: "ext-stripe", name: "Stripe (externo)" },
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Taxa Stripe")).toBeInTheDocument();
    expect(within(dialog).getByText("Por que essa taxa?")).toBeInTheDocument();
    expect(within(dialog).getByText("pi_777")).toBeInTheDocument();
    expect(within(dialog).getByText("ch_999")).toBeInTheDocument();
    expect(within(dialog).getByText("txn_123")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Ver no Stripe/i })).toHaveAttribute(
      "href",
      "https://dashboard.stripe.com/payments/pi_777",
    );
  });

  it("renderiza ingresso de evento com metadados e link para página do evento", async () => {
    renderDialog(
      makeTx({
        description: "Ingresso vendido",
        referenceId: "event-ticket:order-1",
        metadata: {
          eventTitle: "DevPR 2026",
          eventKey: "meetup:devparana:123",
          ticketName: "Lote 1",
          payerHandle: "joao",
          orderId: "order-1",
        },
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ingresso de Evento")).toBeInTheDocument();
    expect(within(dialog).getByText("DevPR 2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Lote 1")).toBeInTheDocument();
    expect(within(dialog).getByText("@joao")).toBeInTheDocument();
    expect(within(dialog).getByText("order-1")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "meetup:devparana:123" }),
    ).toHaveAttribute("href", "/eventos/meetup/devparana/123");
  });

  it("renderiza movimentação genérica sem referência externa", async () => {
    renderDialog(makeTx({ description: "Ajuste manual do tesoureiro" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Movimentação")).toBeInTheDocument();
    expect(within(dialog).getByText("Ajuste manual do tesoureiro")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Sem referência externa vinculada."),
    ).toBeInTheDocument();
  });

  it("chama onClose ao clicar no botão fechar", async () => {
    const { onClose } = renderDialog(makeTx());

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
