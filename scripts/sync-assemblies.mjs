import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "assemblies", "index.json");
const ASSEMBLY_TYPES = new Set(["ordinaria", "oficial"]);
const ASSEMBLY_STATUSES = new Set(["scheduled", "held", "canceled"]);
const ASSEMBLY_DISCUSSION_URL_PATTERN = /^https:\/\/github\.com\/codaqui\/institucional\/discussions\/[1-9]\d*$/;
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

function invalidAssembly(index, detail) {
  return new TypeError(`Assembleia inválida em /assemblies/public no índice ${index}: ${detail}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateString(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isTrustedPdfUrl(value) {
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

function validateAssemblyText(assembly, index) {
  for (const field of ["id", "title", "agendaSummary", "discussionUrl"]) {
    if (typeof assembly[field] !== "string" || assembly[field].trim().length === 0) {
      throw invalidAssembly(index, `${field} deve ser uma string não vazia.`);
    }
  }
  if (!ASSEMBLY_DISCUSSION_URL_PATTERN.test(assembly.discussionUrl)) {
    throw invalidAssembly(index, "discussionUrl deve ser a URL exata da Discussion do repositório.");
  }
}

function validateAssemblyIdentity(assembly, index) {
  if (!ASSEMBLY_TYPES.has(assembly.type)) throw invalidAssembly(index, "type inválido.");
  if (!Number.isSafeInteger(assembly.number) || assembly.number < 1) {
    throw invalidAssembly(index, "number deve ser um inteiro positivo.");
  }
  if (assembly.slug !== `${assembly.type}-${assembly.number}`) {
    throw invalidAssembly(index, "slug não corresponde a type e number.");
  }
  if (!ASSEMBLY_STATUSES.has(assembly.status)) throw invalidAssembly(index, "status inválido.");
}

function validateAssemblyDatesAndPdf(assembly, index) {
  for (const field of ["scheduledAt", "createdAt", "updatedAt"]) {
    if (!isDateString(assembly[field])) throw invalidAssembly(index, `${field} deve ser uma data válida.`);
  }
  if (assembly.heldAt !== null && !isDateString(assembly.heldAt)) {
    throw invalidAssembly(index, "heldAt deve ser null ou uma data válida.");
  }
  if (assembly.ataPdfUrl !== null && !isTrustedPdfUrl(assembly.ataPdfUrl)) {
    throw invalidAssembly(index, "ataPdfUrl deve usar HTTPS e a allowlist de armazenamento.");
  }
}

function validateAssemblyNotary(assembly, index) {
  if (assembly.notaryRegistry === null) return;
  if (!isObject(assembly.notaryRegistry)) {
    throw invalidAssembly(index, "notaryRegistry deve ser null ou um objeto.");
  }
  const registry = assembly.notaryRegistry;
  if (typeof registry.book !== "string" || registry.book.trim().length === 0) {
    throw invalidAssembly(index, "notaryRegistry.book deve ser uma string não vazia.");
  }
  if (typeof registry.page !== "string" || registry.page.trim().length === 0) {
    throw invalidAssembly(index, "notaryRegistry.page deve ser uma string não vazia.");
  }
  if (!isDateString(registry.registeredAt)) {
    throw invalidAssembly(index, "notaryRegistry.registeredAt deve ser uma data válida.");
  }
}

function validateAssemblyTransition(assembly, index) {
  if (assembly.status === "held" && assembly.heldAt === null) {
    throw invalidAssembly(index, "heldAt é obrigatório para realizar assembleia.");
  }
  if (assembly.heldAt !== null && Date.parse(assembly.heldAt) < Date.parse(assembly.scheduledAt)) {
    throw invalidAssembly(index, "heldAt não pode ser anterior a scheduledAt.");
  }
  if (
    assembly.type === "oficial" &&
    assembly.status === "held" &&
    (!assembly.ataPdfUrl || assembly.notaryRegistry === null)
  ) {
    throw invalidAssembly(index, "Assembleia oficial realizada exige PDF e cartório completo.");
  }
}

function validateAssembly(assembly, index) {
  if (!isObject(assembly)) throw invalidAssembly(index, "esperado um objeto.");
  if (Object.hasOwn(assembly, "createdById")) throw invalidAssembly(index, "createdById não é público.");
  validateAssemblyText(assembly, index);
  validateAssemblyIdentity(assembly, index);
  validateAssemblyDatesAndPdf(assembly, index);
  validateAssemblyNotary(assembly, index);
  validateAssemblyTransition(assembly, index);
}

const LOG_CONTROL_ESCAPES = new Map([
  ["\n", String.raw`\n`],
  ["\r", String.raw`\r`],
  ["\t", String.raw`\t`],
]);

function escapeLogControlCharacter(character) {
  return LOG_CONTROL_ESCAPES.get(character) ??
    `\\x${character.codePointAt(0).toString(16).padStart(2, "0")}`;
}

export function sanitizeErrorForLog(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f-\u009f]/g, escapeLogControlCharacter);
}

function validatePayload(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError("Resposta inválida de /assemblies/public: esperado um array.");
  }
  payload.forEach((assembly, index) => validateAssembly(assembly, index));
  return payload;
}

export async function syncAssemblies({
  apiUrl = process.env.ASSEMBLIES_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/assemblies/public`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar assembleias: HTTP ${response.status}`);
  }

  const assemblies = validatePayload(await response.json());
  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (
      typeof previous.generatedAt === "string" &&
      isDeepStrictEqual(previous.assemblies, assemblies)
    ) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para uma gravação completa.
  }

  const snapshot = {
    generatedAt: now().toISOString(),
    assemblies,
  };
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
    const snapshot = await syncAssemblies();
    console.log("✓", snapshot.assemblies.length, "assembleias sincronizadas em", DEFAULT_OUTPUT_FILE);
  } catch (error) {
    console.error(`✖ ${sanitizeErrorForLog(error)}`);
    process.exitCode = 1;
  }
}
