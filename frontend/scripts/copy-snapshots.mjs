import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Copia os snapshots gerados pelos workflows do monorepo para public/ do Astro.
// POC 0.1: apenas o índice de eventos. 0.3: social-stats e analytics entram no
// pipeline (a Task 1 havia copiado analytics/index.json manualmente).
// TODO(0.3+): generalizar para os JSONs per-event de static/events/**.
const ROOT = join(import.meta.dirname, "..", "..");
const FRONTEND_PUBLIC = join(ROOT, "frontend", "public");

const snapshotDirs = ["events", "social-stats", "analytics"];
for (const dir of snapshotDirs) {
  mkdirSync(join(FRONTEND_PUBLIC, dir), { recursive: true });
  cpSync(
    join(ROOT, "static", dir, "index.json"),
    join(FRONTEND_PUBLIC, dir, "index.json"),
  );
}
console.log(`snapshots copiados: ${snapshotDirs.map((d) => `${d}/index.json`).join(", ")}`);

// Assets de static/img referenciados pelas páginas portadas (0.3) que ainda
// não existiam em public/img — cópia cirúrgica, não o diretório todo (4.3 MB).
const imgFiles = ["logo.png", "cncf-logo.png", "elasnocodigo-white.svg", "tisocial.png"];
mkdirSync(join(FRONTEND_PUBLIC, "img"), { recursive: true });
for (const file of imgFiles) {
  cpSync(join(ROOT, "static", "img", file), join(FRONTEND_PUBLIC, "img", file));
}
console.log(`snapshots copiados: img/{${imgFiles.join(", ")}}`);
