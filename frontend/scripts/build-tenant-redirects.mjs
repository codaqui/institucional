// Pós-build de tenants (Fase 0.5): em builds `TENANT=<slug>` (Cloudflare
// Pages), gera dois artefatos em dist/:
//
// 1. `_redirects` — desvia os paths do portal (/comunidades/<slug>/*, usados
//    pelos configs das comunidades) para as rotas limpas do domínio próprio
//    (/:splat), com 301;
// 2. `robots.txt` — o public/robots.txt compartilhado aponta o Sitemap para
//    codaqui.dev (errado nos whitelabels, cujo sitemap é do domínio próprio),
//    então o build tenant sobrescreve com `Sitemap: <site do tenant>`.
//
// Sem TENANT, não escreve nada (build codaqui usa o public/robots.txt).
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { TENANT_BY_NAME } from "../tenants.config.mjs";

/** Conteúdo do _redirects: 301 de /comunidades/<slug>[/*] para [/][:splat]. */
export function buildRedirectsText(communitySlug) {
  return (
    `/comunidades/${communitySlug} / 301\n` +
    `/comunidades/${communitySlug}/* /:splat 301\n`
  );
}

/** Conteúdo do robots.txt do tenant: tudo permitido + Sitemap do domínio próprio. */
export function buildRobotsText(site) {
  return `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap-index.xml\n`;
}

/**
 * Escreve `<distDir>/_redirects` e `<distDir>/robots.txt` quando `tenant`
 * está setado. Resolve slug e site pelo tenants.config.mjs. Retorna true se
 * escreveu; false quando não há tenant (build codaqui) ou o dist não existe.
 */
export function writeTenantRedirects({ tenant, distDir }) {
  if (!tenant) return false;
  const def = TENANT_BY_NAME[tenant];
  if (!def) throw new Error(`TENANT desconhecido: ${tenant}`);
  if (!existsSync(distDir)) return false;
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
  console.log(
    wrote
      ? `build-tenant-redirects: dist/_redirects + dist/robots.txt escritos (TENANT=${process.env.TENANT})`
      : "build-tenant-redirects: sem TENANT (build codaqui) — nada a fazer",
  );
}
