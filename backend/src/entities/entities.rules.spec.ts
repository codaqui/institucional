import { BadRequestException } from '@nestjs/common';
import { assertPartnershipDates, entitySlug } from './entities.rules';

describe('entities.rules', () => {
  it('derives a readable slug for public organizational routes', () => {
    expect(entitySlug('  Associação   Codaqui ')).toBe('associacao-codaqui');
  });

  it('handles long delimiter runs without polynomial backtracking', () => {
    const startedAt = performance.now();
    expect(() => entitySlug('-'.repeat(2_000_000))).toThrow(BadRequestException);
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it('rejects partnership dates in reverse order', () => {
    expect(() => assertPartnershipDates({ startedAt: '2026-02-01', endsAt: '2026-01-01' }))
      .toThrow(BadRequestException);
  });

  it('accepts an open-ended partnership', () => {
    expect(() => assertPartnershipDates({ startedAt: '2026-02-01', endsAt: null })).not.toThrow();
  });
});
