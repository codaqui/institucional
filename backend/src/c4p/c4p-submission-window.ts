import type { C4pCall } from './entities/c4p-call.entity';

export function isWithinSubmissionWindow(
  call: Pick<C4pCall, 'submissionOpenAt' | 'submissionCloseAt'>,
  now = Date.now(),
): boolean {
  return (
    (!call.submissionOpenAt || call.submissionOpenAt.getTime() <= now) &&
    (!call.submissionCloseAt || call.submissionCloseAt.getTime() > now)
  );
}
