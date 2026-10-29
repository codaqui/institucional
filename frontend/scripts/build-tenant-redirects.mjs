// Pós-build do frontend (Fases 0.5/0.6): em builds `TENANT=<slug>`
// (Cloudflare Pages), gera dois artefatos em dist/:
//
// 1. `_redirects` — desvia os paths do portal (/comunidades/<slug>/*, usados
//    pelos configs das comunidades) para as rotas limpas do domínio próprio
//    (/:splat), com 301;
// 2. `robots.txt` — o public/robots.txt compartilhado aponta o Sitemap para
//    codaqui.dev (errado nos whitelabels, cujo sitemap é do domínio próprio),
//    então o build tenant sobrescreve com `Sitemap: <site do tenant>`.
//
// Sem TENANT (build codaqui), escreve só o `dist/_redirects` com os redirects
// legados herdados do Docusaurus (Fase 0.6 — substituem as 16 páginas-stub
// RedirectStub deletadas do src/); o robots.txt segue o public/ compartilhado.
// (302 no /admin/transferencias para não cachear a query de tab no edge; os
// demais 301. Ordem: específicos antes de splats.)
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { TENANT_BY_NAME } from "../tenants.config.mjs";

/** Conteúdo do _redirects de tenants: 301 de /comunidades/<slug>[/*] para [/][:splat]. */
export function buildRedirectsText(communitySlug) {
  return (
    `/comunidades/${communitySlug} / 301\n` +
    `/comunidades/${communitySlug}/* /:splat 301\n`
  );
}

/** Conteúdo do _redirects do build codaqui: redirects legados (ex-stubs RedirectStub). */
export function buildCodaquiRedirectsText() {
  return [
    "/quero/estudar /participe/estudar 301",
    "/quero/apoiar /participe/apoiar 301",
    "/quero/mentoria /participe/mentoria 301",
    "/team /sobre/equipe 301",
    "/contact /contato 301",
    "/conduta /sobre/conduta 301",
    "/ong /sobre/ong 301",
    "/timeline /sobre/insights 301",
    "/sobre/timeline /sobre/insights 301",
    "/pais_responsaveis /sobre/pais-responsaveis 301",
    "/admin/transferencias /admin/lancamento?tab=transferencias 302",
    "/blog/archive /blog 301",
    "/blog/archive/2022 /blog 301",
    "/blog/archive/2023 /blog 301",
    "/blog/archive/2024 /blog 301",
    "/blog/archive/2025 /blog 301",
  ].join("\n") + "\n";
}

/** Conteúdo do robots.txt do tenant: tudo permitido + Sitemap do domínio próprio. */
export function buildRobotsText(site) {
  return `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap-index.xml\n`;
}

/**
 * Escreve os artefatos de redirect do build em `<distDir>`:
 * - com `tenant` setado: `_redirects` (regras da comunidade) + `robots.txt`
 *   (Sitemap do domínio próprio);
 * - sem `tenant` (build codaqui): `_redirects` com os redirects legados.
 *
 * Resolve slug e site pelo tenants.config.mjs. Retorna true se escreveu;
 * false quando o dist não existe.
 */
export function writeTenantRedirects({ tenant, distDir }) {
  if (!existsSync(distDir)) return false;
  if (!tenant) {
    writeFileSync(join(distDir, "_redirects"), buildCodaquiRedirectsText());
    return true;
  }
  const def = TENANT_BY_NAME[tenant];
  if (!def) throw new Error(`TENANT desconhecido: ${tenant}`);
  writeFileSync(join(distDir, "_redirects"), buildRedirectsText(def.community));
  writeFileSync(join(distDir, "robots.txt"), buildRobotsText(def.site));
  return true;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const distDir = join(import.meta.dirname, "..", "dist");
  const wrote = writeTenantRedirects({
    tenant: process.env.TENANT ?? null,
    distDir,
  });
  let message;
  if (!wrote) {
    message = `build-tenant-redirects: dist não encontrado em ${distDir} — nada escrito`;
  } else if (process.env.TENANT) {
    message = `build-tenant-redirects: dist/_redirects + dist/robots.txt escritos (TENANT=${process.env.TENANT})`;
  } else {
    message = "build-tenant-redirects: dist/_redirects dos redirects legados escritos (build codaqui)";
  }
  console.log(message);
}
