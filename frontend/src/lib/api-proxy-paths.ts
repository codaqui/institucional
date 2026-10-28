/** Allow-list de proxy — fonte única atual (Fase 0.5; substitui o Worker legado, removido com a pasta `workers/`). */
const API_EXACT_PATHS = new Set(["/health", "/docs", "/auth/me", "/auth/logout", "/auth/finalize"]);
const API_PREFIXES = ["/api/", "/auth/github", "/auth/me", "/auth/logout", "/auth/finalize", "/stripe/", "/ledger/", "/members/", "/events/", "/reimbursements/", "/companies/", "/club/", "/vendors/", "/account-transfers/", "/admin/", "/notifications/"];

/**
 * Paths de página que colidem com um prefixo de API e NÃO devem ser
 * proxados (Fase 0.6): respondem pelo estático/`_redirects` do Pages.
 * Hoje só `/admin/transferencias` — redirect legado 302 para
 * `/admin/lancamento?tab=transferencias` (source do dist/_redirects do build
 * codaqui, gerado por build-tenant-redirects.mjs; sem essa exclusão a
 * Function proxava para o backend, que 404a na rota inexistente).
 */
export const PAGE_ONLY_PATHS = new Set(["/admin/transferencias"]);

export function isApiProxyPath(pathname: string): boolean {
  if (API_EXACT_PATHS.has(pathname)) return true;
  const p = pathname.endsWith("/") && pathname !== "/" ? pathname : pathname + "/";
  // Redirects legados de página vencem o proxy (a Function roda antes do
  // `_redirects`; sem a exclusão o redirect nunca dispararia — ex.:
  // /admin/transferencias casaria com o prefixo "/admin/" acima).
  const bare = p.endsWith("/") ? p.slice(0, -1) : p;
  if (PAGE_ONLY_PATHS.has(bare)) return false;
  return API_PREFIXES.some((prefix) => p.startsWith(prefix));
}
