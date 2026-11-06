import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AssemblyType = "ordinaria" | "oficial";
export type AssemblyStatus = "scheduled" | "held" | "canceled";

export interface AssemblyNotaryRegistry {
  book: string;
  page: string;
  registeredAt: string;
}

export interface Assembly {
  id: string;
  type: AssemblyType;
  number: number;
  slug: string;
  title: string;
  scheduledAt: string;
  heldAt: string | null;
  status: AssemblyStatus;
  agendaSummary: string;
  discussionUrl: string;
  ataPdfUrl: string | null;
  notaryRegistry: AssemblyNotaryRegistry | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssembliesIndex {
  generatedAt: string | null;
  assemblies: Assembly[];
}

export function assemblySlug(type: AssemblyType, number: number): string {
  return `${type}-${number}`;
}

export function assemblyPath(assembly: Pick<Assembly, "type" | "number">): string {
  return `/assembleias/${assemblySlug(assembly.type, assembly.number)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const ASSEMBLY_DISCUSSION_URL_PATTERN =
  /^https:\/\/github\.com\/codaqui\/institucional\/discussions\/[1-9]\d*$/;
const TRUSTED_PDF_HOSTNAMES = [
  "drive.google.com",
  "docs.google.com",
  "www.dropbox.com",
  "dropbox.com",
  "onedrive.live.com",
  "1drv.ms",
  "imgur.com",
  "i.imgur.com",
];
const registeredAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "UTC",
});

function isDateString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function formatAssemblyRegisteredAt(value: string): string {
  return registeredAtFormatter.format(new Date(value));
}

function isTrustedPdfUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && TRUSTED_PDF_HOSTNAMES.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function isNotaryRegistry(value: unknown): value is AssemblyNotaryRegistry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.book) &&
    isNonEmptyString(value.page) &&
    isDateString(value.registeredAt)
  );
}

function hasRequiredAssemblyStrings(value: Record<string, unknown>): boolean {
  if (!["id", "title", "agendaSummary", "discussionUrl"].every((field) => isNonEmptyString(value[field]))) {
    return false;
  }
  return ASSEMBLY_DISCUSSION_URL_PATTERN.test(value.discussionUrl as string);
}

function hasValidAssemblyIdentity(value: Record<string, unknown>): boolean {
  if (value.type !== "ordinaria" && value.type !== "oficial") return false;
  if (!Number.isSafeInteger(value.number) || (value.number as number) < 1) return false;
  return value.slug === assemblySlug(value.type, value.number as number);
}

function hasValidAssemblyDates(value: Record<string, unknown>): boolean {
  if (!["scheduledAt", "createdAt", "updatedAt"].every((field) => isDateString(value[field]))) {
    return false;
  }
  return value.heldAt === null || isDateString(value.heldAt);
}

function hasValidAssemblyDocuments(value: Record<string, unknown>): boolean {
  if (value.ataPdfUrl !== null && !isTrustedPdfUrl(value.ataPdfUrl)) return false;
  return value.notaryRegistry === null || isNotaryRegistry(value.notaryRegistry);
}

function hasValidAssemblyTransition(value: Record<string, unknown>): boolean {
  if (value.status === "held" && value.heldAt === null) return false;
  if (value.heldAt !== null && Date.parse(value.heldAt as string) < Date.parse(value.scheduledAt as string)) {
    return false;
  }
  return !(
    value.type === "oficial" &&
    value.status === "held" &&
    (!value.ataPdfUrl || value.notaryRegistry === null)
  );
}

function isAssembly(value: unknown): value is Assembly {
  if (!isRecord(value) || Object.hasOwn(value, "createdById")) return false;
  if (!hasRequiredAssemblyStrings(value) || !hasValidAssemblyIdentity(value)) {
    return false;
  }
  if (value.status !== "scheduled" && value.status !== "held" && value.status !== "canceled") {
    return false;
  }
  return (
    hasValidAssemblyDates(value) &&
    hasValidAssemblyDocuments(value) &&
    hasValidAssemblyTransition(value)
  );
}

function emptyIndex(): AssembliesIndex {
  return { generatedAt: null, assemblies: [] };
}

export function loadAssembliesIndex(
  snapshotPath = resolve(process.cwd(), "public", "assemblies", "index.json"),
): AssembliesIndex {
  try {
    const payload: unknown = JSON.parse(readFileSync(snapshotPath, "utf8"));
    if (
      !isRecord(payload) ||
      !isDateString(payload.generatedAt) ||
      !Array.isArray(payload.assemblies) ||
      !payload.assemblies.every(isAssembly)
    ) {
      return emptyIndex();
    }

    const assemblies = payload.assemblies as Assembly[];
    return {
      generatedAt: payload.generatedAt,
      assemblies: assemblies.toSorted(
        (a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt),
      ),
    };
  } catch {
    return emptyIndex();
  }
}
