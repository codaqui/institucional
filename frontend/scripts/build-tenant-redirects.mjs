// Pós-build de tenants (Fase 0.5): em builds `TENANT=<slug>` (Cloudflare
// Pages), gera dist/_redirects desviando os paths do portal
// (/comunidades/<slug>/*, usados pelos configs das comunidades) para as rotas
// limpas do domínio próprio (/:splat). Sem TENANT, não escreve nada.
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

/**
 * Escreve `<distDir>/_redirects` quando `tenant` está setado. Resolve o slug
 * da comunidade pelo `community` do tenants.config.mjs. Retorna true se
 * escreveu; false quando não há tenant (build codaqui) ou o dist não existe.
 */
export function writeTenantRedirects({ tenant, distDir }) {
  if (!tenant) return false;
  const def = TENANT_BY_NAME[tenant];
  if (!def) throw new Error(`TENANT desconhecido: ${tenant}`);
  if (!existsSync(distDir)) return false;
  writeFileSync(join(distDir, "_redirects"), buildRedirectsText(def.community));
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
      ? `build-tenant-redirects: dist/_redirects escrito (TENANT=${process.env.TENANT})`
      : "build-tenant-redirects: sem TENANT (build codaqui) — nada a fazer",
  );
}
