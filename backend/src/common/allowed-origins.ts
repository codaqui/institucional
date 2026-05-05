/**
 * Whitelist de origens (esquema://host[:porta]) permitidas para receber redirects
 * pós-OAuth e pós-Stripe. Compartilhada entre `auth` e `stripe`.
 *
 * Fonte de verdade: `allowed-origins.config.ts` (arrays TypeScript commitados
 * no repo). Adicionar nova comunidade com domínio próprio = PR adicionando uma
 * entrada nesse arquivo. Sem env vars, sem I/O em runtime, type-safe.
 */

import {
  ALLOWED_ORIGINS_DEV,
  ALLOWED_ORIGINS_PROD,
} from './allowed-origins.config';

function getAllowedOrigins(): string[] {
  const set = new Set<string>(ALLOWED_ORIGINS_PROD);
  if (process.env.NODE_ENV !== 'production') {
    for (const o of ALLOWED_ORIGINS_DEV) set.add(o);
  }
  return Array.from(set);
}

/**
 * Origem default para fallback. Em produção é o primeiro item da whitelist de
 * produção (codaqui.dev, site institucional canônico). Em dev local é
 * `http://localhost:3000` para evitar redirects acidentais para produção
 * durante desenvolvimento — útil enquanto o OAuth callback URL ainda é fixo
 * no GitHub OAuth App e o cookie returnTo não atravessa domínios (ver
 * MULTISITE_PLAN §6.10).
 */
function getDefaultOrigin(): string {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  return ALLOWED_ORIGINS_PROD[0] ?? 'http://localhost:3000';
}

export function isAllowedOrigin(candidate: string): boolean {
  if (!candidate) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  const candidateOrigin = url.origin;
  return getAllowedOrigins().some((entry) => {
    try {
      return new URL(entry).origin === candidateOrigin;
    } catch {
      return false;
    }
  });
}

/**
 * Resolve um candidato a URL de retorno: se for válido e estiver na whitelist,
 * retorna; senão devolve o fallback (primeiro origin permitido + fallbackPath).
 */
export function resolveReturnUrl(
  candidate: string | undefined,
  fallbackPath = '/',
): string {
  const fallbackBase = getDefaultOrigin();
  if (!candidate) {
    return new URL(fallbackPath, fallbackBase).toString();
  }
  try {
    const url = new URL(candidate);
    if (isAllowedOrigin(url.origin)) {
      return url.toString();
    }
  } catch {
    /* ignored — falls through to fallback */
  }
  return new URL(fallbackPath, fallbackBase).toString();
}

/**
 * Resolve a origem (scheme://host[:porta]) usada como base para construir URLs
 * de retorno do Stripe. Ordem: argumento explícito → header Origin → header
 * Referer → primeiro origin da whitelist.
 */
export function resolveOrigin(
  explicit: string | undefined,
  originHeader: string | undefined,
  refererHeader: string | undefined,
): string {
  const candidates: Array<string | undefined> = [explicit, originHeader];
  if (refererHeader) {
    try {
      candidates.push(new URL(refererHeader).origin);
    } catch {
      /* ignored */
    }
  }
  for (const c of candidates) {
    if (c && isAllowedOrigin(c)) return c;
  }
  return getDefaultOrigin();
}

