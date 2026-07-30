#!/usr/bin/env node
// Valida arquivos de override de eventos:
//   static/events/<source>/<sourceId>/<eventId>.override.json
// o arquivo de ownerships de organizers:
//   static/events/organizers.json
// e os snapshots da fonte internal (gerados pelo force-sync do backend):
//   static/events/internal/<sourceId>/<eventId|index>.json
//   static/events/index.json
//
// Uso:
//   node scripts/validate-overrides.mjs [arquivos...]
//
// Com argumentos, valida a lista fornecida (ex.: `git diff --name-only` do PR —
// qualquer arquivo fora do padrao na lista indica PR misto e falha). Sem
// argumentos, varre static/events/**/*.override.json + organizers.json.
//
// Delecoes: se um arquivo da lista nao existe em disco (foi deletado no PR),
// o path ainda precisa casar o padrao, mas a validacao de conteudo e pulada.
//
// Sai com codigo 1 se qualquer arquivo for invalido, 0 caso contrario.

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const OVERRIDE_PATH_RE = /^static\/events\/[^/]+\/[^/]+\/[^/]+\.override\.json$/;
export const ORGANIZERS_PATH = "static/events/organizers.json";
// Manifesto público de overrides (atualizado no mesmo PR de cada override)
export const OVERRIDES_INDEX_PATH = "static/events/overrides-index.json";
// Snapshots da fonte internal:codaqui (force-sync via POST /events/internal/snapshot)
export const INTERNAL_SNAPSHOT_PATH_RE = /^static\/events\/internal\/[^/]+\/[^/]+\.json$/;
export const EVENTS_INDEX_PATH = "static/events/index.json";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// scope: <source>:<sourceId>:<eventId|*> — 3 segmentos nao vazios
const SCOPE_RE = /^[^/:]+:[^/:]+:[^/:]+$/;
// chave do manifesto: <source>:<sourceId>:<eventId> — sem wildcard
const EVENT_KEY_RE = /^[^/:*]+:[^/:*]+:[^/:*]+$/;

// Campos que nunca sao sobrescreviveis (docs/EVENT_PLAN.md — "Schema do Override")
const FORBIDDEN_EXTEND_FIELDS = ["id", "startAt", "endAt", "href", "source", "sourceId", "status"];
const STRING_EXTEND_FIELDS = ["imageUrl", "summary", "location", "title"];
const MAX_SUMMARY_LENGTH = 500;
const MAX_TAGS = 10;
const MAX_SPEAKERS = 10;

export function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

/** Regras do extendData — compartilhadas entre *.override.json e o manifesto. */
export function validateExtendData(ext, label) {
  const errors = [];
  for (const key of FORBIDDEN_EXTEND_FIELDS) {
    if (key in ext) {
      errors.push(`${label}: campo proibido: extendData.${key}`);
    }
  }

  for (const field of STRING_EXTEND_FIELDS) {
    if (ext[field] !== undefined && typeof ext[field] !== "string") {
      errors.push(`${label}: extendData.${field} deve ser uma string`);
    }
  }

  if (ext.featured !== undefined && typeof ext.featured !== "boolean") {
    errors.push(`${label}: extendData.featured deve ser um boolean`);
  }

  if (ext.tags !== undefined) {
    if (!Array.isArray(ext.tags) || ext.tags.some((tag) => typeof tag !== "string")) {
      errors.push(`${label}: extendData.tags deve ser um array de strings`);
    } else if (ext.tags.length > MAX_TAGS) {
      errors.push(`${label}: extendData.tags excede ${MAX_TAGS} itens (${ext.tags.length})`);
    }
  }

  if (typeof ext.summary === "string" && ext.summary.length > MAX_SUMMARY_LENGTH) {
    errors.push(`${label}: extendData.summary excede ${MAX_SUMMARY_LENGTH} caracteres (${ext.summary.length})`);
  }

  if (ext.speakers !== undefined) {
    if (!Array.isArray(ext.speakers)) {
      errors.push(`${label}: extendData.speakers deve ser um array`);
    } else if (ext.speakers.length > MAX_SPEAKERS) {
      errors.push(`${label}: extendData.speakers excede ${MAX_SPEAKERS} itens (${ext.speakers.length})`);
    }
  }

  if (ext.workloadMinutes !== undefined) {
    if (
      typeof ext.workloadMinutes !== "number" ||
      !Number.isInteger(ext.workloadMinutes) ||
      ext.workloadMinutes < 0 ||
      ext.workloadMinutes > 1000
    ) {
      errors.push(`${label}: extendData.workloadMinutes deve ser um inteiro entre 0 e 1000`);
    }
  }

  return errors;
}

