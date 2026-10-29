import { vi } from "vitest";
import type { AuthUser } from "../lib/auth-client";

// Mocks e helpers compartilhados entre os testes admin baseados em roles
// (fornecedores/reembolsos). O vi.mock abaixo é registrado quando este
// módulo é avaliado — importe-o ANTES do componente sob teste.
const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  authFetch: vi.fn(),
}));
export const authState = state;

vi.mock("../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    authFetch: authState.authFetch,
  }),
}));

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function makeUser(roles: string[]): AuthUser {
  return {
    sub: "sub-1",
    githubId: "github-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles,
  };
}

export function mockLoggedIn(roles: string[]) {
  authState.user = makeUser(roles);
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = roles.includes("admin");
  authState.isFinanceAnalyzer = roles.includes("finance-analyzer");
}

export function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

/** beforeEach padrão: sessão anônima (cada teste loga com os roles que precisa). */
export function resetAuthState() {
  authState.user = null;
  authState.ready = false;
  authState.isLoggedIn = false;
  authState.isAdmin = false;
  authState.isFinanceAnalyzer = false;
}
