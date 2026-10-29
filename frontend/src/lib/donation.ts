/**
 * Helpers puros do fluxo de doação (port de
 * `src/components/DonationFlow/helpers.ts` + constantes de `useDonationFlow.ts`).
 *
 * Diferença do original: `requestCheckoutSession` recebe o `authFetch` portado
 * (`frontend/src/lib/auth-client.ts`), que já resolve a URL base da API e
 * aceita **path** relativo — por isso o parâmetro `apiUrl` foi removido.
 */

export type RecurringInterval = "month" | "year";
export type DonationMode = "once" | RecurringInterval;

export const PRESET_AMOUNTS = [
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 25", cents: 2500 },
  { label: "R$ 50", cents: 5000 },
  { label: "R$ 100", cents: 10000 },
  { label: "R$ 200", cents: 20000 },
];

export const DONATION_MODES: {
  value: DonationMode;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  { value: "once", label: "Única", description: "Pagamento único, sem compromisso." },
  {
    value: "month",
    label: "Mensal",
    description: "Cobrança automática todo mês. Cancele quando quiser.",
    recommended: true,
  },
  { value: "year", label: "Anual", description: "Cobrança anual com menor fricção." },
];

export const ANONYMOUS_LIMIT_CENTS = 10_000;

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** True quando rodando no browser (não SSR). */
export const hasWindow = (): boolean => globalThis.window !== undefined;

/** Pathname atual no browser (ou undefined em SSR). */
export function getCurrentPath(): string | undefined {
  return hasWindow() ? globalThis.location.pathname : undefined;
}

/**
 * Pede ao script de abas da página `/participe/apoiar` a troca PF ⇄ PJ.
 * Ponte ilha→página: props-função não são serializáveis pelo Astro, então as
 * ilhas comunicam a troca de modo via CustomEvent no `window`.
 */
export function requestApoiarMode(mode: "pf" | "pj"): void {
  if (!hasWindow()) return;
  globalThis.dispatchEvent(new CustomEvent("codaqui:apoiar-mode", { detail: mode }));
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
 * Inclui `returnPath` (default: pathname atual no browser) para que o retorno
 * do Stripe volte para a página de origem (`?status=success|cancelled`).
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
  authFetch: (path: string, init: RequestInit) => Promise<Response>,
  body: Record<string, unknown>,
): Promise<CheckoutResult> {
  try {
    const res = await authFetch("/stripe/checkout-session", {
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
