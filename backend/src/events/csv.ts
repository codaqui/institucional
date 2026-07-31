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

function assertString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new CsvParseError('Entrada do CSV deve ser uma string.');
  }
}

interface TokenizerState {
  i: number;
  field: string;
  record: string[];
  inQuotes: boolean;
}

function tokenize(text: string, delimiter: string): string[][] {
  assertString(text);
  assertString(delimiter);

  const rows: string[][] = [];
  const state: TokenizerState = {
    i: 0,
    field: '',
    record: [],
    inQuotes: false,
  };

  while (state.i < text.length) {
    processTokenChar(state, text, delimiter, rows);
  }
  finalizeTokenRecord(state, rows);
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function processTokenChar(
  state: TokenizerState,
  text: string,
  delimiter: string,
  rows: string[][],
): void {
  const ch = text[state.i];
  if (state.inQuotes) {
    handleQuotedChar(state, text, ch);
    return;
  }
  if (ch === '"') {
    state.inQuotes = true;
    state.i += 1;
    return;
  }
  if (ch === delimiter) {
    state.record.push(state.field);
    state.field = '';
    state.i += 1;
    return;
  }
  if (ch === '\n' || ch === '\r') {
    // \r\n conta como uma quebra só
    if (ch === '\r' && text[state.i + 1] === '\n') state.i += 1;
    state.record.push(state.field);
    rows.push(state.record);
    state.field = '';
    state.record = [];
    state.i += 1;
    return;
  }
  state.field += ch;
  state.i += 1;
}

function handleQuotedChar(
  state: TokenizerState,
  text: string,
  ch: string,
): void {
  if (ch !== '"') {
    state.field += ch;
    state.i += 1;
    return;
  }
  if (text[state.i + 1] === '"') {
    state.field += '"';
    state.i += 2;
    return;
  }
  state.inQuotes = false;
  state.i += 1;
}

function finalizeTokenRecord(
  state: TokenizerState,
  rows: string[][],
): void {
  if (state.field.length > 0 || state.record.length > 0) {
    state.record.push(state.field);
    rows.push(state.record);
  }
}

/** Detecta o separador pela primeira linha física (header). */
function detectDelimiter(text: string): string {
  assertString(text);
  const firstLineEnd = text.search(/\r?\n/);
  const header = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const semicolons = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Faz parse do CSV e devolve as linhas tipadas (ou lança CsvParseError). */
export function parseCsvText(text: string, maxRows = 10_000): ParsedCsvRow[] {
  assertString(text);
  if (!text.trim()) throw new CsvParseError('CSV vazio.');
  // Remove BOM se presente
  const clean = text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
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
