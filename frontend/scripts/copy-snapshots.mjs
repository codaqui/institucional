import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Copia os snapshots gerados pelos workflows do monorepo para public/ do Astro.
// POC 0.1: apenas o índice de eventos. 0.3: social-stats e analytics entram no
// pipeline (a Task 1 havia copiado analytics/index.json manualmente).
// Limitação conhecida: só os index.json sobem — os ~421 JSONs per-event de
// static/events/** ficam de fora. Nenhum consumidor do app (build ou runtime)
// faz fetch deles hoje (itemPath é só metadado do índice), então a cópia
// completa fica para quando existir um beneficiário.
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
const copiedIndexes = snapshotDirs.map((d) => `${d}/index.json`).join(", ");
console.log(`snapshots copiados: ${copiedIndexes}`);

// Assets de static/img referenciados pelas páginas portadas (0.3) que ainda
// não existiam em public/img — cópia cirúrgica, não o diretório todo (4.3 MB).
// og-elasnocodigo.jpg é o socialImage do config da comunidade (OG das páginas
// /comunidades/elasnocodigo/* e do build tenant). og-tisocial.jpg é o
// socialImage da T.I. Social (OG de /comunidades/tisocial/* e do build tenant
// — deferido da T5). og-devparana.jpg é o socialImage do DevParaná (OG das
// páginas do build tenant — QA wave 0.5: antes só existia no Docusaurus e o
// Pages servia HTML no /img/og-devparana.jpg do tenant, quebrando o OG).
// campostech.svg/og-campostech.jpg são o logo e o socialImage da CamposTech
// (wrappers /comunidades/campostechpg, Task 9 — a comunidade não é tenant,
// então só existem os wrappers no portal).
const imgFiles = ["logo.png", "cncf-logo.png", "elasnocodigo-white.svg", "tisocial.png", "og-elasnocodigo.jpg", "og-tisocial.jpg", "og-devparana.jpg", "devparana-hero.jpg", "campostech.svg", "og-campostech.jpg"];
mkdirSync(join(FRONTEND_PUBLIC, "img"), { recursive: true });
for (const file of imgFiles) {
  cpSync(join(ROOT, "static", "img", file), join(FRONTEND_PUBLIC, "img", file));
}
console.log(`snapshots copiados: img/{${imgFiles.join(", ")}}`);

// Diretórios de assets de comunidades sob static/img (avatares locais que os
// data/teams referenciam em /img/comunidades/<slug>/...). Hoje: mentores da
// CamposTech (12 jpgs usados pela página /comunidades/campostechpg/mentores).
const imgDirs = ["comunidades/campostechpg/mentores"];
for (const dir of imgDirs) {
  cpSync(join(ROOT, "static", "img", dir), join(FRONTEND_PUBLIC, "img", dir), {
    recursive: true,
  });
}
console.log(`snapshots copiados: img/{${imgDirs.join(", ")}}/ (recursivo)`);
