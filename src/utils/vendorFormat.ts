import { formatDocument } from "./document";

/** Formats a vendor for autocomplete display: "Name (CNPJ formatado)" */
export function vendorLabel<T extends { name: string; document: string | null }>(v: T): string {
  return v.document ? `${v.name} (${formatDocument(v.document)})` : v.name;
}

/** Formats cents → "R$ 1.234,56" (Brazilian locale). */
export function formatCurrencyCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/** Formats ISO date to "dd/mm/yyyy hh:mm" (Brazilian locale). */
export function formatDateTimeBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
