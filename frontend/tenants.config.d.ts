export interface TenantDef { tenant: string; community: string; site: string; project: string; }
export const TENANTS: TenantDef[];
export const TENANT_BY_NAME: Record<string, TenantDef>;
