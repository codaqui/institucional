// Gate de paridade: URLs públicas de /blog e /trilhas no build Docusaurus (build/,
// referência) vs build Astro (frontend/dist/). Sai com código 1 se faltar URL.
import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const OLD = join(ROOT, "build");
const NEW = join(ROOT, "frontend", "dist");

// Stubs de redirect fora do escopo da 0.2 (Fase 0.3 — páginas públicas).
const EXCLUDE = [/^\/blog\/archive/];

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
  // /trilhas ficam fora da comparação.
  const sibling = join(base, `${section}.html`);
  const files = [
    ...walk(dir, /\.html$/),
    ...walk(dir, /^(rss\.xml|atom\.xml|feed\.json)$/),
    ...(existsSync(sibling) ? [sibling] : []),
  ];
  return new Set(files.map((f) => toUrl(f, base)).filter((u) => !EXCLUDE.some((re) => re.test(u))));
}

let missing = 0;
for (const section of ["blog", "trilhas"]) {
  const oldUrls = urlsOf(OLD, section);
  const newUrls = urlsOf(NEW, section);
  for (const url of oldUrls) {
    if (!newUrls.has(url)) {
      console.error(`✖ FALTA no build Astro: ${url}`);
      missing++;
    }
  }
  const extra = [...newUrls].filter((u) => !oldUrls.has(u));
  if (extra.length) console.log(`ℹ URLs novas (não existiam no Docusaurus): ${extra.join(", ")}`);
  console.log(`→ /${section}: ${oldUrls.size} URLs na referência, ${missing === 0 ? "todas presentes" : "FALTANDO"}`);
}

if (missing > 0) {
  console.error(`✖ diff-urls: ${missing} URL(s) faltando`);
  process.exit(1);
}
console.log("✔ diff-urls: paridade 100% em /blog e /trilhas");
