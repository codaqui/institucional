import type { Criterion } from './entities/c4p-call.entity';

/** Os 5 critérios do sistema externo (DevPR Conf 2026), com pesos iguais. */
export const DEFAULT_CRITERIA: Criterion[] = [
  { key: 'relevancia', label: 'Relevância Prática e Alinhamento', weight: 1 },
  { key: 'viabilidade', label: 'Viabilidade no Palco Único', weight: 1 },
  { key: 'clareza', label: 'Clareza do Resumo e Escopo', weight: 1 },
  { key: 'inovacao', label: 'Inovação e Domínio do Tema', weight: 1 },
  {
    key: 'diversidade',
    label: 'Diversidade e Equilíbrio da Grade',
    weight: 1,
  },
];

export const C4P_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slugs proibidos: colidiriam com os prefixos de proxy da API
 * (`/c4p/public/`, `/c4p/manage/`, `/c4p/evaluator/`) ou com as rotas de app
 * (`/c4p/avaliar`) — lição I-1 do AGENTS.md.
 */
export const RESERVED_C4P_SLUGS: ReadonlySet<string> = new Set([
  'public',
  'manage',
  'evaluator',
  'avaliar',
]);
