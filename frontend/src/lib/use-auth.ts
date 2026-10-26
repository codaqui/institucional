import { useCallback, useEffect, useState } from "react";
import { API_URL } from "./config";
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

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const profile = await fetchMe(API_URL);
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  const login = useCallback(
    (options?: { returnTo?: string; switchAccount?: boolean }) =>
      startLogin(API_URL, options),
    [],
  );

  const logout = useCallback((options?: { returnTo?: string }) => {
    setUser(null);
    startLogout(API_URL, options);
  }, []);

  const authFetch = useCallback(
    (path: string, init: RequestInit = {}) =>
      authFetchClient(API_URL, path, init, () => setUser(null)),
    [],
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
