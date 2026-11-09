import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface PublicProject {
  id: string;
  kind: string;
  name: string;
  slug: string;
  summary: string;
  status: "active";
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

function assertPublicProject(project: Record<string, unknown>): void {
  if (Object.keys(project).some((field) => PRIVATE_FIELDS.has(field))) {
    throw new TypeError("Snapshot de projetos contém campos privados.");
  }
  if (typeof project.id !== "string" || typeof project.name !== "string" || typeof project.slug !== "string") {
    throw new TypeError("Projeto público inválido.");
  }
  if (project.status !== "active") throw new TypeError("Projeto fora do status público.");
  if (!isObject(project.entity) || typeof project.entity.slug !== "string" || typeof project.entity.name !== "string") {
    throw new TypeError("Entidade pública inválida.");
  }
}

export function projectPath(project: Pick<PublicProject, "slug">): string {
  return `/projetos/${project.slug}`;
}

export function loadProjectsIndex(
  filePath = fileURLToPath(new URL("../../public/projects/index.json", import.meta.url)),
): { generatedAt: string; projects: PublicProject[] } {
  try {
    const raw = readFileSync(filePath, "utf8");
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
