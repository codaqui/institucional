// Gera a referência versionada de URLs públicas (Fase 0.6): walk recursivo do
// build/ Docusaurus final (repo raiz — gitignored, acessado via symlink em
// worktrees) emitindo `scripts/url-reference.json`, um array JSON de URLs.
// Esse snapshot desacopla o gate `diff-urls.mjs` do build/ — que será deletado
// do repo junto com o Docusaurus numa task posterior do cutover — e congela a
// lista de URLs que o site novo precisa continuar servindo.
//
// Rode ANTES da deleção do Docusaurus/build (`node scripts/archive-urls.mjs`
// na pasta frontend/, com o build/ presente na raiz do repo). O script falha
// (exit 1) se o build/ estiver ausente — melhor que um snapshot vazio.
//
// Exclusões: /^\/@[^/]+/ (perfis públicos de membros — gerados com API em
// build time, não existem como arquivo no dist Astro).
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { collectPageUrls } from "./url-walk.mjs";

const EXCLUDE = [
  /^\/@[^/]+/, // perfis públicos — só existem no build com API (0 no dist)
];

const ROOT = join(import.meta.dirname, "..", "..");
const BUILD = join(ROOT, "build");
const OUT = join(import.meta.dirname, "url-reference.json");

export function archiveUrls({ buildDir = BUILD } = {}) {
  if (!existsSync(buildDir)) {
    throw new Error(
      `build/ de referência não encontrado em ${buildDir} — rode \`npm run build\` na raiz (Docusaurus) ou crie o symlink \`ln -s <repo>/build build\``,
    );
  }
  // Comparador explícito (code-unit, paridade com a geração original da
  // referência congelada) — sort() bare converteria para string de qualquer
  // forma, mas o Sonar exige intenção declarada.
  const urls = [...collectPageUrls(buildDir, { exclude: EXCLUDE })].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return urls;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  let urls;
  try {
    urls = archiveUrls();
  } catch (err) {
    console.error(`✖ archive-urls: ${err.message}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${JSON.stringify(urls, null, 2)}\n`);
  console.log(`✔ archive-urls: ${urls.length} URLs snapshotadas em scripts/url-reference.json`);
}
