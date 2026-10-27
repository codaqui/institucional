import { TENANT_BY_NAME } from "../../tenants.config.mjs";

export type TenantName = keyof typeof TENANT_BY_NAME & string;

/** Tenant do build atual (build-time, via vite define em astro.config.mjs). */
export function getTenant(): TenantName | null {
  const t = import.meta.env.PUBLIC_TENANT as string | undefined;
  return t ? (t as TenantName) : null;
}

/** URL canônica (site) de um tenant — usada em SEO/OG e links absolutos. */
export function tenantSite(tenant: string): string {
  const def = TENANT_BY_NAME[tenant];
  if (!def) throw new Error(`Tenant desconhecido: ${tenant}`);
  return def.site;
}