export function validateOverrideData(data, filePath) {
  const label = filePath;

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [`${label}: conteudo deve ser um objeto JSON`];
  }

  const errors = [];
  const parts = normalizePath(filePath).split("/");
  const source = parts[2];
  const sourceId = parts[3];
  const fileEventId = parts[4].replace(/\.override\.json$/, "");

  if (typeof data.eventId !== "string" || data.eventId.length === 0) {
    errors.push(`${label}: campo obrigatorio "eventId" ausente ou nao e uma string`);
  } else if (data.eventId !== fileEventId) {
    errors.push(`${label}: eventId "${data.eventId}" diverge do nome do arquivo ("${fileEventId}")`);
  }

  const expectedSourceKey = `${source}:${sourceId}`;
  if (typeof data.sourceKey !== "string" || data.sourceKey.length === 0) {
    errors.push(`${label}: campo obrigatorio "sourceKey" ausente ou nao e uma string`);
  } else if (data.sourceKey !== expectedSourceKey) {
    errors.push(`${label}: sourceKey "${data.sourceKey}" diverge do path (esperado "${expectedSourceKey}")`);
  }

  if (data.extendData !== undefined) {
    if (data.extendData === null || typeof data.extendData !== "object" || Array.isArray(data.extendData)) {
      errors.push(`${label}: "extendData" deve ser um objeto`);
    } else {
      errors.push(...validateExtendData(data.extendData, label));
    }
  }

  return errors;
}

