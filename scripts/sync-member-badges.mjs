import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "static", "badges");
const HANDLE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const hoursFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

export function renderMemberBadge(member) {
  const name = escapeXml(member.name);
  const details = ["Membro da Associação Codaqui"];
  if (member.joinedAt !== undefined) {
    details.push(`Desde ${new Date(member.joinedAt).getUTCFullYear()}`);
  }
  if (member.totalHours !== undefined) {
    details.push(`${hoursFormatter.format(member.totalHours)} horas aprovadas`);
  }
  const description = escapeXml(`${details.join(". ")}.`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="120" viewBox="0 0 640 120" role="img" aria-labelledby="badge-title badge-description">
  <title id="badge-title">Selo Codaqui de ${name}</title>
  <desc id="badge-description">${description}</desc>
  <rect width="640" height="120" rx="16" fill="rgb(255, 255, 255)"/>
  <rect width="12" height="120" rx="6" fill="rgb(55, 131, 105)"/>
  <text x="36" y="32" fill="rgb(44, 103, 83)" font-family="system-ui, sans-serif" font-size="14" font-weight="700">ASSOCIAÇÃO CODAQUI</text>
  <text x="36" y="64" fill="rgb(44, 103, 83)" font-family="system-ui, sans-serif" font-size="24" font-weight="700">${name}</text>
  <text x="36" y="94" fill="rgb(55, 131, 105)" font-family="system-ui, sans-serif" font-size="16">${description}</text>
</svg>
`;
}

function validatePayload(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError("Resposta inválida de /hours/public: esperado um array.");
  }
  const handles = new Set();
  for (const member of payload) {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      throw new TypeError("Membro inválido em /hours/public.");
    }
    if (typeof member.memberId !== "string" || member.memberId.length === 0) {
      throw new TypeError("Membro sem memberId em /hours/public.");
    }
    if (typeof member.githubHandle !== "string" || !HANDLE_PATTERN.test(member.githubHandle)) {
      throw new TypeError(`Handle inválido em /hours/public: ${String(member.githubHandle)}`);
    }
    const handleKey = member.githubHandle.toLowerCase();
    if (handles.has(handleKey)) throw new TypeError(`Handle duplicado em /hours/public: ${member.githubHandle}`);
    handles.add(handleKey);
    if (typeof member.name !== "string" || typeof member.badge !== "boolean") {
      throw new TypeError(`Dados inválidos para o handle ${member.githubHandle}.`);
    }
    if (member.joinedAt !== undefined && (
      typeof member.joinedAt !== "string" || Number.isNaN(new Date(member.joinedAt).getTime())
    )) {
      throw new TypeError(`Ano inválido para o handle ${member.githubHandle}.`);
    }
    if (member.totalHours !== undefined && (
      typeof member.totalHours !== "number" || !Number.isFinite(member.totalHours) || member.totalHours < 0
    )) {
      throw new TypeError(`Total de horas inválido para o handle ${member.githubHandle}.`);
    }
  }
  return payload;
}

async function atomicWrite(outputFile, content, renameImpl) {
  const temporaryFile = path.join(
    path.dirname(outputFile),
    `.${path.basename(outputFile)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryFile, content, "utf8");
    await renameImpl(temporaryFile, outputFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

async function readExistingBadges(outputDir) {
  const files = await readdir(outputDir, { withFileTypes: true });
  const badges = new Map();
  for (const file of files) {
    if (file.isFile() && file.name.endsWith(".svg")) {
      badges.set(file.name, await readFile(path.join(outputDir, file.name), "utf8"));
    }
  }
  return badges;
}

async function restoreBadges(outputDir, previousBadges, renameImpl) {
  const currentBadges = await readExistingBadges(outputDir);
  for (const file of currentBadges.keys()) {
    if (!previousBadges.has(file)) await rm(path.join(outputDir, file), { force: true });
  }
  for (const [file, content] of previousBadges) {
    if (currentBadges.get(file) !== content) {
      await atomicWrite(path.join(outputDir, file), content, renameImpl);
    }
  }
}

export async function syncMemberBadges({
  apiUrl = process.env.MEMBER_BADGES_API_URL ?? "http://localhost:3001",
  outputDir = DEFAULT_OUTPUT_DIR,
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/+$/, "")}/hours/public`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar horas públicas: HTTP ${response.status}`);
  }
  const members = validatePayload(await response.json());
  const desiredBadges = new Map(
    members
      .filter((member) => member.badge)
      .map((member) => [`${member.githubHandle}.svg`, renderMemberBadge(member)]),
  );

  await mkdir(outputDir, { recursive: true });
  const previousBadges = await readExistingBadges(outputDir);
  try {
    for (const [file, content] of desiredBadges) {
      await atomicWrite(path.join(outputDir, file), content, renameImpl);
    }
    for (const file of previousBadges.keys()) {
      if (!desiredBadges.has(file)) await rm(path.join(outputDir, file));
    }
  } catch (error) {
    try {
      await restoreBadges(outputDir, previousBadges, renameImpl);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], "Falha ao sincronizar e restaurar os selos.");
    }
    throw error;
  }

  return {
    written: desiredBadges.size,
    removed: [...previousBadges.keys()].filter((file) => !desiredBadges.has(file)).length,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const result = await syncMemberBadges();
    console.log(`✓ ${result.written} selos sincronizados; ${result.removed} obsoletos removidos em ${DEFAULT_OUTPUT_DIR}`);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
