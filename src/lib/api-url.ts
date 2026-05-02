/**
 * Helpers de runtime para resolver URLs base (API e site canônico da Codaqui)
 * adaptadas ao ambiente atual — produção, dev local ou deploy whitelabel
 * (Cloudflare Worker em domínio próprio de comunidade).
 */

/** URL canônica da Codaqui em dev local (Docusaurus dev server). */
const CODAQUI_DEV_URL = "http://localhost:3000";

/**
 * Hosts/origens onde a Codaqui é "primeira parte" e o `apiUrl` configurado em
 * build time (ex: `https://api.codaqui.dev` ou `http://localhost:3001`) deve ser
 * usado diretamente. Qualquer outro host é tratado como deploy whitelabel.
 */
function isCodaquiOrigin(origin: string, siteUrl: string): boolean {
  if (origin === siteUrl) return true;
  if (origin === CODAQUI_DEV_URL) return true;
  if (origin === "http://localhost:3030") return true; // Docusaurus alt port
  return false;
}

/** True se `host` (window.location.host) é dev local — `localhost` puro ou `*.localhost[:porta]`. */
function isLocalDevHost(host: string): boolean {
  return /(^|\.)localhost(:|$)/.test(host);
}

/**
 * Resolve a URL base da API em runtime.
 *
 * - Em deploys "normais" (codaqui.dev, dev local em `localhost:3000`/`:3030`):
 *   retorna o `siteConfig.customFields.apiUrl` configurado em build time.
 *
 * - Em deploys whitelabel (Cloudflare Worker em `tisocial.org.br`,
 *   `*.localhost:8787`, etc.): retorna `window.location.origin`. O Worker
 *   proxia `/api`, `/auth`, `/stripe`, `/ledger`, `/members` para o backend
 *   real, então o navegador deve fazer requests **same-origin** — assim os
 *   cookies (httpOnly, sameSite=lax) viajam normalmente.
 *
 * Em SSR retorna o configured (sem `window`).
 */
export function resolveApiUrl(
  configuredApiUrl: string,
  siteUrl: string,
): string {
  if (globalThis.window === undefined) return configuredApiUrl;
  const here = globalThis.window.location.origin;
  if (isCodaquiOrigin(here, siteUrl)) return configuredApiUrl;
  return here;
}

/**
 * Resolve a URL canônica da Codaqui (raiz do site institucional) **adaptada ao
 * ambiente atual**. Usado pelo CodaquiBackChip no navbar de comunidades para
 * que dev local volte para `http://localhost:3000` e prod volte para
 * `https://codaqui.dev`.
 */
export function resolveCodaquiUrl(siteUrl: string, baseUrl: string): string {
  if (globalThis.window === undefined) return `${siteUrl}${baseUrl}`;
  if (isLocalDevHost(globalThis.window.location.host)) {
    return `${CODAQUI_DEV_URL}${baseUrl}`;
  }
  return `${siteUrl}${baseUrl}`;
}
