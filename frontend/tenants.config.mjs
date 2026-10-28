// Fonte única dos tenants da Fase 0.5 — consumida por astro.config.mjs (Node),
// por src/lib/tenant.ts (Vite) e pelos scripts de gate. O matrix do workflow
// .github/workflows/deploy-astro.yml espelha esta lista (manter sincronizado).
export const TENANTS = [
  { tenant: "tisocial", community: "tisocial", site: "https://tisocial.org.br", project: "tisocial" },
  { tenant: "elasnocodigo", community: "elasnocodigo", site: "https://elasnocodigo.com.br", project: "elasnocodigo" },
  { tenant: "devparana", community: "devparana", site: "https://devparana.org", project: "devparana" },
];
export const TENANT_BY_NAME = Object.fromEntries(TENANTS.map((t) => [t.tenant, t]));
