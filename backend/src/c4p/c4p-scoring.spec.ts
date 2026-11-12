import type { Criterion } from './entities/c4p-call.entity';
import {
  computeTalkScore,
  computeVoteScore,
  rankTalks,
  type TalkScore,
} from './c4p-scoring';

const CRITERIA: Criterion[] = [
  { key: 'a', label: 'A', weight: 2 },
  { key: 'b', label: 'B', weight: 1 },
  { key: 'c', label: 'C', weight: 1 },
];

describe('computeVoteScore', () => {
  it('pondera só os critérios presentes no voto', () => {
    expect(computeVoteScore({ a: 10, b: 0 }, CRITERIA)).toBeCloseTo(
      (10 * 2 + 0 * 1) / 3,
    );
  });

  it('critério ausente não entra nem no numerador nem no denominador', () => {
    expect(computeVoteScore({ c: 8 }, CRITERIA)).toBe(8);
  });

  it('scores vazio retorna 0', () => {
    expect(computeVoteScore({}, CRITERIA)).toBe(0);
  });
});

describe('computeTalkScore', () => {
  it('média da palestra é a média simples dos scores dos votos', () => {
    const score = computeTalkScore(
      [{ scores: { a: 10 } }, { scores: { a: 0 } }],
      CRITERIA,
    );
    expect(score.avgTotal).toBe(5);
    expect(score.votesCount).toBe(2);
  });

  it('avgCriteria usa só os votos que preencheram o critério', () => {
    const score = computeTalkScore(
      [{ scores: { a: 10, b: 0 } }, { scores: { a: 0 } }],
      CRITERIA,
    );
    expect(score.avgCriteria.a).toBe(5);
    expect(score.avgCriteria.b).toBe(0);
    expect(score.avgCriteria.c).toBeUndefined();
  });

  it('sem votos: avgTotal null e votesCount 0', () => {
    expect(computeTalkScore([], CRITERIA)).toEqual({
      avgTotal: null,
      votesCount: 0,
      avgCriteria: {},
    });
  });
});

describe('rankTalks', () => {
  it('ordena por avgTotal desc, sem voto afunda, selected marca', () => {
    const items = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    const scores: Record<string, TalkScore> = {
      t1: { avgTotal: 5, votesCount: 1, avgCriteria: {} },
      t2: { avgTotal: null, votesCount: 0, avgCriteria: {} },
      t3: { avgTotal: 9, votesCount: 2, avgCriteria: {} },
    };
    const ranked = rankTalks(
      items,
      (i) => scores[i.id],
      ['t1'],
    );
    expect(ranked.map((r) => r.item.id)).toEqual(['t3', 't1', 't2']);
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(ranked[1].selected).toBe(true);
    expect(ranked[0].selected).toBe(false);
    // posição existe mesmo sem votos; avgTotal null só afunda na ordenação
    expect(ranked[2].position).toBe(3);
    expect(ranked[2].score.avgTotal).toBeNull();
  });
});
