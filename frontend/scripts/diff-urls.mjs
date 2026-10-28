// Gate de paridade (Fase 0.6): URLs públicas do site novo (frontend/dist/,
// build Astro) vs a referência versionada (scripts/url-reference.json —
// snapshot do build/ Docusaurus final gerado por archive-urls.mjs antes da
// deleção do Docusaurus no cutover). Sai com código 1 se alguma URL da
// referência não for servida pelo site novo.
//
// Histórico: na Fase 0.5 este gate caminhava o build/ Docusaurus diretamente
// (seções + top-level), com exclusões que foram removidas aos poucos
// (/^\/blog\/archive/ na 0.3 com os stubs, /^\/comunidades/ na Task 9). Na
// Fase 0.6 (cutover codaqui.dev) o build/ será deletado, então a referência
// virou um JSON versionado, e os redirects legados do Docusaurus (stubs
// RedirectStub deletados) passaram a viver no dist/_redirects de edge do
// Cloudflare Pages — gerado por build-tenant-redirects.mjs no build codaqui.
//
// URLs válidas do site novo = (arquivos .html/feeds do dist)
//   ∪ (sources de dist/_redirects) ∪ (targets de dist/_redirects).
// O brief da Fase 0.6 lista explicitamente os targets; os sources entram
// também porque a referência contém as URLs legadas que hoje respondem 301
// pelo edge (sem os sources o gate quebraria justamente nas 16 URLs que o
// _redirects preserva). Além disso cada target precisa resolver para uma
// página real do dist ou para outro source — redirect que aponta para o
// nada é quebrado.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { collectPageUrls, parseRedirects } from "./url-walk.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const NEW = join(ROOT, "frontend", "dist");
const REDIRECTS_FILE = join(NEW, "_redirects");
const REFERENCE_FILE = join(ROOT, "frontend", "scripts", "url-reference.json");

const EXCLUDE = [
  /^\/@[^/]+/, // perfis públicos — só existem com API em build (0 na referência)
];

// Guard anti falso-verde: sem a referência versionada (ou corrompida), o
// gate passaria vacuo. Regenerar exige o build/ Docusaurus ainda presente:
// `node scripts/archive-urls.mjs` (na pasta frontend/).
function loadReference() {
  if (!existsSync(REFERENCE_FILE)) {
    console.error(
      "✖ diff-urls: url-reference.json não encontrado — gere com `node scripts/archive-urls.mjs` (precisa do build/ Docusaurus, antes da deleção dele)",
    );
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(REFERENCE_FILE, "utf8"));
  } catch (err) {
    console.error(`✖ diff-urls: url-reference.json corrompido (${err.message}) — regenere com \`node scripts/archive-urls.mjs\``);
    process.exit(1);
  }
  if (!Array.isArray(parsed) || parsed.some((u) => typeof u !== "string")) {
    console.error("✖ diff-urls: url-reference.json inválido (esperado: array de strings) — regenere com `node scripts/archive-urls.mjs`");
    process.exit(1);
  }
  return new Set(parsed);
}

if (!existsSync(NEW)) {
  console.error("✖ diff-urls: frontend/dist não encontrado — rode `npm run build` no frontend");
  process.exit(1);
}

const reference = loadReference();
const distUrls = collectPageUrls(NEW, { exclude: EXCLUDE });

let redirects = { rules: [], sources: new Set(), targets: new Set() };
if (existsSync(REDIRECTS_FILE)) {
  redirects = parseRedirects(readFileSync(REDIRECTS_FILE, "utf8"));
}

// Targets com query string (ex.: /admin/lancamento?tab=transferencias)
// resolvem contra o path estático — a query é consumida client-side pela
// página destino. Normaliza para o path puro antes de checar existência.
const targetPath = (t) => t.split(/[?#]/)[0];
const targetPaths = new Set([...redirects.targets].map(targetPath));

// URLs servidas pelo site novo: páginas do dist + sources (respondem 301 no
// edge) + targets (precisam existir para os redirects não apontarem pro
// nada). O brief da Fase 0.6 lista explicitamente os targets; os sources
// entram também porque a referência contém as URLs legadas que hoje
// respondem 301 pelo edge (sem os sources o gate quebraria justamente nas 16
// URLs que o _redirects preserva).
const valid = new Set([...distUrls, ...redirects.sources, ...targetPaths]);

const absent = [...reference].filter((u) => !valid.has(u));
for (const url of absent) console.error(`✖ FALTA no site novo: ${url}`);

// Redirect para o nada: target (sem query) que não é página do dist nem
// outro source.
const dangling = [...targetPaths].filter(
  (t) => !distUrls.has(t) && !redirects.sources.has(t),
);
for (const target of dangling) console.error(`✖ _redirects com target sem página: ${target}`);

const extra = [...valid].filter((u) => !reference.has(u));
if (extra.length) {
  console.log(`ℹ URLs novas no site novo (não existiam na referência): ${extra.join(", ")}`);
}

if (absent.length > 0 || dangling.length > 0) {
  console.error(`✖ diff-urls: ${absent.length} URL(s) faltando, ${dangling.length} redirect(s) órfão(s)`);
  process.exit(1);
}
console.log(
  `✔ diff-urls: paridade 100% — ${reference.size} URLs na referência, ${extra.length} extras informativas (${distUrls.size} páginas no dist + ${redirects.rules.length} redirects)`,
);
