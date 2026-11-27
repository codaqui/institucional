import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type ProjectCategory = "program" | "extension" | "campaign" | "open_source";

export interface PublicProject {
  id: string;
  kind: string | null;
  category: ProjectCategory;
  canonicalUrl: string | null;
  name: string;
  slug: string;
  summary: string;
  status: "active" | "finished";
  startsAt: string | null;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  odsPrimary: number;
  odsSecondary: number[];
  targetCommunity: string;
  totalHours: number;
  schedule: Array<{ numero: number; descricao: string; carga: number }>;
  maxParticipants: number;
  entity: { slug: string; name: string };
  mentor: { name: string; handle: string } | null;
}

const PRIVATE_FIELDS = new Set([
  "createdById", "registeredById", "internalNotes", "entityId", "approvedById",
  "idempotencyKey", "reportedById", "budget", "attachments", "rejectReason",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalUrl(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function assertPublicProject(project: Record<string, unknown>): void {
  if (Object.keys(project).some((field) => PRIVATE_FIELDS.has(field))) {
    throw new TypeError("Snapshot de projetos contém campos privados.");
  }
  if (typeof project.id !== "string" || typeof project.name !== "string" || typeof project.slug !== "string") {
    throw new TypeError("Projeto público inválido.");
  }
  if (project.status !== "active" && project.status !== "finished") throw new TypeError("Projeto fora do status público.");
  if ((project.category ?? "extension") === "extension" && project.status !== "active") {
    throw new TypeError("Extensão fora do status público.");
  }
  if (project.category !== undefined && (typeof project.category !== "string" || !["program", "extension", "campaign", "open_source"].includes(project.category))) {
    throw new TypeError("Categoria pública inválida.");
  }
  if (!isCanonicalUrl(project.canonicalUrl)) throw new TypeError("URL canônica pública inválida.");
  if (!isObject(project.entity) || typeof project.entity.slug !== "string" || typeof project.entity.name !== "string") {
    throw new TypeError("Entidade pública inválida.");
  }
}

export function projectPath(project: Pick<PublicProject, "slug">): string {
  return `/projetos/${project.slug}`;
}

export function projectHref(project: Pick<PublicProject, "slug" | "canonicalUrl">): string {
  return project.canonicalUrl ?? projectPath(project);
}

export function groupProjectsByCategory(
  projects: PublicProject[],
): Array<{ category: ProjectCategory; projects: PublicProject[] }> {
  const order: ProjectCategory[] = ["program", "extension", "campaign", "open_source"];
  return order.flatMap((category) => {
    const matching = projects.filter((project) => (project.category ?? "extension") === category);
    return matching.length > 0 ? [{ category, projects: matching }] : [];
  });
}

export function resolveProjectsSnapshotPath(
  moduleUrl = import.meta.url,
  cwd = process.cwd(),
): string {
  const candidates = [
    fileURLToPath(new URL("../../public/projects/index.json", moduleUrl)),
    join(cwd, "public", "projects", "index.json"),
    join(cwd, "frontend", "public", "projects", "index.json"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function loadProjectsIndex(
  filePath?: string,
): { generatedAt: string; projects: PublicProject[] } {
  try {
    const raw = readFileSync(filePath ?? resolveProjectsSnapshotPath(), "utf8");
    const snapshot = JSON.parse(raw) as { generatedAt: string; projects: Record<string, unknown>[] };
    if (typeof snapshot.generatedAt !== "string" || !Array.isArray(snapshot.projects)) {
      throw new TypeError("Snapshot de projetos inválido.");
    }
    snapshot.projects.forEach((project) => {
      if (!isObject(project)) throw new TypeError("Projeto público inválido.");
      assertPublicProject(project);
    });
    return { generatedAt: snapshot.generatedAt, projects: snapshot.projects as unknown as PublicProject[] };
  } catch {
    return { generatedAt: "", projects: [] };
  }
}
