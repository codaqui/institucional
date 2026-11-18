import type { EventSummary } from "./events";
import { buildEventPublicPath } from "./event-path";

export interface HomeActivity {
  title: string;
  summary: string;
  startAt: string;
  location: string;
  href: string;
  imageUrl?: string;
}

export function selectUpcomingHomeActivities(
  events: EventSummary[],
  now: Date,
  limit = 3,
): HomeActivity[] {
  if (limit <= 0) return [];
  const nowMs = now.getTime();
  return events
    .filter((event) => {
      const startMs = Date.parse(event.startAt);
      return Number.isFinite(startMs) && startMs >= nowMs
        && event.status !== "canceled" && event.status !== "completed";
    })
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
    .slice(0, limit)
    .map((event) => ({
      title: event.title,
      summary: event.summary,
      startAt: event.startAt,
      location: event.location,
      href: buildEventPublicPath(event),
      ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    }));
}
