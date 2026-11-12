import type { Criterion } from './entities/c4p-call.entity';

/**
 * Scoring da curadoria C4P (spec: "Critérios configuráveis e scoring").
 *
 * - Score do voto: Σ(score × peso) / Σ(peso) apenas sobre os critérios
 *   presentes no voto — critério sem voto não entra no cálculo individual.
 * - Nota da palestra: média aritmética simples dos scores dos votos.
 * - Médias por critério: média dos scores entre os votos que os preencheram.
 * - Arredondamento só na apresentação (nunca aqui).
 */

export function computeVoteScore(
  scores: Record<string, number>,
  criteria: Criterion[],
): number {
  let weighted = 0;
  let weightSum = 0;
  for (const criterion of criteria) {
    const score = scores[criterion.key];
    if (score === undefined) continue;
    weighted += score * criterion.weight;
    weightSum += criterion.weight;
  }
  if (weightSum === 0) return 0;
  return weighted / weightSum;
}

export interface TalkScore {
  avgTotal: number | null;
  votesCount: number;
  avgCriteria: Record<string, number>;
}

export function computeTalkScore(
  votes: Array<{ scores: Record<string, number> }>,
  criteria: Criterion[],
): TalkScore {
  if (votes.length === 0) {
    return { avgTotal: null, votesCount: 0, avgCriteria: {} };
  }

  const voteScores = votes.map((vote) => computeVoteScore(vote.scores, criteria));
  const avgTotal =
    voteScores.reduce((sum, score) => sum + score, 0) / voteScores.length;

  const avgCriteria: Record<string, number> = {};
  for (const criterion of criteria) {
    const present = votes
      .map((vote) => vote.scores[criterion.key])
      .filter((score): score is number => score !== undefined);
    if (present.length > 0) {
      avgCriteria[criterion.key] =
        present.reduce((sum, score) => sum + score, 0) / present.length;
    }
  }

  return { avgTotal, votesCount: votes.length, avgCriteria };
}

export interface RankedTalk<T> {
  item: T;
  score: TalkScore;
  position: number | null;
  selected: boolean;
}

export function rankTalks<T extends { id: string }>(
  items: T[],
  scoreOf: (item: T) => TalkScore,
  selectedIds: string[],
): Array<RankedTalk<T>> {
  const selected = new Set(selectedIds);
  return items
    .map((item) => ({ item, score: scoreOf(item) }))
    .sort((left, right) => (right.score.avgTotal ?? -1) - (left.score.avgTotal ?? -1))
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
      selected: selected.has(entry.item.id),
    }));
}
