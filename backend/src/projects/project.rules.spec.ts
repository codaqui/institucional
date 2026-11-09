import { BadRequestException } from '@nestjs/common';
import {
  assertBudget,
  assertOds,
  assertProjectComplete,
  assertProjectDates,
  assertScheduleMatches,
  hoursToCents,
  normalizeProjectName,
  projectSlug,
} from './project.rules';

describe('project.rules', () => {
  it('normalizes names and derives stable slugs', () => {
    expect(normalizeProjectName('  Ação   Extensão ')).toBe('acao extensao');
    expect(projectSlug('  Ação   Extensão ')).toBe('acao-extensao');
  });

  it('handles long delimiter runs without polynomial backtracking', () => {
    const startedAt = performance.now();
    expect(() => projectSlug('-'.repeat(2_000_000))).toThrow(BadRequestException);
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it('compares schedule totals in integer cents', () => {
    expect(hoursToCents(0.29)).toBe(29);
    expect(() => assertScheduleMatches([
      { numero: 1, descricao: 'A', carga: 0.1 },
      { numero: 2, descricao: 'B', carga: 0.2 },
    ], 0.31)).toThrow(BadRequestException);
    expect(() => assertScheduleMatches([
      { numero: 1, descricao: 'A', carga: 0.1 },
      { numero: 2, descricao: 'B', carga: 0.2 },
    ], 0.3)).not.toThrow();
  });

  it('rejects registration after execution starts', () => {
    expect(() => assertProjectDates({
      startsAt: '2026-03-10', endsAt: '2026-04-10',
      registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-09',
    })).not.toThrow();
    expect(() => assertProjectDates({
      startsAt: '2026-03-10', endsAt: '2026-04-10',
      registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-11',
    })).toThrow(BadRequestException);
  });

  it('validates ODS without duplicates or primary repetition', () => {
    expect(() => assertOds(4, [1, 2])).not.toThrow();
    expect(() => assertOds(4, [4])).toThrow(BadRequestException);
    expect(() => assertOds(0, [])).toThrow(BadRequestException);
  });

  it('validates descriptive budget arithmetic without touching finance', () => {
    expect(() => assertBudget({
      itens: [{ descricao: 'Material', quantidade: 2, unidadeMedida: 'un', valorUnitario: 1.5, valorTotalItem: 3 }],
      totalGeral: 3,
    })).not.toThrow();
    expect(() => assertBudget({
      itens: [{ descricao: 'Material', quantidade: 2, unidadeMedida: 'un', valorUnitario: 1.5, valorTotalItem: 2 }],
      totalGeral: 2,
    })).toThrow(BadRequestException);
  });

  it('accepts a complete project and rejects missing activation fields', () => {
    const complete = {
      kind: 'projeto', name: 'Projeto', entityId: 'entity-1', summary: 'Resumo',
      startsAt: '2026-03-10', endsAt: '2026-04-10',
      registrationStartsAt: '2026-03-01', registrationEndsAt: '2026-03-09',
      odsPrimary: 4, odsSecondary: [1], targetCommunity: 'Comunidade',
      justification: 'Justificativa', objective: 'Objetivo', skillsDeveloped: 'Skills',
      methodology: 'PjBL', totalHours: 0.3,
      schedule: [{ numero: 1, descricao: 'Encontro', carga: 0.3 }], maxParticipants: 10,
      mentorMemberId: 'mentor-1',
    } as any;

    expect(() => assertProjectComplete(complete)).not.toThrow();
    expect(() => assertProjectComplete({ ...complete, methodology: null })).toThrow(BadRequestException);
  });
});
