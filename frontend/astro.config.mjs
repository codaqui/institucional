import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import { remarkContentAssets } from "./src/lib/remark-content-assets";
import { TENANT_BY_NAME } from "./tenants.config.mjs";

const TENANT = process.env.TENANT ?? null;
const tenantDef = TENANT ? TENANT_BY_NAME[TENANT] : null;
if (TENANT && !tenantDef) throw new Error(`TENANT desconhecido: ${TENANT}`);
// SITE_URL explícito vence (previews locais/CI); senão o do tenant; senão codaqui.
const SITE_URL = process.env.SITE_URL ?? tenantDef?.site ?? "https://codaqui.dev";

// Páginas que não entram no sitemap: noindex (404, fallback de evento,
// stubs de redirect legado) e rotas de app das fases 0.4+ (admin, auth).
const SITEMAP_EXCLUDE =
  /^\/(404|eventos\/detalhe|eventos\/comprovante|quero\/|team$|contact$|conduta$|ong$|timeline$|sobre\/timeline$|pais_responsaveis$|blog\/archive\/|admin\/|auth\/|membro\/|membros\/empresa)/;

export default defineConfig({
  srcDir: tenantDef ? `./src-tenants/${tenantDef.tenant}` : "./src",
  site: SITE_URL,
  trailingSlash: "never",
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.test(new URL(page).pathname),
    }),
  ],
  markdown: { processor: unified({ remarkPlugins: [remarkContentAssets] }) },
  vite: {
    plugins: [tailwindcss()],
    define: { "import.meta.env.PUBLIC_TENANT": JSON.stringify(TENANT ?? "") },
  },
});
