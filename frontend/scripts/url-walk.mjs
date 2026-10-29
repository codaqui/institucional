// Walk recursivo de diretórios de build + conversão arquivo→URL pública.
// Módulo comum (Fase 0.6) entre `archive-urls.mjs` (gera a referência
// versionada url-reference.json a partir do build/ Docusaurus final) e
// `diff-urls.mjs` (gate de paridade contra o dist/ Astro) — as regras de
// mapeamento precisam ser idênticas nos dois lados, senão o gate compara
// maçãs com laranjas.
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Arquivos que viram página pública: páginas HTML e feeds RSS/Atom/JSON. */
export const PAGE_PATTERN = /\.html$/;
export const FEED_PATTERN = /^(rss\.xml|atom\.xml|feed\.json)$/;

/**
 * Walk iterativo de `dir` retornando paths absolutos dos arquivos cujo nome
 * casa `pattern`. Diretório ausente retorna lista vazia (o caller decide se
 * isso é erro).
 */
export function walkFiles(dir, pattern) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (pattern.test(entry.name)) out.push(full);
    }
  }
  return out;
}

/**
 * Converte um arquivo de `base` para sua URL pública:
 * - `<dir>/index.html` → `<dir>/` (com trailing slash, normalizada depois)
 * - `<nome>.html` → `<nome>` (sem extensão)
 * - demais (feeds) → path verbatim
 * Trailing slash é removida e a homepage vira "/".
 */
export function fileToUrl(file, base) {
  let url = `/${relative(base, file).replaceAll("\\", "/")}`;
  if (url.endsWith("/index.html")) url = url.slice(0, -"index.html".length); // keep trailing dir
  else url = url.replace(/\.html$/, "");
  return url.replace(/\/$/, "") || "/";
}

/**
 * Todas as URLs de páginas sob `base` (walk recursivo de .html + feeds),
 * com as URLs casando alguma regex de `exclude` removidas. Retorna um Set.
 */
export function collectPageUrls(base, { exclude = [] } = {}) {
  const files = [
    ...walkFiles(base, PAGE_PATTERN),
    ...walkFiles(base, FEED_PATTERN),
  ];
  return new Set(
    files
      .map((f) => fileToUrl(f, base))
      .filter((u) => !exclude.some((re) => re.test(u))),
  );
}

/**
 * Faz o parse do texto de um `_redirects` do Cloudflare Pages (uma regra por
 * linha: `<from> <to> <status>`; comentários `#` e linhas vazias ignorados).
 * Retorna `{ rules, sources, targets }` — rules na ordem do arquivo,
 * sources/targets como Sets de URLs (path+query verbatim, sem status).
 */
export function parseRedirects(text) {
  const rules = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const [from, to, status] = parts;
    rules.push({ from, to, status: status ?? null });
  }
  return {
    rules,
    sources: new Set(rules.map((r) => r.from)),
    targets: new Set(rules.map((r) => r.to)),
  };
}
