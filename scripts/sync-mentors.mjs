import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "mentors", "index.json");
const MENTOR_FIELDS = new Set(["id", "handle", "name", "avatarUrl", "areas", "focus", "availability"]);
const AVAILABILITY_FIELDS = new Set(["weekday", "startTime", "endTime", "timeZone"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(value, allowed, label) {
  if (!isObject(value)) throw new TypeError(`${label} deve ser um objeto.`);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new TypeError(`${label} contém campo não público: ${field}.`);
  }
}

function validateMentor(mentor, index) {
  assertExactFields(mentor, MENTOR_FIELDS, `Mentor ${index}`);
  for (const field of ["id", "handle", "name", "avatarUrl"]) {
    if (typeof mentor[field] !== "string" || mentor[field].trim().length === 0) {
      throw new TypeError(`Mentor ${index}: ${field} deve ser uma string não vazia.`);
    }
  }
  if (mentor.focus !== null && typeof mentor.focus !== "string") {
    throw new TypeError(`Mentor ${index}: focus deve ser string ou null.`);
  }
  if (!Array.isArray(mentor.areas) || mentor.areas.length === 0 || mentor.areas.some((area) => typeof area !== "string" || !area.trim())) {
    throw new TypeError(`Mentor ${index}: areas deve conter strings não vazias.`);
  }
  if (!Array.isArray(mentor.availability)) throw new TypeError(`Mentor ${index}: availability deve ser um array.`);
  mentor.availability.forEach((rule, ruleIndex) => {
    assertExactFields(rule, AVAILABILITY_FIELDS, `Mentor ${index}, regra ${ruleIndex}`);
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      throw new TypeError(`Mentor ${index}, regra ${ruleIndex}: weekday inválido.`);
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.endTime) || rule.startTime >= rule.endTime) {
      throw new TypeError(`Mentor ${index}, regra ${ruleIndex}: horário inválido.`);
    }
    if (typeof rule.timeZone !== "string" || !rule.timeZone) {
      throw new TypeError(`Mentor ${index}, regra ${ruleIndex}: timeZone inválido.`);
    }
  });
}

function validateInsights(insights) {
  if (!isObject(insights)) throw new TypeError("insights deve ser um objeto.");
  for (const field of ["completed", "activeMentors"]) {
    if (!Number.isInteger(insights[field]) || insights[field] < 0) throw new TypeError(`insights.${field} inválido.`);
  }
  if (typeof insights.noShowRate !== "number" || insights.noShowRate < 0 || insights.noShowRate > 1) {
    throw new TypeError("insights.noShowRate deve estar entre 0 e 1.");
  }
  if (!Array.isArray(insights.areas)) throw new TypeError("insights.areas deve ser um array.");
  insights.areas.forEach((item, index) => {
    if (!isObject(item) || typeof item.area !== "string" || !item.area.trim()
      || !Number.isInteger(item.mentors) || item.mentors < 0
      || !Number.isInteger(item.completed) || item.completed < 0) {
      throw new TypeError(`insights.areas[${index}] inválido.`);
    }
  });
}

export function validateMentorsPayload(payload) {
  if (!isObject(payload) || !Array.isArray(payload.mentors)) {
    throw new TypeError("Resposta inválida de /mentorship/public: mentors deve ser um array.");
  }
  payload.mentors.forEach(validateMentor);
  validateInsights(payload.insights);
  return payload;
}

export async function syncMentors({
  apiUrl = process.env.MENTORS_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/mentorship/public`);
  if (!response.ok) throw new Error(`Falha ao consultar mentores: HTTP ${response.status}`);
  const { mentors, insights } = validateMentorsPayload(await response.json());
  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (typeof previous.generatedAt === "string"
      && isDeepStrictEqual(previous.mentors, mentors)
      && isDeepStrictEqual(previous.insights, insights)) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para gravação completa.
  }

  const snapshot = { generatedAt: now().toISOString(), mentors, insights };
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
    await syncMentors();
    console.log("✓ Mentores sincronizados em", DEFAULT_OUTPUT_FILE);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
