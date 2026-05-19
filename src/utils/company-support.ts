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
