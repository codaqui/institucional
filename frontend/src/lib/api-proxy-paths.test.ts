import { describe, it, expect } from "vitest";
import { isApiProxyPath } from "./api-proxy-paths";

describe("isApiProxyPath — allow-list de proxy (fonte única atual; paridade com o Worker legado)", () => {
  it("paths exatos do backend", () => {
    expect(isApiProxyPath("/health")).toBe(true);
    expect(isApiProxyPath("/auth/me")).toBe(true);
    expect(isApiProxyPath("/auth/logout")).toBe(true);
    expect(isApiProxyPath("/auth/finalize")).toBe(true);
  });

  it("/docs NÃO é API (doc Swagger fica em api.codaqui.dev/docs; páginas /docs dos tenants são assets estáticos)", () => {
    expect(isApiProxyPath("/docs")).toBe(false);
    expect(isApiProxyPath("/docs/intro")).toBe(false);
  });

  it("/docs-json é API (spec OpenAPI da página /desenvolvedores/api — exato, sem colisão com /docs estático)", () => {
    expect(isApiProxyPath("/docs-json")).toBe(true);
    // qualquer subpath/irmão continua delegando ao estático:
    expect(isApiProxyPath("/docs-json/extra")).toBe(false);
  });

  it("prefixos de API com subpath", () => {
    expect(isApiProxyPath("/api/health")).toBe(true);
    expect(isApiProxyPath("/auth/github/callback")).toBe(true);
    expect(isApiProxyPath("/stripe/checkout-session")).toBe(true);
    expect(isApiProxyPath("/ledger/community-balances")).toBe(true);
    expect(isApiProxyPath("/events/public/managed")).toBe(true);
    expect(isApiProxyPath("/club/wallets")).toBe(true);
    expect(isApiProxyPath("/account-transfers/")).toBe(true);
  });

  it("chamadas bare (sem trailing slash) casam pela normalização", () => {
    expect(isApiProxyPath("/vendors")).toBe(true);
    expect(isApiProxyPath("/reimbursements")).toBe(true);
    expect(isApiProxyPath("/members")).toBe(true);
    expect(isApiProxyPath("/events")).toBe(true);
    expect(isApiProxyPath("/companies")).toBe(true);
    expect(isApiProxyPath("/club")).toBe(true);
    expect(isApiProxyPath("/notifications")).toBe(true);
    expect(isApiProxyPath("/ledger")).toBe(true);
    expect(isApiProxyPath("/api")).toBe(true);
  });

  it("query string não afeta (a Function passa só url.pathname)", () => {
    const pathname = new URL("http://localhost:8787/auth/github?x=1").pathname;
    expect(isApiProxyPath(pathname)).toBe(true);
    const healthPath = new URL("http://localhost:8787/health?ts=1").pathname;
    expect(isApiProxyPath(healthPath)).toBe(true);
  });

  it("/auth/callback NÃO é API (é página do frontend — mesma exclusão proposital do Worker)", () => {
    expect(isApiProxyPath("/auth/callback")).toBe(false);
  });

  it("páginas do painel /admin/* NÃO são API (I-1 Fase 0.6 — só /admin/members é rota do backend)", () => {
    expect(isApiProxyPath("/admin")).toBe(false);
    expect(isApiProxyPath("/admin/transferencias")).toBe(false);
    expect(isApiProxyPath("/admin/eventos")).toBe(false);
    expect(isApiProxyPath("/admin/lancamento")).toBe(false);
    expect(isApiProxyPath("/admin/emails")).toBe(false);
  });

  it("/admin/members é API (bare, trailing slash e subpath — o backend expõe GET e PATCH :id)", () => {
    expect(isApiProxyPath("/admin/members")).toBe(true);
    expect(isApiProxyPath("/admin/members/")).toBe(true);
    expect(isApiProxyPath("/admin/members/abc-123")).toBe(true);
    // falso positivo de startsWith não casa (prefixo com trailing slash):
    expect(isApiProxyPath("/admin/memberships")).toBe(false);
  });

  it("hours é API sem interceptar as páginas de horas do app", () => {
    expect(isApiProxyPath("/hours")).toBe(true);
    expect(isApiProxyPath("/hours/me")).toBe(true);
    expect(isApiProxyPath("/hours/pending")).toBe(true);
    expect(isApiProxyPath("/hoursxyz")).toBe(false);
    expect(isApiProxyPath("/membro/horas")).toBe(false);
    expect(isApiProxyPath("/admin/horas")).toBe(false);
  });

  it("designations é API sem alargar o prefixo administrativo", () => {
    expect(isApiProxyPath("/designations")).toBe(true);
    expect(isApiProxyPath("/designations/me")).toBe(true);
    expect(isApiProxyPath("/designations/abc/confirm")).toBe(true);
    expect(isApiProxyPath("/designationsxyz")).toBe(false);
    expect(isApiProxyPath("/admin/designations")).toBe(false);
  });

  it("directorates é API sem interceptar a página administrativa", () => {
    expect(isApiProxyPath("/directorates")).toBe(true);
    expect(isApiProxyPath("/directorates/public")).toBe(true);
    expect(isApiProxyPath("/directorates/manage")).toBe(true);
    expect(isApiProxyPath("/directorates/abc-123")).toBe(true);
    expect(isApiProxyPath("/directoratesxyz")).toBe(false);
    expect(isApiProxyPath("/admin/diretorias")).toBe(false);
  });

  it("communities é API sem interceptar páginas administrativas ou públicas do site", () => {
    expect(isApiProxyPath("/communities")).toBe(true);
    expect(isApiProxyPath("/communities/public")).toBe(true);
    expect(isApiProxyPath("/communities/manage")).toBe(true);
    expect(isApiProxyPath("/communities/abc-123/seal/request")).toBe(true);
    expect(isApiProxyPath("/communitiesxyz")).toBe(false);
    expect(isApiProxyPath("/admin/comunidades")).toBe(false);
    expect(isApiProxyPath("/comunidades/devparana")).toBe(false);
  });

  it("communities/index.json é snapshot estático, sem interceptar as demais APIs", () => {
    expect(isApiProxyPath("/communities/index.json")).toBe(false);
    expect(isApiProxyPath("/communities/abc-123")).toBe(true);
    expect(isApiProxyPath("/communities/public")).toBe(true);
  });

  it("settings e audit são APIs sem interceptar a página de configurações", () => {
    expect(isApiProxyPath("/settings")).toBe(true);
    expect(isApiProxyPath("/settings/audit-retention")).toBe(true);
    expect(isApiProxyPath("/audit")).toBe(true);
    expect(isApiProxyPath("/audit/logs")).toBe(true);
    expect(isApiProxyPath("/audit/cleanup")).toBe(true);
    expect(isApiProxyPath("/settingsxyz")).toBe(false);
    expect(isApiProxyPath("/auditing")).toBe(false);
    expect(isApiProxyPath("/admin/configuracoes")).toBe(false);
  });

  it("não-API delega ao estático via context.next()", () => {
    expect(isApiProxyPath("/")).toBe(false);
    expect(isApiProxyPath("/blog")).toBe(false);
    expect(isApiProxyPath("/comunidades/tisocial")).toBe(false);
    expect(isApiProxyPath("/eventos")).toBe(false);
    expect(isApiProxyPath("/membros/perfil")).toBe(false);
  });

  it("falsos positivos: substring não casa com prefixo", () => {
    expect(isApiProxyPath("/vendorsxyz")).toBe(false);
    expect(isApiProxyPath("/eventsxyz")).toBe(false);
    expect(isApiProxyPath("/memberships")).toBe(false);
    expect(isApiProxyPath("/clube")).toBe(false);
    expect(isApiProxyPath("/administracao")).toBe(false);
    // começa com "/api" mas não com "/api/":
    expect(isApiProxyPath("/apiary")).toBe(false);
    // "/auth" bare e subpaths que não são rotas do backend:
    expect(isApiProxyPath("/auth")).toBe(false);
    expect(isApiProxyPath("/auth/callback/extra")).toBe(false);
    // exato só sem barra (paridade com o Worker: backend expõe só "/health"):
    expect(isApiProxyPath("/healthz")).toBe(false);
    expect(isApiProxyPath("/health/")).toBe(false);
  });
});
