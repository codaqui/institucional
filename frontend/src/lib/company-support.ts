// Port 1:1 de src/utils/company-support.ts (Docusaurus) — usado pela ilha
// de gestão de empresas (CLUB Business PJ).
export function formatSupportCurrency(totalSupportedReais: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(totalSupportedReais);
}

export function formatSupportCountLabel(supportCount: number): string {
  return `${supportCount} ${supportCount === 1 ? "apoio" : "apoios"}`;
}
