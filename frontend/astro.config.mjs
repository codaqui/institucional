import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://codaqui.dev",
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
