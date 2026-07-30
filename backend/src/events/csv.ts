/**
 * Parser CSV manual (sem dependência) para importação de participantes.
 *
 * - Separador detectado pelo header (`;` ou `,` — padrão brasileiro vs. americano).
 * - Suporta aspas duplas com escape `""` (RFC 4180).
 * - Header obrigatório: `name` e `email`; opcionais: `ticket_type`, `external_id`, `github`.
 * - Limite de linhas para evitar DoS via upload gigante.
 */

export interface ParsedCsvRow {
  line: number; // 1-based, contando o header como linha 1
  name: string;
  email: string;
  ticketType?: string;
  externalId?: string;
  /** handle do GitHub — match secundário quando o e-mail não tem conta */
  github?: string;
}

export class CsvParseError extends Error {}

function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    rows.push(record);
    record = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // \r\n conta como uma quebra só
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || record.length > 0) pushRecord();
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Detecta o separador pela primeira linha física (header). */
function detectDelimiter(text: string): string {
  const firstLineEnd = text.search(/\r?\n/);
  const header = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const semicolons = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Faz parse do CSV e devolve as linhas tipadas (ou lança CsvParseError). */
export function parseCsvText(text: string, maxRows = 10_000): ParsedCsvRow[] {
  if (!text?.trim()) throw new CsvParseError('CSV vazio.');
  // Remove BOM se presente
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records = tokenize(clean, detectDelimiter(clean));
  if (records.length === 0) throw new CsvParseError('CSV vazio.');

  const header = records[0].map((h) => h.trim().toLowerCase());
  const idxName = header.indexOf('name');
  const idxEmail = header.indexOf('email');
  if (idxName === -1 || idxEmail === -1) {
    throw new CsvParseError(
      'Header inválido: colunas obrigatórias "name" e "email" (opcionais: "ticket_type", "external_id", "github").',
    );
  }
  const idxTicketType = header.indexOf('ticket_type');
  const idxExternalId = header.indexOf('external_id');
  const idxGithub = header.indexOf('github');

  const dataRows = records.slice(1);
  if (dataRows.length > maxRows) {
    throw new CsvParseError(
      `CSV excede o limite de ${maxRows} linhas (${dataRows.length}).`,
    );
  }

  return dataRows.map((record, i) => ({
    line: i + 2, // header = linha 1
    name: (record[idxName] ?? '').trim(),
    email: (record[idxEmail] ?? '').trim(),
    ...(idxTicketType !== -1 && record[idxTicketType]
      ? { ticketType: record[idxTicketType].trim() }
      : {}),
    ...(idxExternalId !== -1 && record[idxExternalId]
      ? { externalId: record[idxExternalId].trim() }
      : {}),
    ...(idxGithub !== -1 && record[idxGithub]
      ? { github: record[idxGithub].trim().replace(/^@/, '') }
      : {}),
  }));
}
