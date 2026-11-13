import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface C4pResultTalk {
  title: string;
  speakerName: string;
  track: string | null;
  level: string | null;
}

export interface C4pSnapshotCall {
  slug: string;
  name: string;
  description: string | null;
  status: "open" | "closed";
  submissionOpenAt: string | null;
  submissionCloseAt: string | null;
  publicResults: boolean;
  finalizedAt: string | null;
  community: { slug: string; name: string } | null;
  event: { slug: string; title: string } | null;
  results: { talks: C4pResultTalk[] } | null;
}

export interface C4pIndex {
  generatedAt: string | null;
  calls: C4pSnapshotCall[];
}

// Campos restritos à curadoria: o snapshot público nunca deve carregá-los.
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "scores",
  "comment",
  "speakerEmail",
  "speakerPhone",
  "extraNotes",
  "bio",
  "linkedin",
  "photoUrl",
  "createdById",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableDateString(value: unknown): boolean {
  return value === null || (isNonEmptyString(value) && !Number.isNaN(Date.parse(value)));
}

function containsForbiddenKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKeys);
  if (!isObject(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => FORBIDDEN_KEYS.has(key) || containsForbiddenKeys(nested),
  );
}

function isResultTalk(value: unknown): value is C4pResultTalk {
  return (
    isObject(value) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.speakerName) &&
    (value.track === null || typeof value.track === "string") &&
    (value.level === null || typeof value.level === "string") &&
    !containsForbiddenKeys(value)
  );
}

function isCommunityRef(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      isNonEmptyString(value.slug) &&
      isNonEmptyString(value.name))
  );
}

function isEventRef(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      isNonEmptyString(value.slug) &&
      isNonEmptyString(value.title))
  );
}

function isResultsValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isObject(value) || !Array.isArray(value.talks)) return false;
  return value.talks.every(isResultTalk);
}

function isSnapshotCall(value: unknown): value is C4pSnapshotCall {
  if (!isObject(value) || containsForbiddenKeys(value)) return false;
  if (!isNonEmptyString(value.slug) || !isNonEmptyString(value.name)) {
    return false;
  }
  if (value.status !== "open" && value.status !== "closed") return false;
  if (value.description !== null && typeof value.description !== "string") {
    return false;
  }
  if (!isNullableDateString(value.submissionOpenAt)) return false;
  if (!isNullableDateString(value.submissionCloseAt)) return false;
  if (typeof value.publicResults !== "boolean") return false;
  if (!isNullableDateString(value.finalizedAt)) return false;
  if (!isCommunityRef(value.community)) return false;
  if (!isEventRef(value.event)) return false;
  return isResultsValue(value.results);
}

export function emptyC4pIndex(): C4pIndex {
  return { generatedAt: null, calls: [] };
}

export function loadC4pIndex(
  filePath = fileURLToPath(new URL("../../public/c4p/index.json", import.meta.url)),
): C4pIndex {
  try {
    const snapshot: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isObject(snapshot) || !Array.isArray(snapshot.calls)) {
      return emptyC4pIndex();
    }
    const generatedAt =
      typeof snapshot.generatedAt === "string" &&
      !Number.isNaN(Date.parse(snapshot.generatedAt))
        ? snapshot.generatedAt
        : null;
    return {
      generatedAt,
      calls: snapshot.calls
        .filter(isSnapshotCall)
        .map((call) => ({ ...call, results: call.results ?? null })),
    };
  } catch {
    return emptyC4pIndex();
  }
}
