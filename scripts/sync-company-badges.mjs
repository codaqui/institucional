import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "static", "badges", "empresas");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_FIELDS = new Set(["id", "name", "tradeName", "tier", "sealValidUntil"]);

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

export function renderCompanyBadge(company) {
  const name = escapeXml(company.tradeName ?? company.name);
  const label = company.tier === "aliada" ? "Empresa Aliada Codaqui" : "Empresa Amiga Codaqui";
  const validity = company.tier === "aliada"
    ? `Válido até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(company.sealValidUntil))}`
    : "Apoio ativo";
  const description = escapeXml(`${label}. ${validity}.`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="120" viewBox="0 0 640 120" role="img" aria-labelledby="badge-title badge-description">
  <title id="badge-title">Selo ${label} de ${name}</title>
  <desc id="badge-description">${description}</desc>
  <rect width="640" height="120" rx="16" fill="rgb(255, 255, 255)"/>
  <rect width="12" height="120" rx="6" fill="rgb(55, 131, 105)"/>
  <text x="36" y="32" fill="rgb(44, 103, 83)" font-family="system-ui, sans-serif" font-size="14" font-weight="700">ASSOCIAÇÃO CODAQUI</text>
  <text x="36" y="64" fill="rgb(44, 103, 83)" font-family="system-ui, sans-serif" font-size="24" font-weight="700">${label}</text>
  <text x="36" y="94" fill="rgb(55, 131, 105)" font-family="system-ui, sans-serif" font-size="16">${name} · ${description}</text>
</svg>
`;
}

function validateCompanyIdentity(company, ids) {
  if (!company || typeof company !== "object" || Array.isArray(company)) {
    throw new TypeError("Empresa inválida em /companies/badges/public.");
  }
  for (const field of Object.keys(company)) {
    if (!PUBLIC_FIELDS.has(field)) throw new TypeError(`Campo não público em /companies/badges/public: ${field}.`);
  }
  if (typeof company.id !== "string" || !UUID_PATTERN.test(company.id)) {
    throw new TypeError(`UUID inválido em /companies/badges/public: ${String(company.id)}`);
  }
  if (ids.has(company.id)) throw new TypeError(`Empresa duplicada: ${company.id}.`);
  ids.add(company.id);
}

function validateCompanyFields(company) {
  if (typeof company.name !== "string" || company.name.trim().length === 0) {
    throw new TypeError(`Nome inválido para ${company.id}.`);
  }
  if (company.tradeName !== null && typeof company.tradeName !== "string") {
    throw new TypeError(`Nome fantasia inválido para ${company.id}.`);
  }
  if (company.tier !== "amiga" && company.tier !== "aliada") {
    throw new TypeError(`Tier inválido para ${company.id}.`);
  }
  if (company.tier === "aliada" && (typeof company.sealValidUntil !== "string" || Number.isNaN(Date.parse(company.sealValidUntil)))) {
    throw new TypeError(`Validade inválida para ${company.id}.`);
  }
  if (company.tier === "amiga" && company.sealValidUntil !== null) {
    throw new TypeError(`Empresa Amiga não deve ter validade de selo: ${company.id}.`);
  }
}

function validatePayload(payload) {
  if (!Array.isArray(payload)) throw new TypeError("Resposta inválida de /companies/badges/public: esperado um array.");
  const ids = new Set();
  for (const company of payload) {
    validateCompanyIdentity(company, ids);
    validateCompanyFields(company);
  }
  return payload;
}

async function atomicWrite(outputFile, content, renameImpl) {
  const temporaryFile = path.join(path.dirname(outputFile), `.${path.basename(outputFile)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, content, "utf8");
    await renameImpl(temporaryFile, outputFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

async function settleAll(promises) {
  const results = await Promise.allSettled(promises);
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

async function readExistingBadges(outputDir) {
  try {
    const files = await readdir(outputDir, { withFileTypes: true });
    const entries = await Promise.all(files
      .filter((file) => file.isFile() && file.name.endsWith(".svg"))
      .map(async (file) => [file.name, await readFile(path.join(outputDir, file.name), "utf8")]));
    return new Map(entries);
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

async function restoreBadges(outputDir, previousBadges, renameImpl) {
  const currentBadges = await readExistingBadges(outputDir);
  await settleAll([...currentBadges.keys()]
    .filter((file) => !previousBadges.has(file))
    .map((file) => rm(path.join(outputDir, file), { force: true })));
  await settleAll([...previousBadges]
    .filter(([file, content]) => currentBadges.get(file) !== content)
    .map(([file, content]) => atomicWrite(path.join(outputDir, file), content, renameImpl)));
}

export async function syncCompanyBadges({
  apiUrl = process.env.COMPANY_BADGES_API_URL ?? "http://localhost:3001",
  outputDir = DEFAULT_OUTPUT_DIR,
  fetchImpl = fetch,
  renameImpl = rename,
} = {}) {
  const baseApiUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  const response = await fetchImpl(`${baseApiUrl}/companies/badges/public`);
  if (!response.ok) throw new Error(`Falha ao consultar selos de empresas: HTTP ${response.status}`);
  const companies = validatePayload(await response.json());
  const desiredBadges = new Map(companies.map((company) => [`${company.id}.svg`, renderCompanyBadge(company)]));

  await mkdir(outputDir, { recursive: true });
  const previousBadges = await readExistingBadges(outputDir);
  try {
    await settleAll([...desiredBadges].map(([file, content]) => atomicWrite(path.join(outputDir, file), content, renameImpl)));
    await settleAll([...previousBadges.keys()]
      .filter((file) => !desiredBadges.has(file))
      .map((file) => rm(path.join(outputDir, file))));
  } catch (error) {
    await restoreBadges(outputDir, previousBadges, renameImpl).catch((restoreError) => {
      throw new AggregateError([error, restoreError], "Falha ao sincronizar e restaurar os selos de empresas.");
    });
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
    const result = await syncCompanyBadges();
    console.log(`✓ Selos de empresas sincronizados em ${DEFAULT_OUTPUT_DIR} (${result.written} escritos, ${result.removed} removidos)`);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
