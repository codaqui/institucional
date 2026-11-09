import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "projects", "index.json");
const PRIVATE_FIELDS = new Set([
  "createdById", "registeredById", "internalNotes", "entityId", "approvedById",
  "idempotencyKey", "reportedById", "budget", "attachments", "rejectReason",
]);

function invalidProject(index, detail) {
  return new TypeError(`Projeto inválido em /projects/public no índice ${index}: ${detail}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateString(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isOptionalDateString(value) {
  return value === null || isDateString(value);
}

function validateProject(project, index) {
  if (!isObject(project)) throw invalidProject(index, "esperado um objeto.");
  for (const [field, value] of Object.entries(project)) {
    if (PRIVATE_FIELDS.has(field)) throw invalidProject(index, `${field} não é público.`);
  }
  for (const field of ["id", "kind", "name", "slug", "summary", "status"]) {
    if (typeof project[field] !== "string" || project[field].trim().length === 0) {
      throw invalidProject(index, `${field} deve ser uma string não vazia.`);
    }
  }
  if (project.status !== "active") throw invalidProject(index, "somente projetos ativos são públicos.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) throw invalidProject(index, "slug inválido.");
  if (!isObject(project.entity) || typeof project.entity.slug !== "string" || typeof project.entity.name !== "string") {
    throw invalidProject(index, "entity precisa conter slug e nome.");
  }
  if (project.mentor !== null && (!isObject(project.mentor) || typeof project.mentor.name !== "string" || typeof project.mentor.handle !== "string")) {
    throw invalidProject(index, "mentor precisa ser null ou conter nome e handle.");
  }
  for (const field of ["startsAt", "endsAt", "registrationStartsAt", "registrationEndsAt"]) {
    if (!isOptionalDateString(project[field])) throw invalidProject(index, `${field} deve ser null ou uma data válida.`);
  }
  if (!Number.isInteger(project.odsPrimary) || project.odsPrimary < 1 || project.odsPrimary > 17) {
    throw invalidProject(index, "odsPrimary deve estar entre 1 e 17.");
  }
  if (!Array.isArray(project.odsSecondary) || project.odsSecondary.some((value) => !Number.isInteger(value) || value < 1 || value > 17 || value === project.odsPrimary)) {
    throw invalidProject(index, "odsSecondary inválida.");
  }
  if (typeof project.targetCommunity !== "string" || project.targetCommunity.trim().length === 0) {
    throw invalidProject(index, "targetCommunity deve ser uma string não vazia.");
  }
  if (typeof project.totalHours !== "number" || !(project.totalHours > 0)) {
    throw invalidProject(index, "totalHours deve ser positivo.");
  }
  if (!Number.isInteger(project.maxParticipants) || project.maxParticipants < 0) {
    throw invalidProject(index, "maxParticipants deve ser um inteiro não negativo.");
  }
  if (!Array.isArray(project.schedule) || project.schedule.length === 0) {
    throw invalidProject(index, "schedule deve conter encontros.");
  }
  const totalCents = project.schedule.reduce((sum, item) => sum + Math.round(item.carga * 100), 0);
  if (totalCents !== Math.round(project.totalHours * 100)) {
    throw invalidProject(index, "schedule não corresponde a totalHours.");
  }
}

export function validateProjectsPayload(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError("Resposta inválida de /projects/public: esperado um array.");
  }
  payload.forEach((project, index) => validateProject(project, index));
  return payload;
}

export async function syncProjects({
  apiUrl = process.env.PROJECTS_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/projects/public`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar projetos: HTTP ${response.status}`);
  }
  const projects = validateProjectsPayload(await response.json());
  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (typeof previous.generatedAt === "string" && isDeepStrictEqual(previous.projects, projects)) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para gravação completa.
  }

  const snapshot = { generatedAt: now().toISOString(), projects };
  const outputDirectory = path.dirname(outputFile);
  const temporaryFile = path.join(outputDirectory, `.${path.basename(outputFile)}.${randomUUID()}.tmp`);
  await mkdir(outputDirectory, { recursive: true });
  try {
    await writeFile(temporaryFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await renameImpl(temporaryFile, outputFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
  return snapshot;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    await syncProjects();
    console.log("✓ Projetos sincronizados em", DEFAULT_OUTPUT_FILE);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
