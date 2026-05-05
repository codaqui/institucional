/**
 * Helpers de tratamento de respostas das fetches autenticadas no painel admin.
 *
 * O `authFetch` do `useAuth` já limpa o usuário em 401 (causando redirect
 * automático para `/`). Estes helpers complementam isso com mensagens claras
 * caso o redirect ainda esteja em curso ou o componente já tenha renderizado.
 */

const SESSION_EXPIRED_MESSAGE =
  "Sessão expirada — faça login novamente.";

/**
 * Verifica uma resposta de fetch e retorna o JSON parseado, ou seta uma
 * mensagem de erro contextualizada (incluindo 401).
 *
 * Retorna `null` quando há erro — o caller deve checar e abortar.
 *
 * Uso:
 * ```ts
 * const data = await parseAuthJson<Member[]>(res, setError);
 * if (!data) return;
 * setMembers(data);
 * ```
 */
export async function parseAuthJson<T>(
  res: Response,
  onError: (msg: string) => void,
): Promise<T | null> {
  if (res.status === 401) {
    onError(SESSION_EXPIRED_MESSAGE);
    return null;
  }
  if (!res.ok) {
    onError(`Erro ao carregar dados (HTTP ${res.status}).`);
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    onError("Resposta inválida do servidor.");
    return null;
  }
}

/**
 * Para responses de mutações (POST/PATCH/DELETE): extrai a mensagem de erro
 * do corpo, com fallback amigável para 401.
 */
export async function extractErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  if (res.status === 401) return SESSION_EXPIRED_MESSAGE;
  try {
    const err = (await res.json()) as { message?: string };
    return err.message ?? fallback;
  } catch {
    return fallback;
  }
}
