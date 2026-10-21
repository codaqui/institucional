/**
 * Brazilian document formatting utilities (CPF / CNPJ).
 *
 * Documents are stored as digits-only strings in the database.
 * These helpers handle display formatting and input sanitization.
 *
 * Future-proof: when CNPJ gains alphanumeric characters (July 2026),
 * update stripToDigits → stripFormatting and adjust the masks.
 */

/** Formats raw digits into CPF (11) or CNPJ (14) mask. */
export function formatDocument(raw: string): string {
  const digits = raw.replaceAll(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 11) {
    // CPF: XXX.XXX.XXX-XX
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ: XX.XXX.XXX/XXXX-XX
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Strips non-digit characters from input. */
export function stripToDigits(value: string): string {
  return value.replaceAll(/\D/g, "");
}
