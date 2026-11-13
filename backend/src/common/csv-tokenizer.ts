/**
 * Tokenizador CSV genérico (sem dependência), compartilhado entre os parsers
 * de importação (participantes de eventos, propostas de C4P).
 *
 * - Separador detectado pela primeira linha física (header): `;` ou `,`.
 * - Suporta aspas duplas com escape `""` (RFC 4180).
 * - Remove BOM e trata `\r\n` como quebra única.
 * - Filtra linhas totalmente vazias.
 */

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

/** Detecta o separador pela primeira linha física (header). */
export function detectDelimiter(text: string): string {
  assertString(text);
  const firstLineEnd = text.search(/\r?\n/);
  const header = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const semicolons = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Faz o tokenize do CSV e devolve os registros brutos (ou lança CsvParseError). */
export function tokenizeCsvRecords(text: string): string[][] {
  assertString(text);
  // Remove BOM se presente
  const clean = text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
  return tokenize(clean, detectDelimiter(clean));
}
