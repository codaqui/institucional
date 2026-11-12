/**
 * Parser CSV das propostas de C4P importadas do Google Forms.
 *
 * - Cabeçalhos pt-BR mapeados por variante (primeira presente vence).
 * - Linhas sem nome/título, ou com e-mail inválido, vão para `skipped` sem
 *   quebrar o lote.
 * - Colunas não mapeadas (ex.: `Carimbo de data/hora`) são ignoradas.
 */

import { CsvParseError, tokenizeCsvRecords } from '../common/csv-tokenizer';

export interface C4pCsvTalkRow {
  speakerName: string;
  speakerEmail: string;
  title: string;
  speakerPhone?: string;
  speakerRole?: string;
  linkedin?: string;
  spokeBefore: boolean | null;
  summary?: string;
  level?: string;
  track?: string;
  bio?: string;
  photoUrl?: string;
  extraNotes?: string;
}

export interface C4pCsvSkipped {
  line: number;
  reason: string;
}

export const C4P_CSV_HEADERS: Record<keyof C4pCsvTalkRow, readonly string[]> = {
  speakerName: ['Nome Completo', 'Nome'],
  speakerEmail: ['Email', 'E-mail', 'Endereço de e-mail'],
  speakerPhone: ['WhatsApp (com DDD)', 'WhatsApp', 'Telefone'],
  speakerRole: ['Cargo e Empresa', 'Cargo'],
  linkedin: ['LinkedIn', 'Linkedin'],
  spokeBefore: ['Já palestrou antes?'],
  title: ['Título da Palestra', 'Título'],
  summary: ['Resumo da palestra', 'Resumo'],
  level: ['Nível', 'Nivel'],
  track: ['Tema/trilha', 'Trilha', 'Tema'],
  bio: ['Bio curta', 'Bio'],
  photoUrl: ['Foto'],
  extraNotes: [
    'Algo mais que a curadoria deveria saber?',
    'Observações',
    'Observacoes',
  ],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseSpokeBefore(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (['sim', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['não', 'nao', 'no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function headerIndex(header: string[], variants: readonly string[]): number {
  const normalized = header.map((cell) => cell.toLowerCase());
  for (const variant of variants) {
    const index = normalized.indexOf(variant.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

export function parseC4pCsv(
  text: string,
  maxRows = 500,
): { rows: C4pCsvTalkRow[]; skipped: C4pCsvSkipped[] } {
  if (typeof text !== 'string' || !text.trim()) {
    throw new CsvParseError('CSV vazio.');
  }
  const records = tokenizeCsvRecords(text);
  if (records.length === 0) throw new CsvParseError('CSV vazio.');

  const header = records[0].map((cell) => cell.trim());
  const indexes = Object.fromEntries(
    (
      Object.keys(C4P_CSV_HEADERS) as Array<keyof C4pCsvTalkRow>
    ).map((field) => [field, headerIndex(header, C4P_CSV_HEADERS[field])]),
  ) as Record<keyof C4pCsvTalkRow, number>;

  const dataRows = records.slice(1);
  if (dataRows.length > maxRows) {
    throw new CsvParseError(
      `CSV excede o limite de ${maxRows} linhas (${dataRows.length}).`,
    );
  }

  const rows: C4pCsvTalkRow[] = [];
  const skipped: C4pCsvSkipped[] = [];

  dataRows.forEach((record, i) => {
    const line = i + 2; // header = linha 1
    const cell = (field: keyof C4pCsvTalkRow): string => {
      const index = indexes[field];
      return index === -1 ? '' : (record[index] ?? '').trim();
    };

    const speakerName = cell('speakerName');
    if (!speakerName) {
      skipped.push({ line, reason: 'Nome do palestrante ausente.' });
      return;
    }
    const title = cell('title');
    if (!title) {
      skipped.push({ line, reason: 'Título ausente.' });
      return;
    }
    const speakerEmail = cell('speakerEmail');
    if (speakerEmail && !EMAIL_PATTERN.test(speakerEmail)) {
      skipped.push({ line, reason: 'E-mail inválido.' });
      return;
    }

    const optional = (field: keyof C4pCsvTalkRow): string | undefined => {
      const value = cell(field);
      return value || undefined;
    };

    rows.push({
      speakerName,
      speakerEmail,
      title,
      speakerPhone: optional('speakerPhone'),
      speakerRole: optional('speakerRole'),
      linkedin: optional('linkedin'),
      spokeBefore: parseSpokeBefore(cell('spokeBefore')),
      summary: optional('summary'),
      level: optional('level'),
      track: optional('track'),
      bio: optional('bio'),
      photoUrl: optional('photoUrl'),
      extraNotes: optional('extraNotes'),
    });
  });

  return { rows, skipped };
}
