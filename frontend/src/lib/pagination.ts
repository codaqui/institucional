// SET padronizado de paginação — fonte única de constantes e helpers para
// listagens paginadas da API (envelope `{data,total,page,totalPages,limit?}`,
// ver backend/src/ledger/dto/paginated-result.dto.ts). Qualquer ilha/tabela que
// pagine deve importar os PAGE_SIZE daqui em vez de hardcodar limites.

/** Cap máximo do backend por página (GET /members e afins rejeitam limit > 100). */
export const MAX_PAGE_SIZE = 100;

/** Página padrão das listagens admin (alinhado ao default do backend). */
export const DEFAULT_PAGE_SIZE = 50;

/** Tamanho de página do diretório de membros (max de itens por fetch). */
export const MEMBERS_PAGE_SIZE = 100;

/** Tamanho padrão da janela de páginas visíveis nos controles de paginação. */
export const PAGE_WINDOW_SIZE = 5;

/** Envelope paginado padrão da API (GET /members, GET /ledger/..., etc). */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  /** Presente desde o backend 0.11.5 — limit efetivo da página (após cap). */
  limit?: number;
}

/**
 * Janela deslizante de páginas visíveis centrada em `current`.
 *
 * pageWindow(1, 10) → [1, 2, 3, 4, 5]
 * pageWindow(8, 10) → [6, 7, 8, 9, 10]
 * pageWindow(3, 4)  → [1, 2, 3, 4]  (totalPages < window → todas)
 */
export function pageWindow(
  current: number,
  totalPages: number,
  windowSize: number = PAGE_WINDOW_SIZE,
): number[] {
  const total = Math.max(0, Math.floor(totalPages));
  if (total === 0) return [];
  const size = Math.max(1, Math.floor(windowSize));
  if (total <= size) return Array.from({ length: total }, (_, i) => i + 1);

  const clamped = Math.min(Math.max(1, Math.floor(current)), total);
  let start = clamped - Math.floor(size / 2);
  start = Math.min(Math.max(1, start), total - size + 1);
  return Array.from({ length: size }, (_, i) => start + i);
}

/**
 * Label "Mostrando X–Y de Z" para a página corrente. Retorna mensagem de
 * resultado vazio quando total = 0.
 */
export function rangeLabel(page: number, limit: number, total: number): string {
  if (total <= 0) return "Nenhum resultado";
  const safeLimit = Math.max(1, Math.floor(limit));
  const safePage = Math.min(Math.max(1, Math.floor(page)), Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit + 1;
  const end = Math.min(safePage * safeLimit, total);
  return `Mostrando ${start}–${end} de ${total}`;
}
