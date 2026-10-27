// Gate de paridade: URLs públicas no build Docusaurus (build/, referência) vs
// build Astro (frontend/dist/). Sai com código 1 se faltar URL.
// Cobertura (Fase 0.4): seções completas (inclui as app /admin, /membro,
// /auth) + páginas soltas de topo. Fora: /comunidades (0.5) e /@handle
// (geradas com API em build; ausentes na referência).
import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const OLD = join(ROOT, "build");
const NEW = join(ROOT, "frontend", "dist");

// Histórico: /^\/blog\/archive/ ficou excluído durante a 0.2 porque os stubs
// de redirect ainda não existiam; a Fase 0.3 (Task 13) criou os stubs em
// frontend/src/pages/blog/archive/ e a exclusão foi removida.
const EXCLUDE = [
  /^\/comunidades(\/|$)/, // Fase 0.5 (multi-tenant)
  /^\/@[^/]+/, // perfis públicos — só existem no build com API (0 na referência)
];

// Seções caminhadas recursivamente (o Docusaurus emite o índice da seção como
// arquivo irmão <seção>.html, não como <seção>/index.html — por isso o sibling).
const SECTIONS = ["admin", "membro", "auth", "blog", "trilhas", "eventos", "sobre", "participe", "quero", "membros", "certificado"];
// Páginas soltas na raiz: build/<nome>.html → /<nome>. "" é a homepage.
const TOP_LEVEL = [
  "",
  "contato",
  "projetos",
  "transparencia",
  "bio",
  "clube",
  "patrocinadores",
  "regex",
  "termos-de-compra",
  "team",
  "contact",
  "conduta",
  "ong",
  "timeline",
  "pais_responsaveis",
  "design-system",
];

function walk(dir, pattern) {
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

function toUrl(file, base) {
  let url = `/${relative(base, file).replace(/\\/g, "/")}`;
  if (url.endsWith("/index.html")) url = url.slice(0, -"index.html".length); // keep trailing dir
  else url = url.replace(/\.html$/, "");
  return url.replace(/\/$/, "") || "/";
}

function urlsOf(base, section) {
  const dir = join(base, section);
  // O Docusaurus emite o índice da seção como arquivo irmão (blog.html,
  // trilhas.html), não como <seção>/index.html — sem o sibling, /blog e
  // /trilhas ficam fora da comparação. No Astro o índice é <seção>/index.html
  // e o sibling simplesmente não existe (existsSync guarda os dois lados).
  const sibling = join(base, `${section}.html`);
  const files = [
    ...walk(dir, /\.html$/),
    ...walk(dir, /^(rss\.xml|atom\.xml|feed\.json)$/),
    ...(existsSync(sibling) ? [sibling] : []),
  ];
  return new Set(files.map((f) => toUrl(f, base)).filter((u) => !EXCLUDE.some((re) => re.test(u))));
}

function topLevelUrls(base) {
  // Docusaurus emite páginas de topo como <nome>.html na raiz; o Astro emite
  // <nome>/index.html. Aceitar os dois formatos de cada lado.
  const files = TOP_LEVEL.flatMap((name) =>
    name === "" ? [join(base, "index.html")] : [join(base, `${name}.html`), join(base, name, "index.html")],
  );
  return new Set(
    files
      .filter((f) => existsSync(f))
      .map((f) => toUrl(f, base))
      .filter((u) => !EXCLUDE.some((re) => re.test(u))),
  );
}

let missing = 0;
function compare(label, oldUrls, newUrls) {
  const absent = [...oldUrls].filter((u) => !newUrls.has(u));
  for (const url of absent) console.error(`✖ FALTA no build Astro: ${url}`);
  missing += absent.length;
  const extra = [...newUrls].filter((u) => !oldUrls.has(u));
  if (extra.length) console.log(`ℹ URLs novas em ${label} (não existiam no Docusaurus): ${extra.join(", ")}`);
  console.log(`→ ${label}: ${oldUrls.size} URLs na referência, ${absent.length === 0 ? "todas presentes" : "FALTANDO"}`);
}

for (const section of SECTIONS) {
  compare(`/${section}`, urlsOf(OLD, section), urlsOf(NEW, section));
}
compare("/", topLevelUrls(OLD), topLevelUrls(NEW));

if (missing > 0) {
  console.error(`✖ diff-urls: ${missing} URL(s) faltando`);
  process.exit(1);
}
console.log("✔ diff-urls: paridade 100% nas seções públicas cobertas");
