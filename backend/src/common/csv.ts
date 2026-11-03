export type CsvValue = string | number | boolean | Date | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  const safeText = /^\s*[=+\-@]|^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function toCsv(
  headers: string[],
  rows: Array<Record<string, CsvValue>>,
): string {
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];
  return `\ufeff${lines.join('\r\n')}`;
}
