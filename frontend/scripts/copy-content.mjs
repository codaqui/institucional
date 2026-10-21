// Copia as fontes canônicas de conteúdo (blog/ e trilhas/ na raiz, usadas pelo
// Docusaurus até a Fase 0.6) para dentro do app Astro, separando corpo (content
// collections) de assets (public/). Roda em predev/prebuild, idempotente.
import { cpSync, rmSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const FRONTEND = join(ROOT, "frontend");

const onlyMarkdown = (src) => {
  if (src.includes(`${sep}img${sep}`) || src.includes(`${sep}assets${sep}`)) return false;
  if (src.endsWith(`${sep}img`) || src.endsWith(`${sep}assets`)) return false; // dir raiz não tem separador depois
  if (src.endsWith("authors.yml")) return false;
  return true; // diretórios e demais arquivos passam; .md/.mdx são filtrados pelo glob loader
};

const copies = [
  { from: join(ROOT, "blog"), to: join(FRONTEND, "src", "content", "blog"), filter: onlyMarkdown },
  { from: join(ROOT, "trilhas"), to: join(FRONTEND, "src", "content", "trilhas"), filter: onlyMarkdown },
  { from: join(ROOT, "blog", "img"), to: join(FRONTEND, "public", "blog-assets", "img") },
  { from: join(ROOT, "trilhas", "github", "assets"), to: join(FRONTEND, "public", "trilhas-assets", "github", "assets") },
];

for (const { from, to, filter } of copies) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, ...(filter ? { filter } : {}) });
}
console.log(`copy-content: ${copies.length} origens copiadas`);
