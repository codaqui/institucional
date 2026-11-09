import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "universities", "index.json");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} deve ser uma string não vazia.`);
  }
}

function validateCity(city) {
  if (!isObject(city)) throw new TypeError("Cidade inválida.");
  assertString(city.id, "city.id");
  assertString(city.name, "city.name");
  assertString(city.uf, "city.uf");
  if (typeof city.isActive !== "boolean") throw new TypeError("city.isActive deve ser boolean.");
}

function validateAmbassador(ambassador) {
  if (ambassador === null) return;
  if (!isObject(ambassador)) throw new TypeError("Embaixador inválido.");
  if (Object.hasOwn(ambassador, "applicationNotes")) {
    throw new TypeError("applicationNotes não é público.");
  }
  assertString(ambassador.githubHandle, "ambassador.githubHandle");
  assertString(ambassador.name, "ambassador.name");
  assertString(ambassador.avatarUrl, "ambassador.avatarUrl");
  if (ambassador.validUntil !== null && Number.isNaN(Date.parse(ambassador.validUntil))) {
    throw new TypeError("ambassador.validUntil inválida.");
  }
}

function validateInstitution(institution) {
  if (!isObject(institution)) throw new TypeError("IES inválida.");
  if (Object.hasOwn(institution, "applicationNotes")) {
    throw new TypeError("applicationNotes não é público.");
  }
  assertString(institution.id, "institution.id");
  assertString(institution.slug, "institution.slug");
  assertString(institution.name, "institution.name");
  if (institution.website !== null) assertString(institution.website, "institution.website");
  if (institution.city !== null) {
    if (!isObject(institution.city)) throw new TypeError("institution.city inválida.");
    assertString(institution.city.id, "institution.city.id");
    assertString(institution.city.name, "institution.city.name");
    assertString(institution.city.uf, "institution.city.uf");
  }
  validateAmbassador(institution.ambassador);
}

function validateEvent(event) {
  if (!isObject(event)) throw new TypeError("Evento inválido.");
  for (const field of ["id", "slug", "title", "status", "location", "institutionId"]) {
    assertString(event[field], `event.${field}`);
  }
  if (Number.isNaN(Date.parse(event.startAt))) throw new TypeError("event.startAt inválida.");
}

export function validateUniversitiesPayload(payload) {
  if (!isObject(payload)) throw new TypeError("Resposta inválida de /universities/public.");
  if (Object.hasOwn(payload, "applications")) {
    throw new TypeError("Candidaturas não são públicas.");
  }
  for (const field of ["cities", "institutions", "events"]) {
    if (!Array.isArray(payload[field])) throw new TypeError(`${field} deve ser um array.`);
  }
  payload.cities.forEach(validateCity);
  payload.institutions.forEach(validateInstitution);
  payload.events.forEach(validateEvent);
  return payload;
}

export async function syncUniversities({
  apiUrl = process.env.UNIVERSITIES_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/universities/public`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar o Universitário: HTTP ${response.status}`);
  }
  const payload = validateUniversitiesPayload(await response.json());
  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (
      typeof previous.generatedAt === "string" &&
      isDeepStrictEqual(
        { cities: previous.cities, institutions: previous.institutions, events: previous.events },
        { cities: payload.cities, institutions: payload.institutions, events: payload.events },
      )
    ) {
      return previous;
    }
  } catch {
    // Primeira execução ou snapshot ilegível: gravação completa.
  }

  const snapshot = { ...payload, generatedAt: now().toISOString() };
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
    await syncUniversities();
    console.log("✓ Universitário sincronizado em", DEFAULT_OUTPUT_FILE);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
