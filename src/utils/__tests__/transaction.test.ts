import {
  formatBRL,
  formatDate,
  detectTxType,
  deriveTransactionMeta,
  extractDonorHandle,
  extractReimbursementDesc,
  type Transaction,
} from "../transaction";

// ---------------------------------------------------------------------------
// formatBRL
// ---------------------------------------------------------------------------

describe("formatBRL", () => {
  it("formats positive values as BRL", () => {
    expect(formatBRL(1234.5)).toBe("R$\u00a01.234,50");
  });

  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$\u00a00,00");
  });

  it("formats negative values", () => {
    expect(formatBRL(-99.9)).toBe("-R$\u00a099,90");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("formats an ISO date string to pt-BR", () => {
    const result = formatDate("2024-07-22T14:30:00Z");
    // Should contain day/month/year
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

// ---------------------------------------------------------------------------
// detectTxType
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    amount: 100,
    description: "",
    createdAt: "2024-01-01T00:00:00Z",
    sourceAccount: { id: "src", name: "Source" },
    destinationAccount: { id: "dst", name: "Dest" },
    ...overrides,
  };
}

describe("detectTxType", () => {
  it.each<[string, Partial<Transaction>, ReturnType<typeof detectTxType>]>([
    ["detects reimbursement by referenceId", { referenceId: "reimbursement:123" }, "reimbursement"],
    ["detects vendor-payment by referenceId", { referenceId: "vendor-payment:456" }, "vendor-payment"],
    ["detects transfer by referenceId", { referenceId: "transfer:789" }, "transfer"],
    ["detects donation by Stripe checkout session referenceId", { referenceId: "cs_live_abc" }, "donation"],
    ["detects donation by Stripe payment intent referenceId (pi_)", { referenceId: "pi_live_abc" }, "donation"],
    ["detects donation by Stripe invoice referenceId (in_)", { referenceId: "in_live_abc" }, "donation"],
    ["detects donation by description", { description: "Doação de @user" }, "donation"],
    ["detects monthly subscription as donation by description", { description: "Assinatura mensal de @user [id] — Sessão in_xxx" }, "donation"],
    ["detects annual subscription as donation by description", { description: "Assinatura anual de @user [id] — Sessão in_xxx" }, "donation"],
    ["detects vendor-payment by description", { description: "Pagamento a fornecedor XYZ" }, "vendor-payment"],
    ["detects reimbursement by description", { description: "Reembolso aprovado: compra" }, "reimbursement"],
    ["detects transfer by description", { description: "Transferência interna aprovada: teste" }, "transfer"],
    ["detects refund by referenceId (re_)", { referenceId: "re_3TSH3JFtPCSoiGky18dl80ut" }, "refund"],
    ["detects refund by description (Estorno)", { description: "Estorno de doação — Refund re_xxx" }, "refund"],
    ["returns other for unknown transactions", { description: "Something else" }, "other"],
  ])("%s", (_label, overrides, expected) => {
    expect(detectTxType(makeTx(overrides))).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// extractDonorHandle
// ---------------------------------------------------------------------------

describe("extractDonorHandle", () => {
  it("extracts GitHub handle from donation description", () => {
    expect(extractDonorHandle("Doação de @john-doe")).toBe("@john-doe");
  });

  it("extracts GitHub handle from monthly subscription description", () => {
    expect(extractDonorHandle("Assinatura mensal de @john-doe [id] — Sessão in_xxx")).toBe("@john-doe");
  });

  it("extracts GitHub handle from annual subscription description", () => {
    expect(extractDonorHandle("Assinatura anual de @jane.doe")).toBe("@jane.doe");
  });

  it("returns null when no handle found", () => {
    expect(extractDonorHandle("Random text")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractReimbursementDesc
// ---------------------------------------------------------------------------

describe("extractReimbursementDesc", () => {
  it("strips reimbursement prefix", () => {
    expect(extractReimbursementDesc("Reembolso aprovado: compra de material")).toBe("compra de material");
  });

  it("returns original text when prefix not present", () => {
    expect(extractReimbursementDesc("Some other text")).toBe("Some other text");
  });
});

// ---------------------------------------------------------------------------
// deriveTransactionMeta
// ---------------------------------------------------------------------------

describe("deriveTransactionMeta", () => {
  it("marks as credit when destination matches accountId", () => {
    const tx = makeTx({ description: "Doação de @user" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.isCredit).toBe(true);
    expect(meta.type).toBe("donation");
    expect(meta.donorHandle).toBe("@user");
  });

  it("marks as debit when source matches accountId", () => {
    const tx = makeTx({ description: "Doação de @user" });
    const meta = deriveTransactionMeta(tx, "src");
    expect(meta.isCredit).toBe(false);
  });

  it("detects subscription", () => {
    const tx = makeTx({ description: "Doação de @user - assinatura mensal", referenceId: "cs_live_x" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.isSubscription).toBe(true);
    expect(meta.subscriptionInterval).toBe("mensal");
  });

  it("detects annual subscription", () => {
    const tx = makeTx({ description: "Doação de @user - assinatura anual", referenceId: "cs_live_x" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.isSubscription).toBe(true);
    expect(meta.subscriptionInterval).toBe("anual");
  });

  it("builds stripe dashboard URL for payment intents", () => {
    const tx = makeTx({ referenceId: "pi_abc123", description: "Doação de @user" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.stripeDashboardUrl).toBe("https://dashboard.stripe.com/payments/pi_abc123");
  });

  it("detects test mode stripe URL", () => {
    const tx = makeTx({ referenceId: "pi_test", description: "cs_test_ doação" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.stripeDashboardUrl).toBe("https://dashboard.stripe.com/test/payments/pi_test");
  });

  it("extracts reimbursement description", () => {
    const tx = makeTx({ referenceId: "reimbursement:1", description: "Reembolso aprovado: compra" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.reimbDesc).toBe("compra");
  });

  it("extracts transfer reason", () => {
    const tx = makeTx({ referenceId: "transfer:1", description: "Transferência interna aprovada: motivo" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.isTransfer).toBe(true);
    expect(meta.transferReason).toBe("motivo");
  });
});

// ---------------------------------------------------------------------------
// stripe-fee — type detection + meta extraction
// ---------------------------------------------------------------------------

describe("stripe-fee detection", () => {
  it("detects stripe-fee via referenceId prefix", () => {
    const tx = makeTx({
      referenceId: "stripe-fee:txn_abc123",
      description: "Taxa Stripe — Charge ch_xyz (referente a pi_999)",
    });
    expect(detectTxType(tx)).toBe("stripe-fee");
  });

  it("detects stripe-fee via description fallback (no referenceId)", () => {
    const tx = makeTx({
      referenceId: undefined,
      description: "Taxa Stripe — Charge ch_only_desc (referente a pi_999)",
    });
    expect(detectTxType(tx)).toBe("stripe-fee");
  });

  it("does not classify regular donations as stripe-fee", () => {
    const tx = makeTx({ referenceId: "pi_abc", description: "Doação de @user" });
    expect(detectTxType(tx)).toBe("donation");
  });
});

describe("deriveTransactionMeta — stripe-fee", () => {
  const buildFeeTx = (overrides: Partial<Transaction> = {}): Transaction =>
    makeTx({
      id: "tx-fee",
      amount: 1.99,
      referenceId: "stripe-fee:txn_3TSNi9CBtDeABDbg1ROo8zyg",
      description:
        "Taxa Stripe — Charge ch_3TSNi9CBtDeABDbg1edtfD4k (referente a pi_3TSNi9CBtDeABDbg1DrlIisO)",
      ...overrides,
    });

  it("extracts balance transaction id from referenceId", () => {
    const meta = deriveTransactionMeta(buildFeeTx(), "dst");
    expect(meta.type).toBe("stripe-fee");
    expect(meta.stripeFeeBalanceTransactionId).toBe(
      "txn_3TSNi9CBtDeABDbg1ROo8zyg",
    );
  });

  it("extracts charge id from description", () => {
    const meta = deriveTransactionMeta(buildFeeTx(), "dst");
    expect(meta.stripeFeeChargeId).toBe("ch_3TSNi9CBtDeABDbg1edtfD4k");
  });

  it("extracts original payment intent id from description", () => {
    const meta = deriveTransactionMeta(buildFeeTx(), "dst");
    expect(meta.stripeFeeOriginalPaymentIntentId).toBe(
      "pi_3TSNi9CBtDeABDbg1DrlIisO",
    );
  });

  it("builds Stripe dashboard URL for the original PI (live mode)", () => {
    const meta = deriveTransactionMeta(buildFeeTx(), "dst");
    expect(meta.stripeFeeOriginalDashboardUrl).toBe(
      "https://dashboard.stripe.com/payments/pi_3TSNi9CBtDeABDbg1DrlIisO",
    );
  });

  it("builds Stripe dashboard URL with /test/ when description contains pi_test_", () => {
    const tx = buildFeeTx({
      description:
        "Taxa Stripe — Charge ch_test_xyz (referente a pi_test_abc123)",
    });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.stripeFeeOriginalDashboardUrl).toBe(
      "https://dashboard.stripe.com/test/payments/pi_test_abc123",
    );
  });

  it("returns null fee fields for non-stripe-fee transactions", () => {
    const tx = makeTx({ referenceId: "pi_abc", description: "Doação de @user" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.stripeFeeBalanceTransactionId).toBeNull();
    expect(meta.stripeFeeChargeId).toBeNull();
    expect(meta.stripeFeeOriginalPaymentIntentId).toBeNull();
    expect(meta.stripeFeeOriginalDashboardUrl).toBeNull();
  });

  it("handles malformed description gracefully (missing charge / pi)", () => {
    const tx = buildFeeTx({ description: "Taxa Stripe — descrição corrompida" });
    const meta = deriveTransactionMeta(tx, "dst");
    expect(meta.type).toBe("stripe-fee");
    expect(meta.stripeFeeChargeId).toBeNull();
    expect(meta.stripeFeeOriginalPaymentIntentId).toBeNull();
    expect(meta.stripeFeeOriginalDashboardUrl).toBeNull();
    // BT id ainda é extraído via referenceId
    expect(meta.stripeFeeBalanceTransactionId).toBe(
      "txn_3TSNi9CBtDeABDbg1ROo8zyg",
    );
  });

  it("marks as debit when community is the source (fee leaves community)", () => {
    const tx = buildFeeTx({
      sourceAccount: { id: "acc-community", name: "Comunidade" },
      destinationAccount: { id: "acc-stripe-fees", name: "Stripe Fees" },
    });
    const meta = deriveTransactionMeta(tx, "acc-community");
    expect(meta.isCredit).toBe(false);
  });
});
