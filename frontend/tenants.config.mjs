// Fonte única dos tenants da Fase 0.5 — consumida por astro.config.mjs (Node),
// por src/lib/tenant.ts (Vite) e pelos scripts de gate. O matrix do workflow
// .github/workflows/deploy-astro.yml espelha esta lista (manter sincronizado).
export const TENANTS = [
  // T.I. Social canonicaliza em www: há uma regra de redirect (Page Rule) no
  // apex tisocial.org.br → www que não é gerenciável via API (endpoint legado).
  // O site do tenant assume www como canônico; o apex vira redirect legítimo.
  { tenant: "tisocial", community: "tisocial", site: "https://www.tisocial.org.br", project: "tisocial" },
  { tenant: "elasnocodigo", community: "elasnocodigo", site: "https://elasnocodigo.com.br", project: "elasnocodigo" },
  { tenant: "devparana", community: "devparana", site: "https://devparana.org", project: "devparana" },
];
export const TENANT_BY_NAME = Object.fromEntries(TENANTS.map((t) => [t.tenant, t]));
