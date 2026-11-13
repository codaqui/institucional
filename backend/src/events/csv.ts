/**
 * Parser CSV manual (sem dependência) para importação de participantes.
 *
 * - Separador detectado pelo header (`;` ou `,` — padrão brasileiro vs. americano).
 * - Suporta aspas duplas com escape `""` (RFC 4180).
 * - Header obrigatório: `name` e `email`; opcionais: `ticket_type`, `external_id`, `github`, `checkin`, `certificate`.
 * - Limite de linhas para evitar DoS via upload gigante.
 */

import { CsvParseError, tokenizeCsvRecords } from '../common/csv-tokenizer';

export { CsvParseError };

export interface ParsedCsvRow {
  line: number; // 1-based, contando o header como linha 1
  name: string;
  email: string;
  ticketType?: string;
  externalId?: string;
  /** handle do GitHub — match secundário quando o e-mail não tem conta */
  github?: string;
  checkin?: boolean;
  certificate?: boolean;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

/** Faz parse do CSV e devolve as linhas tipadas (ou lança CsvParseError). */
export function parseCsvText(text: string, maxRows = 10_000): ParsedCsvRow[] {
  if (typeof text !== 'string') {
    throw new CsvParseError('Entrada do CSV deve ser uma string.');
  }
  if (!text.trim()) throw new CsvParseError('CSV vazio.');
  const records = tokenizeCsvRecords(text);
  if (records.length === 0) throw new CsvParseError('CSV vazio.');

  const header = records[0].map((h) => h.trim().toLowerCase());
  const idxName = header.indexOf('name');
  const idxEmail = header.indexOf('email');
  if (idxName === -1 || idxEmail === -1) {
    throw new CsvParseError(
      'Header inválido: colunas obrigatórias "name" e "email" (opcionais: "ticket_type", "external_id", "github", "checkin", "certificate").',
    );
  }
  const idxTicketType = header.indexOf('ticket_type');
  const idxExternalId = header.indexOf('external_id');
  const idxGithub = header.indexOf('github');
  const idxCheckin = header.indexOf('checkin');
  const idxCertificate = header.indexOf('certificate');

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
    checkin:
      idxCheckin === -1
        ? undefined
        : parseOptionalBoolean(record[idxCheckin]),
    certificate:
      idxCertificate === -1
        ? undefined
        : parseOptionalBoolean(record[idxCertificate]),
  }));
}
