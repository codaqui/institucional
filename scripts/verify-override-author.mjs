#!/usr/bin/env node
// Verifica se o autor de um PR de override/organizers é quem deveria ser.
//
// Regras de segurança para auto-merge:
//   1. PRs que tocam organizers.json NUNCA passam (review manual obrigatório).
//   2. Cada arquivo .override.json alterado deve declarar ownerHandle igual ao
//      login GitHub do autor do PR (quem abriu o PR).
//   3. O PR deve ter exatamente 1 commit, e esse commit deve ser do mesmo
//      autor que abriu o PR (impede pushes extras no branch).
//   4. Snapshots internal e index.json são ignorados para fins de autor
//      (gerados pelo force-sync do backend, que já loga quem solicitou).
//
// Uso:
//   node scripts/verify-override-author.mjs <PR_NUMBER>
//
// Env:
//   GITHUB_TOKEN — token com permissão para ler PRs/commits.
//   GITHUB_REPOSITORY — owner/repo (ex.: codaqui/institucional).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const GITHUB_API = "https://api.github.com";
export const ORGANIZERS_PATH = "static/events/organizers.json";
export const OVERRIDE_PATH_RE = /^static\/events\/[^/]+\/[^/]+\/[^/]+\.override\.json$/;

export function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isOverridePath(filePath) {
  return OVERRIDE_PATH_RE.test(normalizePath(filePath));
}

export async function githubGet(path, token, fetchImpl = fetch) {
  const res = await fetchImpl(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API GET ${path} falhou (HTTP ${res.status}): ${text}`);
  }
  return res.json();
}

export async function getPrAuthor(prNumber, repo, token, fetchImpl = fetch) {
  const pr = await githubGet(`/repos/${repo}/pulls/${prNumber}`, token, fetchImpl);
  return pr.user?.login ?? null;
}

export async function getPrCommits(prNumber, repo, token, fetchImpl = fetch) {
  return githubGet(`/repos/${repo}/pulls/${prNumber}/commits?per_page=100`, token, fetchImpl);
}

export async function getChangedFiles(prNumber, repo, token, fetchImpl = fetch) {
  const files = await githubGet(`/repos/${repo}/pulls/${prNumber}/files?per_page=100`, token, fetchImpl);
  return files.map((f) => f.filename);
}

export async function readExpectedOwner(filePath, readFileImpl = readFile, existsImpl = existsSync) {
  const normalized = normalizePath(filePath);
  // Aceita tanto paths relativos canônicos quanto paths absolutos de teste
  // que terminam no padrão de override.
  const looksLikeOverride =
    isOverridePath(normalized) ||
    OVERRIDE_PATH_RE.test(normalized.replace(/^.*?(static\/events\/)/, "$1"));
  if (!looksLikeOverride) return null;
  if (!existsImpl(filePath)) return null; // deleção não valida autor
  try {
    const data = JSON.parse(await readFileImpl(filePath, "utf8"));
    return typeof data.ownerHandle === "string" ? data.ownerHandle.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Verifica se o PR pode ser auto-mergeado do ponto de vista de autor/commit.
 * Retorna um objeto { ok: true } ou { ok: false, reason: string }.
 */
export async function verifyOverrideAuthor({
  prNumber,
  repo,
  token,
  fetchImpl = fetch,
  readFileImpl = readFile,
  existsImpl = existsSync,
}) {
  const prAuthor = await getPrAuthor(prNumber, repo, token, fetchImpl);
  if (!prAuthor) {
    return { ok: false, reason: "Não foi possível determinar o autor do PR." };
  }

  const changedFiles = await getChangedFiles(prNumber, repo, token, fetchImpl);

  // Regra 1: organizers.json exige review manual.
  if (changedFiles.some((f) => normalizePath(f) === ORGANIZERS_PATH)) {
    return {
      ok: false,
      reason: "organizers.json alterado — auto-merge bloqueado (review manual obrigatório).",
    };
  }

  // Regra 2: autor do PR deve ser o ownerHandle de cada override.
  const overrideFiles = changedFiles.filter(isOverridePath);
  for (const file of overrideFiles) {
    const expectedOwner = await readExpectedOwner(file, readFileImpl, existsImpl);
    if (!expectedOwner) {
      return { ok: false, reason: `${file}: ownerHandle ausente — auto-merge bloqueado.` };
    }
    if (expectedOwner !== prAuthor.toLowerCase()) {
      return {
        ok: false,
        reason: `${file}: ownerHandle "${expectedOwner}" diverge do autor do PR "${prAuthor}".`,
      };
    }
  }

  // Regra 3: exatamente 1 commit, do mesmo autor do PR.
  const commits = await getPrCommits(prNumber, repo, token, fetchImpl);
  if (commits.length !== 1) {
    return {
      ok: false,
      reason: `PR possui ${commits.length} commit(s). Apenas 1 commit permitido para auto-merge.`,
    };
  }

  const commitAuthor = commits[0].author?.login;
  if (!commitAuthor) {
    return {
      ok: false,
      reason: "Commit não possui autor associado a uma conta GitHub.",
    };
  }
  if (commitAuthor.toLowerCase() !== prAuthor.toLowerCase()) {
    return {
      ok: false,
      reason: `Autor do commit (@${commitAuthor}) diverge do autor do PR (@${prAuthor}).`,
    };
  }

  return { ok: true, prAuthor, commitAuthor, changedFiles };
}

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber || /^\d+$/.test(prNumber) === false) {
    console.error("Uso: node scripts/verify-override-author.mjs <PR_NUMBER>");
    process.exitCode = 1;
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN não definido.");
    process.exitCode = 1;
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error("GITHUB_REPOSITORY não definido.");
    process.exitCode = 1;
    return;
  }

  const result = await verifyOverrideAuthor({ prNumber, repo, token });
  if (!result.ok) {
    console.error(`✗ ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log(`PR #${prNumber} aberto por @${result.prAuthor}`);
  console.log(`Arquivos alterados: ${result.changedFiles.join(", ") || "nenhum"}`);
  console.log(`✓ Autor do commit (@${result.commitAuthor}) bate com autor do PR.`);
  console.log("✓ PR pode ser auto-mergeado.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
