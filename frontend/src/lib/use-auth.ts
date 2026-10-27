import { useCallback, useEffect, useState } from "react";
import { resolveApiUrl } from "./api-url";
import {
  authFetch as authFetchClient,
  fetchMe,
  startLogin,
  startLogout,
  type AuthUser,
} from "./auth-client";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Mesmo padrão das ilhas: resolveApiUrl(import.meta.env.SITE) — em builds
  // tenant o guard PUBLIC_TENANT força same-origin via Pages Function; API_URL
  // cru cairia no fallback de build fora do workflow (ex.: localhost:3001).
  const apiUrl = resolveApiUrl(import.meta.env.SITE);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const profile = await fetchMe(apiUrl);
    setUser(profile);
    return profile;
  }, [apiUrl]);

  useEffect(() => {
    refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  const login = useCallback(
    (options?: { returnTo?: string; switchAccount?: boolean }) =>
      startLogin(apiUrl, options),
    [apiUrl],
  );

  const logout = useCallback(
    (options?: { returnTo?: string }) => {
      setUser(null);
      startLogout(apiUrl, options);
    },
    [apiUrl],
  );

  const authFetch = useCallback(
    (path: string, init: RequestInit = {}) =>
      authFetchClient(apiUrl, path, init, () => setUser(null)),
    [apiUrl],
  );

  return {
    user,
    ready,
    isLoggedIn: user !== null,
    isAdmin: user?.roles.includes("admin") ?? false,
    isFinanceAnalyzer: user?.roles.includes("finance-analyzer") ?? false,
    isEventOrganizer: user?.roles.includes("event_organizer") ?? false,
    isEventFinance: user?.roles.includes("event_finance") ?? false,
    isEventHost: user?.roles.includes("event_host") ?? false,
    isEventChecker: user?.roles.includes("event_checker") ?? false,
    login,
    logout,
    refreshUser,
    authFetch,
  };
}

export type { AuthUser };
