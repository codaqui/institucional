export interface AuthUser {
  sub: string;
  githubId: string;
  handle: string;
  name: string;
  avatarUrl: string;
  roles: string[];
}

const RETURN_KEY = "codaqui_auth_return";
const COMMUNITY_KEY = "codaqui_auth_community";
const LOGOUT_RETURN_KEY = "codaqui_auth_logout_return";

/** GET /auth/me com cookie httpOnly. Null quando não autenticado. */
export async function fetchMe(apiUrl: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Inicia o OAuth do GitHub. O backend sempre redireciona para
 * `/auth/callback` no domínio atual (a página final fica no sessionStorage,
 * evitando colisão de query params — ver useAuth.ts legado).
 */
export function startLogin(
  apiUrl: string,
  options?: { returnTo?: string; switchAccount?: boolean },
): void {
  const returnPath = options?.returnTo ?? globalThis.location.pathname;
  sessionStorage.setItem(RETURN_KEY, returnPath);
  sessionStorage.removeItem(COMMUNITY_KEY);
  const absoluteReturn = new URL(
    "/auth/callback",
    globalThis.location.origin,
  ).toString();
  const url = new URL(`${apiUrl}/auth/github`);
  url.searchParams.set("returnTo", absoluteReturn);
  if (options?.switchAccount) url.searchParams.set("login", "");
  globalThis.location.href = url.toString();
}

/** Encerra a sessão no backend e redireciona. */
export function startLogout(
  apiUrl: string,
  options?: { returnTo?: string },
): void {
  if (options?.returnTo) {
    sessionStorage.setItem(LOGOUT_RETURN_KEY, options.returnTo);
  }
  const absoluteReturn = options?.returnTo
    ? new URL(options.returnTo, globalThis.location.origin).toString()
    : null;
  const returnParam = absoluteReturn
    ? `?returnTo=${encodeURIComponent(absoluteReturn)}`
    : "";
  globalThis.location.href = `${apiUrl}/auth/logout${returnParam}`;
}

/**
 * fetch autenticado: credentials include + JSON. Em 401 dispara
 * onUnauthorized (o consumidor limpa o estado local → guard redireciona).
 */
export async function authFetch(
  apiUrl: string,
  path: string,
  init: RequestInit = {},
  onUnauthorized?: () => void,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) onUnauthorized?.();
  return res;
}
