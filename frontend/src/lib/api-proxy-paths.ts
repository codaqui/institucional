/** Lista 1:1 com workers/shared/index.js (Fonte: API_PREFIXES/API_EXACT_PATHS). */
const API_EXACT_PATHS = new Set(["/health", "/docs", "/auth/me", "/auth/logout", "/auth/finalize"]);
const API_PREFIXES = ["/api/", "/auth/github", "/auth/me", "/auth/logout", "/auth/finalize", "/stripe/", "/ledger/", "/members/", "/events/", "/reimbursements/", "/companies/", "/club/", "/vendors/", "/account-transfers/", "/admin/", "/notifications/"];

export function isApiProxyPath(pathname: string): boolean {
  if (API_EXACT_PATHS.has(pathname)) return true;
  const p = pathname.endsWith("/") && pathname !== "/" ? pathname : pathname + "/";
  return API_PREFIXES.some((prefix) => p.startsWith(prefix));
}
