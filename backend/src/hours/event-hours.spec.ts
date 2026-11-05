import { resolveEventWorkloadMinutes } from './event-hours';

describe('resolveEventWorkloadMinutes', () => {
  it('prefers explicit workload over duration', () => {
    expect(resolveEventWorkloadMinutes({
      workloadMinutes: 90,
      startAt: new Date('2026-01-01T10:00:00Z'),
      endAt: new Date('2026-01-01T12:00:00Z'),
    })).toBe(90);
  });

  it('falls back to a positive duration', () => {
    expect(resolveEventWorkloadMinutes({
      startAt: new Date('2026-01-01T10:00:00Z'),
      endAt: new Date('2026-01-01T12:30:00Z'),
    })).toBe(150);
  });

  it('returns null when no reliable workload exists', () => {
    expect(resolveEventWorkloadMinutes({
      startAt: new Date('2026-01-01T10:00:00Z'),
      endAt: null,
    })).toBeNull();
  });
});
