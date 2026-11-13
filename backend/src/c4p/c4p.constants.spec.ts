import {
  C4P_SLUG_PATTERN,
  DEFAULT_CRITERIA,
  RESERVED_C4P_SLUGS,
} from './c4p.constants';

describe('c4p constants', () => {
  it('default tem os 5 critérios do sistema externo com pesos iguais', () => {
    expect(DEFAULT_CRITERIA).toHaveLength(5);
    expect(DEFAULT_CRITERIA.map((c) => c.key)).toEqual([
      'relevancia',
      'viabilidade',
      'clareza',
      'inovacao',
      'diversidade',
    ]);
    expect(new Set(DEFAULT_CRITERIA.map((c) => c.weight))).toEqual(new Set([1]));
  });

  it('slugs reservados protegem rotas e proxy', () => {
    expect([...RESERVED_C4P_SLUGS].sort()).toEqual([
      'avaliar',
      'evaluator',
      'manage',
      'public',
    ]);
  });

  it('padrão de slug aceita kebab-case e rejeita maiúsculas/underscore', () => {
    expect(C4P_SLUG_PATTERN.test('devpr-conf-2026')).toBe(true);
    expect(C4P_SLUG_PATTERN.test('DevPR')).toBe(false);
    expect(C4P_SLUG_PATTERN.test('a_b')).toBe(false);
  });
});
