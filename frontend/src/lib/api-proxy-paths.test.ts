import { describe, it, expect } from "vitest";
import { isApiProxyPath } from "./api-proxy-paths";

describe("isApiProxyPath — paridade 1:1 com workers/shared/index.js", () => {
  it("paths exatos do backend", () => {
    expect(isApiProxyPath("/health")).toBe(true);
    expect(isApiProxyPath("/docs")).toBe(true);
    expect(isApiProxyPath("/auth/me")).toBe(true);
    expect(isApiProxyPath("/auth/logout")).toBe(true);
    expect(isApiProxyPath("/auth/finalize")).toBe(true);
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
    expect(isApiProxyPath("/admin")).toBe(true);
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
