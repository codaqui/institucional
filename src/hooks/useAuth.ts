import { useState, useEffect, useCallback } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export interface AuthUser {
  sub: string;       // UUID da tabela members (chave primária) — use para chamadas de API
  githubId: string;  // GitHub numeric ID
  handle: string;    // githubHandle
  name: string;
  avatarUrl: string;
  role: "membro" | "finance-analyzer" | "admin";
}

/**
 * Hook de autenticação baseado em cookie httpOnly.
 *
 * O JWT é armazenado num cookie `httpOnly` gerenciado pelo backend — o código
 * JavaScript nunca acessa o token diretamente. O estado do usuário é hidratado
 * via `GET /auth/me` com `credentials: 'include'` ao carregar a página.
 *
 * Uso:
 *   const { user, ready, isLoggedIn, login, logout, authFetch } = useAuth();
 *
 * Para chamadas autenticadas: use `authFetch` no lugar de `fetch`.
 * Ele inclui automaticamente `credentials: 'include'` e os headers corretos.
 */
export function useAuth() {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  /** Busca o perfil autenticado do backend via cookie. */
  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const profile: AuthUser = await res.json();
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    }
  }, [apiUrl]);

  // Hidrata o estado no mount (SSR-safe)
  useEffect(() => {
    if (globalThis.window === undefined) return;
    refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  /** Inicia o fluxo OAuth do GitHub. Salva a URL atual para redirecionamento pós-login. */
  const login = useCallback(() => {
    if (globalThis.sessionStorage) {
      globalThis.sessionStorage.setItem("codaqui_auth_return", globalThis.location.pathname);
    }
    globalThis.location.href = `${apiUrl}/auth/github`;
  }, [apiUrl]);

  /** Encerra a sessão limpando o cookie via backend e resetando o estado local. */
  const logout = useCallback(() => {
    setUser(null);
    globalThis.location.href = `${apiUrl}/auth/logout`;
  }, [apiUrl]);

  /**
   * Wrapper autenticado para `fetch`.
   * Inclui `credentials: 'include'` automaticamente — necessário para enviar o cookie JWT.
   *
   * Se receber **401 Unauthorized**, limpa o estado local (o cookie já está
   * inválido/expirado) — o guard de auth da página vai redirecionar o usuário
   * para `/` automaticamente, exibindo a tela de login.
   *
   * Uso: `authFetch('/endpoint', { method: 'POST', body: JSON.stringify(data) })`
   */
  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
      const res = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      if (res.status === 401) {
        setUser(null);
      }
      return res;
    },
    [apiUrl]
  );

  return {
    user,
    ready,
    isLoggedIn: !!user,
    isAdmin: user?.role === "admin",
    isFinanceAnalyzer: user?.role === "finance-analyzer",
    login,
    logout,
    refreshUser,
    authFetch,
  };
}
