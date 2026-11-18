import type { C4pSnapshotCall } from "./c4p";
import type { EventSummary } from "./events";

function isPublicAt(call: C4pSnapshotCall, now: Date): boolean {
  if (call.status === "closed") return call.publicResults;
  const nowMs = now.getTime();
  const opensAt = call.submissionOpenAt ? Date.parse(call.submissionOpenAt) : null;
  const closesAt = call.submissionCloseAt ? Date.parse(call.submissionCloseAt) : null;
  return (opensAt === null || opensAt <= nowMs) && (closesAt === null || closesAt > nowMs);
}

export function findPublicC4pForEvent(
  event: EventSummary,
  calls: C4pSnapshotCall[],
  now = new Date(),
): C4pSnapshotCall | null {
  const externalEventKey = `${event.sourceKey}:${event.id}`;
  return calls.find((call) => {
    if (!isPublicAt(call, now)) return false;
    return event.source === "internal"
      ? Boolean(event.slug && call.event?.slug === event.slug)
      : call.externalEventKey === externalEventKey;
  }) ?? null;
}