/** Manifesto público de overrides (static/events/overrides-index.json). */
export function validateOverridesIndexData(data, filePath) {
  const label = filePath;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [`${label}: conteudo deve ser um objeto JSON`];
  }
  const errors = [];
  if (typeof data.version !== "number" || !Number.isFinite(data.version)) {
    errors.push(`${label}: campo obrigatorio "version" ausente ou nao e um numero`);
  }
  if (data.overrides === null || typeof data.overrides !== "object" || Array.isArray(data.overrides)) {
    errors.push(`${label}: campo obrigatorio "overrides" ausente ou nao e um objeto`);
    return errors;
  }
  for (const [key, entry] of Object.entries(data.overrides)) {
    const entryLabel = `${label}: overrides["${key}"]`;
    if (!EVENT_KEY_RE.test(key)) {
      errors.push(`${entryLabel} chave fora do formato <source>:<sourceId>:<eventId>`);
      continue;
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${entryLabel} deve ser um objeto`);
      continue;
    }
    if (entry.extendData === null || typeof entry.extendData !== "object" || Array.isArray(entry.extendData)) {
      errors.push(`${entryLabel}.extendData deve ser um objeto`);
      continue;
    }
    errors.push(...validateExtendData(entry.extendData, entryLabel));
  }
  return errors;
}

export function validateOrganizersData(data, filePath) {
  const label = filePath;

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [`${label}: conteudo deve ser um objeto JSON`];
  }

  const errors = [];

  if (typeof data.version !== "number" || !Number.isFinite(data.version)) {
    errors.push(`${label}: campo obrigatorio "version" ausente ou nao e um numero`);
  }

  if (!Array.isArray(data.ownerships)) {
    errors.push(`${label}: campo obrigatorio "ownerships" ausente ou nao e um array`);
    return errors;
  }

  data.ownerships.forEach((entry, index) => {
    const entryLabel = `${label}: ownerships[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${entryLabel} deve ser um objeto`);
      return;
    }
    if (typeof entry.memberId !== "string" || !UUID_RE.test(entry.memberId)) {
      errors.push(`${entryLabel}.memberId deve ser um uuid`);
    }
    if (typeof entry.githubHandle !== "string" || entry.githubHandle.length === 0) {
      errors.push(`${entryLabel}.githubHandle deve ser uma string nao vazia`);
    }
    if (!Array.isArray(entry.scope) || entry.scope.some((s) => typeof s !== "string" || !SCOPE_RE.test(s))) {
      errors.push(`${entryLabel}.scope deve ser um array de strings no formato <source>:<sourceId>:<eventId|*>`);
    }
  });

  return errors;
}

/** Snapshot agregado raiz (static/events/index.json) — validacao estrutural leve. */
export function validateEventsIndexData(data, filePath) {
  const label = filePath;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [`${label}: conteudo deve ser um objeto JSON`];
  }
  const errors = [];
  if (typeof data.generatedAt !== "string" || data.generatedAt.length === 0) {
    errors.push(`${label}: campo obrigatorio "generatedAt" ausente ou nao e uma string`);
  }
  if (!Array.isArray(data.sources)) {
    errors.push(`${label}: campo obrigatorio "sources" ausente ou nao e um array`);
  }
  if (!Array.isArray(data.events)) {
    errors.push(`${label}: campo obrigatorio "events" ausente ou nao e um array`);
  }
  return errors;
}

/** Snapshot da fonte internal (por evento ou index da fonte) — validacao leve. */
export function validateInternalSnapshotData(data, filePath) {
  const label = filePath;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [`${label}: conteudo deve ser um objeto JSON`];
  }
  const isSourceIndex = normalizePath(filePath).endsWith("/index.json");
  if (isSourceIndex) {
    return Array.isArray(data.events)
      ? []
      : [`${label}: campo obrigatorio "events" ausente ou nao e um array`];
  }
  const errors = [];
  if (data.event === null || typeof data.event !== "object" || Array.isArray(data.event)) {
    errors.push(`${label}: campo obrigatorio "event" ausente ou nao e um objeto`);
  } else {
    if (typeof data.event.id !== "string" || data.event.id.length === 0) {
      errors.push(`${label}: event.id ausente ou nao e uma string`);
    }
    if (typeof data.event.title !== "string" || data.event.title.length === 0) {
      errors.push(`${label}: event.title ausente ou nao e uma string`);
    }
  }
  return errors;
}

export async function validateFile(filePath, rootDir = process.cwd()) {  const normalized = normalizePath(filePath);

  const isInternalSnapshot = INTERNAL_SNAPSHOT_PATH_RE.test(normalized);
  const isEventsIndex = normalized === EVENTS_INDEX_PATH;
  const isOverridesIndex = normalized === OVERRIDES_INDEX_PATH;
  if (
    normalized !== ORGANIZERS_PATH &&
    !OVERRIDE_PATH_RE.test(normalized) &&
    !isInternalSnapshot &&
    !isEventsIndex &&
    !isOverridesIndex
  ) {
    return [
      `${filePath}: fora do padrao permitido (*.override.json, ${ORGANIZERS_PATH}, ${OVERRIDES_INDEX_PATH}, static/events/internal/**/*.json ou ${EVENTS_INDEX_PATH}) — PR misto?`
    ];
  }

  const absPath = path.join(rootDir, normalized);
  if (!existsSync(absPath)) {
    // Delecao: path valido, conteudo ignorado.
    return [];
  }

  let data;
  try {
    data = JSON.parse(await readFile(absPath, "utf8"));
  } catch (error) {
    return [`${normalized}: JSON invalido: ${error.message}`];
  }

  if (normalized === ORGANIZERS_PATH) {
    return validateOrganizersData(data, normalized);
  }
  if (isEventsIndex) {
    return validateEventsIndexData(data, normalized);
  }
  if (isOverridesIndex) {
    return validateOverridesIndexData(data, normalized);
  }
  if (isInternalSnapshot) {
    return validateInternalSnapshotData(data, normalized);
  }

  return validateOverrideData(data, normalized);
}

export async function collectOverrideFiles(rootDir = process.cwd()) {
  const eventsDir = path.join(rootDir, "static", "events");
  let entries;
  try {
    entries = await readdir(eventsDir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".override.json"))
    .map((entry) =>
      normalizePath(path.join("static/events", path.relative(eventsDir, path.join(entry.parentPath, entry.name))))
    )
    .filter((relativePath) => OVERRIDE_PATH_RE.test(relativePath));
  if (existsSync(path.join(eventsDir, "organizers.json"))) {
    files.push(ORGANIZERS_PATH);
  }
  if (existsSync(path.join(eventsDir, "overrides-index.json"))) {
    files.push(OVERRIDES_INDEX_PATH);
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : await collectOverrideFiles();

  if (files.length === 0) {
    console.log("Nenhum arquivo .override.json/organizers.json para validar.");
    return;
  }

  const allErrors = [];
  for (const file of files) {
    allErrors.push(...(await validateFile(file)));
  }

  if (allErrors.length > 0) {
    console.error(`✗ ${allErrors.length} problema(s) encontrado(s):`);
    for (const error of allErrors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`✓ ${files.length} arquivo(s) de override/organizers valido(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
