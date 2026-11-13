import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "c4p", "index.json");
const PUBLIC_STATUSES = new Set(["open", "closed"]);

// Campos que nunca podem aparecer no snapshot público (notas, comentários e
// contato dos palestrantes são restritos à curadoria).
const FORBIDDEN_KEYS = new Set([
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNoForbiddenKeys(value, trail) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${trail}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new TypeError(`Campo privado "${key}" em ${trail} não é público.`);
    }
    assertNoForbiddenKeys(nested, `${trail}.${key}`);
  }
}

function validateCall(call, index) {
  if (!isObject(call)) throw new TypeError(`Campanha inválida no índice ${index}: esperado um objeto.`);
  assertNoForbiddenKeys(call, `calls[${index}]`);
  if (typeof call.slug !== "string" || call.slug.trim().length === 0) {
    throw new TypeError(`Campanha inválida no índice ${index}: slug deve ser uma string não vazia.`);
  }
  if (typeof call.name !== "string" || call.name.trim().length === 0) {
    throw new TypeError(`Campanha inválida no índice ${index}: name deve ser uma string não vazia.`);
  }
  if (!PUBLIC_STATUSES.has(call.status)) {
    throw new TypeError(`Campanha inválida no índice ${index}: status deve ser "open" ou "closed".`);
  }
  if (call.results !== null && call.results !== undefined) {
    if (!isObject(call.results) || !Array.isArray(call.results.talks)) {
      throw new TypeError(`Campanha inválida no índice ${index}: results deve ser null ou conter talks[].`);
    }
    call.results.talks.forEach((talk, talkIndex) => {
      if (!isObject(talk) || typeof talk.title !== "string" || typeof talk.speakerName !== "string") {
        throw new TypeError(`Resultado inválido em calls[${index}].results.talks[${talkIndex}].`);
      }
    });
  }
}

function validatePayload(payload) {
  if (!isObject(payload) || !Array.isArray(payload.calls)) {
    throw new TypeError('Resposta inválida de /c4p/public/snapshot: esperado { calls: [...] }.');
  }
  payload.calls.forEach((call, index) => validateCall(call, index));
  return payload;
}

export async function syncC4p({
  apiUrl = process.env.C4P_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/c4p/public/snapshot`);
  if (!response.ok) throw new Error(`Falha ao consultar campanhas de C4P: HTTP ${response.status}`);
  const payload = validatePayload(await response.json());

  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (typeof previous.generatedAt === "string" && isDeepStrictEqual(previous.calls, payload.calls)) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para gravação completa.
  }

  const snapshot = { generatedAt: now().toISOString(), calls: payload.calls };
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
    const snapshot = await syncC4p();
    const callCount = Number.parseInt(String(snapshot.calls.length), 10);
    console.log(`✓ C4P sincronizado em ${DEFAULT_OUTPUT_FILE} (${callCount} campanhas)`);
  } catch (error) {
    console.error(`✗ Falha ao sincronizar C4P: ${error.message}`);
    process.exitCode = 1;
  }
}
