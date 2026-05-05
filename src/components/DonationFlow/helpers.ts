/**
 * Helpers puros do DonationFlow.
 *
 * Extraídos para arquivo separado para facilitar testes unitários e manter o
 * componente principal focado em rendering/state.
 */

export type DonationMode = "once" | "month" | "year";

/** True quando rodando no browser (não SSR). */
export const hasWindow = (): boolean => globalThis.window !== undefined;

/**
 * Detecta deploy whitelabel (Cloudflare Worker em domínio próprio da
 * comunidade). Quando true, o dashboard do membro vive na Codaqui canônica e
 * exibimos aviso de gestão de assinaturas.
 *
 * Heurística: `apiUrl === window.location.origin` indica que `resolveApiUrl`
 * detectou Worker (mesma origem); excluímos hosts que começam com "localhost"
 * ou terminam em ":3000"/":3030" (Docusaurus dev).
 */
export function detectWhitelabelDeploy(apiUrl: string): boolean {
  if (!hasWindow()) return false;
  const { host, origin } = globalThis.location;
  if (apiUrl !== origin) return false;
  if (host.startsWith("localhost")) return false;
  if (host.endsWith(":3000") || host.endsWith(":3030")) return false;
  return true;
}

/** Pathname atual no browser (ou undefined em SSR). */
export function getCurrentPath(): string | undefined {
  return hasWindow() ? globalThis.location.pathname : undefined;
}

export interface CheckoutBodyParams {
  amount: number;
  target: string;
  isRecurring: boolean;
  mode: DonationMode;
  returnPath?: string;
}

/**
 * Monta o body do POST /stripe/checkout-session.
 *
 * Inclui `returnPath` (default: pathname atual no browser) para que deploys
 * whitelabel mantenham o usuário no contexto da comunidade após retornar do
 * Stripe.
 */
export function buildCheckoutBody({
  amount,
  target,
  isRecurring,
  mode,
  returnPath,
}: CheckoutBodyParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    amount,
    communityId: target,
    uiMode: "embedded_page",
    returnPath: returnPath ?? getCurrentPath(),
  };
  if (isRecurring) body.recurring = { interval: mode };
  return body;
}

export interface CheckoutResult {
  kind: "client-secret" | "redirect" | "auth-required" | "error";
  clientSecret?: string;
  url?: string;
  error?: string;
}

/**
 * Faz a requisição de criação da sessão Stripe e devolve um resultado
 * normalizado para o componente desencapsular sem try/catch + ifs aninhados.
 */
export async function requestCheckoutSession(
  authFetch: (url: string, init: RequestInit) => Promise<Response>,
  apiUrl: string,
  body: Record<string, unknown>,
): Promise<CheckoutResult> {
  try {
    const res = await authFetch(`${apiUrl}/stripe/checkout-session`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { kind: "auth-required" };
    if (!res.ok) return { kind: "error", error: "Falha ao criar sessão de pagamento." };
    const data = await res.json();
    if (data.clientSecret) return { kind: "client-secret", clientSecret: data.clientSecret };
    if (data.url) return { kind: "redirect", url: data.url };
    return { kind: "error", error: "Resposta inesperada do servidor." };
  } catch (err: unknown) {
    return {
      kind: "error",
      error: err instanceof Error ? err.message : "Erro inesperado.",
    };
  }
}
