import { cpSync, mkdirSync } from "node:fs";

// Copia os snapshots gerados pelos workflows do monorepo para public/ do Astro.
// POC 0.1: apenas o índice de eventos. 0.3+ generaliza (per-event JSONs, social-stats).
mkdirSync(new URL("../public/events", import.meta.url), { recursive: true });
cpSync(
  new URL("../../static/events/index.json", import.meta.url),
  new URL("../public/events/index.json", import.meta.url),
);
console.log("snapshots copiados: events/index.json");
