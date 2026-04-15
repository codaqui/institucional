import React from "react";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionAccount {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  referenceId?: string;
  sourceAccount: TransactionAccount;
  destinationAccount: TransactionAccount;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

export interface TransparencyStats {
  totalReceived: number;
  totalExpenses: number;
  totalTransactions: number;
  uniqueDonors: number;
  recentDonors: Array<{
    handle: string;
    communityName: string;
    date: string;
    amount: number;
  }>;
  communityStats: Array<{
    projectKey: string;
    name: string;
    totalIn: number;
    totalOut: number;
    txCount: number;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ---------------------------------------------------------------------------
// Transaction type detection
// ---------------------------------------------------------------------------

export type TxType = "donation" | "reimbursement" | "transfer" | "vendor-payment" | "other";

export function detectTxType(tx: Transaction): TxType {
  if (tx.referenceId?.startsWith("reimbursement:")) return "reimbursement";
  if (tx.referenceId?.startsWith("vendor-payment:")) return "vendor-payment";
  if (tx.referenceId?.startsWith("transfer:")) return "transfer";
  if (tx.referenceId?.startsWith("cs_")) return "donation";
  if (tx.description?.toLowerCase().startsWith("doação")) return "donation";
  if (tx.description?.toLowerCase().startsWith("pagamento a fornecedor")) return "vendor-payment";
  if (tx.description?.toLowerCase().startsWith("reembolso")) return "reimbursement";
  if (tx.description?.toLowerCase().startsWith("transfer")) return "transfer";
  return "other";
}

export const TX_TYPE_CONFIG: Record<
  TxType,
  { label: string; color: "success" | "warning" | "info" | "default" | "secondary"; icon: React.ReactElement }
> = {
  donation: { label: "Doação", color: "success", icon: <VolunteerActivismIcon fontSize="small" /> },
  reimbursement: { label: "Reembolso", color: "warning", icon: <ReceiptLongIcon fontSize="small" /> },
  "vendor-payment": { label: "Pagamento a Fornecedor", color: "secondary", icon: <StorefrontIcon fontSize="small" /> },
  transfer: { label: "Transferência Interna", color: "info", icon: <CompareArrowsIcon fontSize="small" /> },
  other: { label: "Movimentação", color: "default", icon: <InfoOutlinedIcon fontSize="small" /> },
};

export const extractDonorHandle = (description: string) => {
  const match = /Doação de (@[\w.-]+)/.exec(description);
  return match?.[1] || null;
};

export function extractReimbursementDesc(description: string): string {
  return description.replace(/^Reembolso aprovado:\s*/i, "").trim();
}

export function deriveTransactionMeta(tx: Transaction, accountId: string) {
  const type = detectTxType(tx);
  const config = TX_TYPE_CONFIG[type];
  const isCredit = tx.destinationAccount?.id === accountId;
  const donorHandle = type === "donation" ? extractDonorHandle(tx.description) : null;
  const isSubscription = tx.description?.toLowerCase().includes("assinatura");
  const subscriptionInterval = tx.description?.toLowerCase().includes("anual") ? "anual" : "mensal";
  const paymentIntentId = tx.referenceId?.startsWith("pi_") ? tx.referenceId : null;
  const isTestMode = tx.description?.includes("cs_test_") || tx.referenceId?.startsWith("pi_test_");
  const stripeModePath = isTestMode ? "test/" : "";
  const stripeDashboardUrl = paymentIntentId
    ? `https://dashboard.stripe.com/${stripeModePath}payments/${paymentIntentId}`
    : null;
  const reimbDesc = type === "reimbursement" ? extractReimbursementDesc(tx.description) : null;
  const isTransfer = type === "transfer";
  const transferReason = isTransfer
    ? tx.description.replace(/^Transferência interna aprovada:\s*/i, "").trim()
    : null;

  return {
    type, config, isCredit, donorHandle, isSubscription, subscriptionInterval,
    paymentIntentId, stripeDashboardUrl, reimbDesc, isTransfer, transferReason,
  };
}
