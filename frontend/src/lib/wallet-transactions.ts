// Port de src/utils/wallet-transactions.ts (Docusaurus) — somente os exports
// usados pelas ilhas de perfil (ClubWalletTransactionsTable e
// WalletTransactionDetailDialog).
export type WalletTxOwnerType = "member" | "company";

export interface WalletTxDetailData {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  referenceId?: string | null;
  createdAt: string;
  ownerName?: string;
  ownerType?: WalletTxOwnerType;
}

export const WALLET_SOURCE_LABEL: Record<string, string> = {
  stripe_invoice: "Stripe Invoice",
  manual_admin: "Ajuste Admin",
  raffle_entry: "Entrada Sorteio",
  raffle_refund: "Reembolso Sorteio",
  company_distribution: "Distribuição Empresa",
};

export function formatWalletDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function resolveWalletSourceLabel(source: string): string {
  return WALLET_SOURCE_LABEL[source] ?? source;
}
