import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface MentorAvailabilityRule {
  weekday: number;
  startTime: string;
  endTime: string;
  timeZone: string;
}

export interface PublicMentor {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string;
  areas: string[];
  focus: string | null;
  availability: MentorAvailabilityRule[];
}

export interface MentorInsights {
  completed: number;
  activeMentors: number;
  areas: Array<{ area: string; mentors: number; completed: number }>;
  noShowRate: number;
}

export interface MentorsIndex {
  generatedAt: string | null;
  mentors: PublicMentor[];
  insights: MentorInsights;
}

const MENTOR_FIELDS = new Set(["id", "handle", "name", "avatarUrl", "areas", "focus", "availability"]);
const AVAILABILITY_FIELDS = new Set(["weekday", "startTime", "endTime", "timeZone"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  return Object.keys(value).every((field) => fields.has(field));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAvailability(value: unknown): value is MentorAvailabilityRule {
  if (!isObject(value) || !hasExactFields(value, AVAILABILITY_FIELDS)) return false;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return Number.isInteger(value.weekday) && (value.weekday as number) >= 0 && (value.weekday as number) <= 6
    && isNonEmptyString(value.startTime) && time.test(value.startTime)
    && isNonEmptyString(value.endTime) && time.test(value.endTime)
    && value.startTime < value.endTime && isNonEmptyString(value.timeZone);
}

function isMentor(value: unknown): value is PublicMentor {
  if (!isObject(value) || !hasExactFields(value, MENTOR_FIELDS)) return false;
  return ["id", "handle", "name", "avatarUrl"].every((field) => isNonEmptyString(value[field]))
    && (value.focus === null || typeof value.focus === "string")
    && Array.isArray(value.areas) && value.areas.length > 0 && value.areas.every(isNonEmptyString)
    && Array.isArray(value.availability) && value.availability.every(isAvailability);
}

function isInsights(value: unknown): value is MentorInsights {
  if (!isObject(value) || !Number.isInteger(value.completed) || (value.completed as number) < 0
    || !Number.isInteger(value.activeMentors) || (value.activeMentors as number) < 0
    || typeof value.noShowRate !== "number" || value.noShowRate < 0 || value.noShowRate > 1
    || !Array.isArray(value.areas)) return false;
  return value.areas.every((item) => isObject(item) && isNonEmptyString(item.area)
    && Number.isInteger(item.mentors) && (item.mentors as number) >= 0
    && Number.isInteger(item.completed) && (item.completed as number) >= 0);
}

function emptyIndex(): MentorsIndex {
  return {
    generatedAt: null,
    mentors: [],
    insights: { completed: 0, activeMentors: 0, areas: [], noShowRate: 0 },
  };
}

export function loadMentorsIndex(
  filePath = fileURLToPath(new URL("../../public/mentors/index.json", import.meta.url)),
): MentorsIndex {
  try {
    const snapshot: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isObject(snapshot) || Object.hasOwn(snapshot, "sessions") || !Array.isArray(snapshot.mentors)
      || !snapshot.mentors.every(isMentor) || !isInsights(snapshot.insights)
      || (snapshot.generatedAt !== null && (!isNonEmptyString(snapshot.generatedAt) || Number.isNaN(Date.parse(snapshot.generatedAt))))) {
      return emptyIndex();
    }
    return {
      generatedAt: snapshot.generatedAt,
      mentors: snapshot.mentors,
      insights: snapshot.insights,
    };
  } catch {
    return emptyIndex();
  }
}
