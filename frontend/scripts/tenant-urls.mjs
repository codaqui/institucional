// Gate de allow-list por tenant (Fase 0.5): em builds `TENANT=<slug>`
// (Cloudflare Pages), verifica que as rotas canônicas do site whitelabel
// existem em dist/. Allow-list: "/", "/apoiar", "/transparencia", "/equipe";
// com posts em src/content/community-blog/<slug>/, "/blog" + os slugs lidos
// dos frontmatters (regex `^slug:\s*(.+)$`) + "/blog/tags" (quando o tenant
// tem a rota); "/docs" quando o tenant tem rota/conteúdo de docs. Sai com
// código 1 listando as URLs faltantes.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { TENANT_BY_NAME } from "../tenants.config.mjs";

/** Slug do frontmatter (primeira ocorrência de `slug:` por arquivo). */
const FRONTMATTER_SLUG_RE = /^slug:\s*(.+)$/m;

/** Base canônica de todo site whitelabel (rotas limpas). */
const BASE_URLS = ["/", "/apoiar", "/transparencia", "/equipe"];

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Slugs dos posts de `community-blog/<tenant>/` (frontmatter `slug:`). */
function blogSlugs(blogDir) {
  if (!isDir(blogDir)) return [];
  return readdirSync(blogDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => FRONTMATTER_SLUG_RE.exec(readFileSync(join(blogDir, name), "utf8"))?.[1]?.trim())
    .filter(Boolean);
}

/**
 * URLs exigidas no dist para o tenant. `rootDir` é a raiz do app Astro
 * (frontend/) — os conteúdos community-blog/community-docs vivem em
 * `src/content/` (fonte real, através dos symlinks dos src-tenants).
 */
export function requiredUrls({ tenant, rootDir }) {
  if (!TENANT_BY_NAME[tenant]) throw new Error(`Tenant desconhecido: ${tenant}`);
  const required = [...BASE_URLS];
  const slugs = blogSlugs(join(rootDir, "src", "content", "community-blog", tenant));
  if (slugs.length > 0) {
    required.push("/blog", ...slugs.map((slug) => `/blog/${slug}`));
    // /blog/tags é opcional: só existe quando o tenant tem a rota de tags.
    if (isDir(join(rootDir, "src-tenants", tenant, "pages", "blog", "tags"))) {
      required.push("/blog/tags");
    }
  }
  const hasDocsRoute = isDir(join(rootDir, "src-tenants", tenant, "pages", "docs"));
  const hasDocsContent = isDir(join(rootDir, "src", "content", "community-docs", tenant));
  if (hasDocsRoute || hasDocsContent) required.push("/docs");
  return required;
}

/**
 * Confere as URLs exigidas no `distDir`. Aceita as duas emissões de página
 * estática: `<url>/index.html` (Astro) e `<url>.html` (Docusaurus).
 */
export function checkTenantUrls({ distDir, tenant, rootDir }) {
  const distExists = isDir(distDir);
  const required = requiredUrls({ tenant, rootDir });
  const missing = [];
  const present = [];
  for (const url of required) {
    const rel = url === "/" ? "index.html" : `${url.slice(1)}/index.html`;
    const alt = url === "/" ? "index.html" : `${url.slice(1)}.html`;
    if (distExists && (existsSync(join(distDir, rel)) || existsSync(join(distDir, alt)))) {
      present.push(url);
    } else {
      missing.push(url);
    }
  }
  return { distExists, required, present, missing };
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [distArg, tenant] = process.argv.slice(2);
  if (!distArg || !tenant) {
    console.error("Uso: node scripts/tenant-urls.mjs <dist> <tenant>");
    process.exit(1);
  }
  const rootDir = join(import.meta.dirname, "..");
  const { distExists, present, missing } = checkTenantUrls({
    distDir: resolve(process.cwd(), distArg),
    tenant,
    rootDir,
  });
  if (!distExists) {
    console.error(`✖ tenant-urls (${tenant}): dist não encontrado em ${resolve(process.cwd(), distArg)}`);
    process.exit(1);
  }
  if (missing.length > 0) {
    console.error(`✖ tenant-urls (${tenant}): ${missing.length} URL(s) faltando em ${distArg}:`);
    for (const url of missing) console.error(`  - ${url}`);
    process.exit(1);
  }
  console.log(`✔ tenant-urls (${tenant}): ${present.length}/${present.length} URLs presentes (${present.join(", ")})`);
}
