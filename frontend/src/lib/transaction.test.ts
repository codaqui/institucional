import { describe, it, expect } from "vitest";
import {
  formatBRL,
  formatDate,
  parseBrlInput,
  detectTxType,
  deriveTransactionMeta,
  extractDonorHandle,
  extractReimbursementDesc,
  extractReimbursementId,
  extractStripePaymentIntentId,
  extractCompanyInfo,
  TX_TYPE_CONFIG,
  type Transaction,
} from "./transaction";

const baseTx: Transaction = {
  id: "tx-1",
  amount: 100,
  description: "",
  createdAt: "2026-01-15T12:00:00.000Z",
  sourceAccount: { id: "acc-a", name: "A" },
  destinationAccount: { id: "acc-b", name: "B" },
};

describe("formatBRL", () => {
  it("formata valor em reais com separadores pt-BR", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });
  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
  it("formata negativo", () => {
    expect(formatBRL(-50)).toBe("-R$ 50,00");
  });
});

describe("formatDate", () => {
  it("formata ISO para pt-BR com data e hora", () => {
    const out = formatDate("2026-03-05T15:30:00.000Z");
    expect(out).toMatch(/05\/03\/2026/);
  });
});

describe("parseBrlInput", () => {
  it("aceita formato pt-BR com vírgula", () => {
    expect(parseBrlInput("1.234,56")).toBe(1234.56);
  });
  it("aceita formato US com ponto", () => {
    expect(parseBrlInput("1234.56")).toBe(1234.56);
  });
  it("rejeita vazio, inválido e negativo", () => {
    expect(parseBrlInput("")).toBeNull();
    expect(parseBrlInput("abc")).toBeNull();
    expect(parseBrlInput("-10")).toBeNull();
  });
});

describe("detectTxType", () => {
  const cases: Array<[string | undefined, string, string]> = [
    ["stripe-pi:pi_123", "", "donation"],
    ["pi_123", "", "donation"],
    ["cs_123", "", "donation"],
    ["in_123", "", "donation"],
    ["re_123", "", "refund"],
    ["stripe-refund:pi_123:re_123", "", "refund"],
    ["stripe-fee:txn_123", "", "stripe-fee"],
    ["reimbursement:uuid-1", "", "reimbursement"],
    ["reimbursement-reversal:uuid-1:123", "", "reimbursement-reversal"],
    ["reimbursement-deletion:uuid-1", "", "reimbursement-reversal"],
    ["vendor-payment:uuid-1", "", "vendor-payment"],
    ["vendor-payment-reversal:uuid-1:123", "", "vendor-payment-reversal"],
    ["vendor-receipt:uuid-1", "", "vendor-receipt"],
    ["vendor-receipt-reversal:uuid-1:123", "", "vendor-receipt-reversal"],
    ["transfer:uuid-1", "", "transfer"],
    ["event-ticket:order-1", "", "event-ticket"],
    ["event-ticket-refund:order-1:123", "", "event-ticket-refund"],
    [undefined, "", "other"],
  ];

  it.each(cases)("referenceId=%s → %s", (referenceId, description, expected) => {
    expect(detectTxType({ ...baseTx, referenceId, description })).toBe(expected);
  });

  it("detecta doação empresarial pela descrição (Empresa:)", () => {
    expect(
      detectTxType({
        ...baseTx,
        referenceId: "pi_123",
        description: "Assinatura mensal empresarial — Empresa: ACME [uuid]",
      }),
    ).toBe("donation-business");
  });

  it("cai na descrição quando não há referenceId conhecido", () => {
    expect(
      detectTxType({ ...baseTx, description: "Doação de @fulano" }),
    ).toBe("donation");
    expect(
      detectTxType({ ...baseTx, description: "Reembolso aprovado: taxi" }),
    ).toBe("reimbursement");
    expect(
      detectTxType({ ...baseTx, description: "Estorno da doação" }),
    ).toBe("refund");
    expect(
      detectTxType({ ...baseTx, description: "Assinatura empresarial" }),
    ).toBe("donation-business");
  });

  it("reversal vem antes do prefixo base (event-ticket-refund vs event-ticket)", () => {
    expect(
      detectTxType({ ...baseTx, referenceId: "event-ticket-refund:order-9:1" }),
    ).toBe("event-ticket-refund");
  });
});

