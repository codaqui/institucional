// Gate de allow-list por tenant (Fase 0.5): em builds `TENANT=<slug>`
// (Cloudflare Pages), verifica que as rotas canônicas do site whitelabel
// existem em dist/. Allow-list: "/", "/apoiar", "/transparencia", "/equipe" e
// "/auth/callback" (pós-OAuth do login das ilhas); com posts em
// src/content/community-blog/<slug>/, "/blog" + os slugs lidos dos
// frontmatters (regex `^slug:\s*(.+)$`) + "/blog/tags" (quando o tenant tem a
// rota); "/docs" quando o tenant tem rota/conteúdo de docs; extras por tenant
// (ex.: devparana tem /embaixadores e /rfcs). Também exige dist/404.html —
// sem ele o Pages serve a homepage com status 200 para URLs inexistentes
// (soft-404). Sai com código 1 listando as URLs faltantes.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { TENANT_BY_NAME } from "../tenants.config.mjs";

/** Slug do frontmatter (primeira ocorrência de `slug:` por arquivo). */
// `[^\S\r\n]`/`[^\r\n]` no lugar de `\s`/`.$` com flag m: o original
// (`/^slug:\s*(.+)$/m`) tinha sobreposição de quantificadores (backtracking
// super-linear no Sonar) — classes negadas deixam o padrão linear.
const FRONTMATTER_SLUG_RE = /^slug:[^\S\r\n]*([^\r\n]+)/m;

/** Base canônica de todo site whitelabel (rotas limpas). */
const BASE_URLS = ["/", "/apoiar", "/transparencia", "/equipe", "/auth/callback"];

/** Rotas canônicas extras por tenant (além da base comum). */
const TENANT_EXTRA_URLS = {
  devparana: ["/embaixadores", "/rfcs"],
};

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
  const required = [...BASE_URLS, ...(TENANT_EXTRA_URLS[tenant] ?? [])];
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
 * Também reporta `has404` — dist/404.html é o que impede o soft-404 no
 * Cloudflare Pages.
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
  const has404 = distExists && existsSync(join(distDir, "404.html"));
  return { distExists, has404, required, present, missing };
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
  const { distExists, has404, present, missing } = checkTenantUrls({
    distDir: resolve(process.cwd(), distArg),
    tenant,
    rootDir,
  });
  if (!distExists) {
    console.error(`✖ tenant-urls (${tenant}): dist não encontrado em ${resolve(process.cwd(), distArg)}`);
    process.exit(1);
  }
  let failed = false;
  if (missing.length > 0) {
    failed = true;
    console.error(`✖ tenant-urls (${tenant}): ${missing.length} URL(s) faltando em ${distArg}:`);
    for (const url of missing) console.error(`  - ${url}`);
  }
  if (!has404) {
    failed = true;
    console.error(`✖ tenant-urls (${tenant}): dist/404.html ausente — URLs desconhecidas serviriam a homepage com 200 (soft-404)`);
  }
  if (failed) process.exit(1);
  console.log(`✔ tenant-urls (${tenant}): ${present.length}/${present.length} URLs presentes + 404.html (${present.join(", ")})`);
}
