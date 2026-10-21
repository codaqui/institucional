import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import { remarkContentAssets } from "./src/lib/remark-content-assets";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://codaqui.dev",
  integrations: [react(), mdx()],
  markdown: { processor: unified({ remarkPlugins: [remarkContentAssets] }) },
  vite: {
    plugins: [tailwindcss()],
  },
});