describe("TX_TYPE_CONFIG", () => {
  it("cobre todos os tipos com label, token de cor --cq-* e ícone string", () => {
    const types = [
      "donation", "donation-business", "reimbursement", "reimbursement-reversal",
      "transfer", "vendor-payment", "vendor-payment-reversal", "vendor-receipt",
      "vendor-receipt-reversal", "refund", "stripe-fee", "event-ticket",
      "event-ticket-refund", "other",
    ] as const;
    for (const type of types) {
      const cfg = TX_TYPE_CONFIG[type];
      expect(cfg.label).toBeTruthy();
      expect(cfg.colorToken).toMatch(/^--cq-/);
      expect(typeof cfg.icon).toBe("string");
    }
  });

  it("labels preservados do original", () => {
    expect(TX_TYPE_CONFIG.donation.label).toBe("Doação");
    expect(TX_TYPE_CONFIG["event-ticket"].label).toBe("Ingresso de Evento");
    expect(TX_TYPE_CONFIG.other.label).toBe("Movimentação");
  });
});

describe("extractors", () => {
  it("extractDonorHandle captura @handle de doação e assinatura", () => {
    expect(extractDonorHandle("Doação de @endersonmenezes")).toBe("@endersonmenezes");
    expect(extractDonorHandle("Assinatura mensal de @ana.dev")).toBe("@ana.dev");
    expect(extractDonorHandle("Outro texto")).toBeNull();
  });

  it("extractReimbursementDesc remove o prefixo", () => {
    expect(extractReimbursementDesc("Reembolso aprovado: taxi aeroporto")).toBe(
      "taxi aeroporto",
    );
  });

  it("extractReimbursementId extrai o id do referenceId", () => {
    expect(extractReimbursementId("reimbursement:uuid-9")).toBe("uuid-9");
    expect(extractReimbursementId("transfer:uuid-9")).toBeNull();
    expect(extractReimbursementId(undefined)).toBeNull();
  });

  it("extractStripePaymentIntentId aceita stripe-pi: e pi_ direto", () => {
    expect(extractStripePaymentIntentId("stripe-pi:pi_123")).toBe("pi_123");
    expect(extractStripePaymentIntentId("pi_123")).toBe("pi_123");
    expect(extractStripePaymentIntentId("transfer:x")).toBeNull();
  });

  it("extractCompanyInfo extrai nome e id do formato Empresa: Nome [id]", () => {
    expect(
      extractCompanyInfo("Assinatura mensal empresarial — Empresa: ACME Ltda [uuid-1] — Sessão in_1"),
    ).toEqual({ name: "ACME Ltda", id: "uuid-1" });
    expect(extractCompanyInfo("Doação de @x")).toBeNull();
  });
});

describe("deriveTransactionMeta", () => {
  it("marca crédito quando a conta de destino é a consultada", () => {
    const meta = deriveTransactionMeta(
      { ...baseTx, referenceId: "stripe-pi:pi_1", description: "Doação de @ana" },
      "acc-b",
    );
    expect(meta.type).toBe("donation");
    expect(meta.isCredit).toBe(true);
    expect(meta.donorHandle).toBe("@ana");
    expect(meta.config.label).toBe("Doação");
  });

  it("monta URL do dashboard Stripe (modo teste com pi_test_)", () => {
    const meta = deriveTransactionMeta(
      { ...baseTx, referenceId: "stripe-pi:pi_test_123", description: "Doação" },
      "acc-a",
    );
    expect(meta.isCredit).toBe(false);
    expect(meta.stripeDashboardUrl).toBe(
      "https://dashboard.stripe.com/test/payments/pi_test_123",
    );
  });

  it("extrai motivo de transferência", () => {
    const meta = deriveTransactionMeta(
      {
        ...baseTx,
        referenceId: "transfer:uuid-1",
        description: "Transferência interna aprovada: rateio do evento",
      },
      "acc-a",
    );
    expect(meta.isTransfer).toBe(true);
    expect(meta.transferReason).toBe("rateio do evento");
  });

  it("extrai dados de taxa Stripe (charge + pi original)", () => {
    const meta = deriveTransactionMeta(
      {
        ...baseTx,
        referenceId: "stripe-fee:txn_1",
        description: "Taxa Stripe — Charge ch_9 (referente a pi_9)",
      },
      "acc-a",
    );
    expect(meta.type).toBe("stripe-fee");
    expect(meta.stripeFeeBalanceTransactionId).toBe("txn_1");
    expect(meta.stripeFeeChargeId).toBe("ch_9");
    expect(meta.stripeFeeOriginalPaymentIntentId).toBe("pi_9");
    expect(meta.stripeFeeOriginalDashboardUrl).toBe(
      "https://dashboard.stripe.com/payments/pi_9",
    );
  });

  it("extrai eventTicketInfo do metadata para ingressos", () => {
    const meta = deriveTransactionMeta(
      {
        ...baseTx,
        referenceId: "event-ticket:order-1",
        description: "Ingresso",
        metadata: { eventTitle: "DevPR Conf", orderId: "order-1" },
      },
      "acc-b",
    );
    expect(meta.type).toBe("event-ticket");
    expect(meta.eventTicketInfo?.eventTitle).toBe("DevPR Conf");
    expect(meta.eventTicketInfo?.orderId).toBe("order-1");
  });
});
