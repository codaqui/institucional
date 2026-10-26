import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import { remarkContentAssets } from "./src/lib/remark-content-assets";

// Páginas que não entram no sitemap: noindex (404, fallback de evento,
// stubs de redirect legado) e rotas de app das fases 0.4+ (admin, auth).
const SITEMAP_EXCLUDE =
  /^\/(404|eventos\/detalhe|quero\/|team$|contact$|conduta$|ong$|timeline$|sobre\/timeline$|pais_responsaveis$|blog\/archive\/|admin\/|auth\/|membro\/)/;

export default defineConfig({
  site: process.env.SITE_URL ?? "https://codaqui.dev",
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
  },
});
