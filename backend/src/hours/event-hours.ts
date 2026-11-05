export interface EventWorkloadInput {
  workloadMinutes?: number | null;
  startAt: Date;
  endAt?: Date | null;
}

export function resolveEventWorkloadMinutes(event: EventWorkloadInput): number | null {
  if (event.workloadMinutes && event.workloadMinutes > 0) {
    return event.workloadMinutes;
  }
  if (!event.endAt) return null;
  const duration = Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60_000);
  return duration > 0 ? duration : null;
}
