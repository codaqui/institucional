import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "announcements", "index.json");
const SEVERITIES = new Set(["info", "success", "warning", "error"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateString(value) {
  return value === null || value === undefined || (typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value)));
}

function assertSafeLink(linkUrl, linkLabel, index) {
  if (!linkUrl) {
    if (linkLabel !== null && linkLabel !== undefined) {
      throw new TypeError(`Anúncio inválido no índice ${index}: linkLabel exige linkUrl.`);
    }
    return;
  }
  if (typeof linkLabel !== "string" || linkLabel.trim().length === 0 || linkLabel.length > 60) {
    throw new TypeError(`Anúncio inválido no índice ${index}: linkLabel é obrigatório e limitado a 60 caracteres.`);
  }
  if (linkUrl.includes("://") || linkUrl.startsWith("//")) {
    let parsed;
    try {
      parsed = new URL(linkUrl);
    } catch {
      throw new TypeError(`Anúncio inválido no índice ${index}: linkUrl externo inválido.`);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new TypeError(`Anúncio inválido no índice ${index}: linkUrl externo deve usar HTTPS sem credenciais.`);
    }
  } else if (!linkUrl.startsWith("/")) {
    throw new TypeError(`Anúncio inválido no índice ${index}: linkUrl deve ser caminho interno ou HTTPS.`);
  }
}

function hasMarkdownLink(text) {
  const labelEnd = text.indexOf("](");
  return labelEnd > 0 && text.slice(0, labelEnd).includes("[") && text.indexOf(")", labelEnd + 2) > labelEnd + 2;
}

function validateAnnouncement(announcement, index) {
  if (!isObject(announcement)) throw new TypeError(`Anúncio inválido no índice ${index}: esperado um objeto.`);
  if (Object.hasOwn(announcement, "createdById") || Object.hasOwn(announcement, "updatedById")) {
    throw new TypeError(`Anúncio inválido no índice ${index}: autores não são públicos.`);
  }
  if (typeof announcement.id !== "string" || announcement.id.trim().length === 0) {
    throw new TypeError(`Anúncio inválido no índice ${index}: id deve ser uma string não vazia.`);
  }
  if (typeof announcement.text !== "string" || announcement.text.trim().length < 3 || announcement.text.length > 280 || /[<>]/.test(announcement.text) || hasMarkdownLink(announcement.text)) {
    throw new TypeError(`Anúncio inválido no índice ${index}: texto deve ter 3–280 caracteres, sem HTML/Markdown.`);
  }
  if (!SEVERITIES.has(announcement.severity)) {
    throw new TypeError(`Anúncio inválido no índice ${index}: severity inválida.`);
  }
  if (announcement.linkUrl !== null && announcement.linkUrl !== undefined && typeof announcement.linkUrl !== "string") {
    throw new TypeError(`Anúncio inválido no índice ${index}: linkUrl deve ser string.`);
  }
  assertSafeLink(announcement.linkUrl, announcement.linkLabel, index);
  if (!isDateString(announcement.startsAt) || !isDateString(announcement.endsAt)) {
    throw new TypeError(`Anúncio inválido no índice ${index}: janela deve conter datas válidas ou null.`);
  }
  if (announcement.startsAt && announcement.endsAt && Date.parse(announcement.endsAt) <= Date.parse(announcement.startsAt)) {
    throw new TypeError(`Anúncio inválido no índice ${index}: endsAt deve ser posterior a startsAt.`);
  }
}

function validatePayload(payload) {
  if (!Array.isArray(payload)) throw new TypeError("Resposta inválida de /announcements/public: esperado um array.");
  payload.forEach((announcement, index) => validateAnnouncement(announcement, index));
  return payload;
}

export async function syncAnnouncements({
  apiUrl = process.env.ANNOUNCEMENTS_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/announcements/public`);
  if (!response.ok) throw new Error(`Falha ao consultar anúncios: HTTP ${response.status}`);
  const announcements = validatePayload(await response.json());

  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (typeof previous.generatedAt === "string" && isDeepStrictEqual(previous.announcements, announcements)) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para gravação completa.
  }

  const snapshot = { generatedAt: now().toISOString(), announcements };
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
    const snapshot = await syncAnnouncements();
    const announcementCount = Number.parseInt(String(snapshot.announcements.length), 10);
    console.log(`✓ Announcements sincronizados em ${DEFAULT_OUTPUT_FILE} (${announcementCount})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✖ ${message.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")}`);
    process.exitCode = 1;
  }
}
