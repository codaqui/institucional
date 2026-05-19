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

export const WALLET_SOURCE_COLOR: Record<
  string,
  "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"
> = {
  stripe_invoice: "success",
  manual_admin: "warning",
  raffle_entry: "primary",
  raffle_refund: "info",
  company_distribution: "secondary",
};

export function formatWalletDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function resolveWalletSourceLabel(source: string): string {
  return WALLET_SOURCE_LABEL[source] ?? source;
}
