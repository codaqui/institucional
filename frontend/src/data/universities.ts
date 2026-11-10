import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface PublicCity {
  id: string;
  name: string;
  uf: string;
  isActive?: boolean;
}

export interface PublicInstitution {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  city: PublicCity | null;
  ambassador: {
    githubHandle: string;
    name: string;
    avatarUrl: string;
    validUntil: string | null;
  } | null;
}

export interface PublicUniversityEvent {
  id: string;
  slug: string;
  title: string;
  startAt: string;
  status: string;
  location: string;
  institutionId: string;
}

export interface UniversitiesIndex {
  generatedAt: string | null;
  cities: PublicCity[];
  institutions: PublicInstitution[];
  events: PublicUniversityEvent[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPublicSnapshot(snapshot: Record<string, unknown>): void {
  if (Object.hasOwn(snapshot, "applications")) {
    throw new TypeError("Candidaturas não são públicas.");
  }
  if (!Array.isArray(snapshot.cities) || !Array.isArray(snapshot.institutions) || !Array.isArray(snapshot.events)) {
    throw new TypeError("Snapshot do Universitário inválido.");
  }
  for (const institution of snapshot.institutions) {
    if (!isObject(institution)) throw new TypeError("IES pública inválida.");
    if (Object.hasOwn(institution, "applicationNotes")) {
      throw new TypeError("Motivação não é pública.");
    }
    if (isObject(institution.ambassador) && Object.hasOwn(institution.ambassador, "applicationNotes")) {
      throw new TypeError("Motivação não é pública.");
    }
  }
}

export function loadUniversitiesIndex(
  filePath = fileURLToPath(new URL("../../public/universities/index.json", import.meta.url)),
): UniversitiesIndex {
  try {
    const snapshot = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assertPublicSnapshot(snapshot);
    return snapshot as unknown as UniversitiesIndex;
  } catch {
    return { generatedAt: null, cities: [], institutions: [], events: [] };
  }
}
