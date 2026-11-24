import type { EventSummary } from "./events";

export interface EventInsights {
  published: number;
  completed: number;
  attendeeSignups: number;
  completedByYear: Record<string, number>;
  completedBySource: Record<string, number>;
}

export function summarizeEventInsights(events: EventSummary[]): EventInsights {
  const completedByYear: Record<string, number> = {};
  const completedBySource: Record<string, number> = {};
  let attendeeSignups = 0;
  let completed = 0;

  for (const event of events) {
    if (event.status !== "completed") continue;
    completed += 1;
    const year = event.startAt.slice(0, 4);
    completedByYear[year] = (completedByYear[year] ?? 0) + 1;
    completedBySource[event.sourceKey] = (completedBySource[event.sourceKey] ?? 0) + 1;
    if (typeof event.userCount === "number" && Number.isFinite(event.userCount) && event.userCount > 0) {
      attendeeSignups += event.userCount;
    }
  }

  return {
    published: events.length,
    completed,
    attendeeSignups,
    completedByYear: Object.fromEntries(Object.entries(completedByYear).sort(([a], [b]) => a.localeCompare(b))),
    completedBySource,
  };
}
