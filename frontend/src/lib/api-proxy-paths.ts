/** Allow-list de proxy — fonte única atual (Fase 0.5; substitui o Worker legado, removido com a pasta `workers/`). */
const API_EXACT_PATHS = new Set(["/health", "/docs", "/auth/me", "/auth/logout", "/auth/finalize"]);
// ⚠️ O prefixo admin é deliberadamente ESTREITO: o backend só expõe rotas sob
// /admin/members (GET /admin/members + PATCH /admin/members/:id, via
// method-level path no members.controller). O prefixo antigo "/admin/"
// fazia a Function interceptar as 13 páginas do painel /admin/* (a Function
// roda antes dos assets e do _redirects no Pages — achado I-1 da revisão da
// Fase 0.6): sem asset estático, o proxy respondia 404 do backend e o painel
// inteiro sumia no edge. Forma com trailing slash de propósito: o helper
// normaliza bare paths adicionando "/", então "/admin/members" casa; e
// "/admin/memberships" (falso positivo de startsWith) NÃO casa.
const API_PREFIXES = ["/api/", "/auth/github", "/auth/me", "/auth/logout", "/auth/finalize", "/stripe/", "/ledger/", "/members/", "/events/", "/reimbursements/", "/companies/", "/club/", "/vendors/", "/account-transfers/", "/admin/members/", "/notifications/"];

export function isApiProxyPath(pathname: string): boolean {
  if (API_EXACT_PATHS.has(pathname)) return true;
  const p = pathname.endsWith("/") && pathname !== "/" ? pathname : pathname + "/";
  return API_PREFIXES.some((prefix) => p.startsWith(prefix));
}
