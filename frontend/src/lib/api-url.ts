import { API_URL } from "./config";

/**
 * Helpers de runtime para resolver URLs base (API e site canônico da Codaqui)
 * adaptadas ao ambiente atual — produção, dev local ou deploy whitelabel
 * (Cloudflare Worker em domínio próprio de comunidade).
 *
 * A URL da API configurada em build time vem de `./config` (`API_URL`,
 * `PUBLIC_API_URL` com fallback `http://localhost:3001`) — este módulo NÃO
 * duplica a leitura de env, apenas delega.
 */

/** URL canônica da Codaqui em dev local (Docusaurus dev server). */
const CODAQUI_DEV_URL = "http://localhost:3000";

/**
 * Hosts/origens onde a Codaqui é "primeira parte" e o `API_URL` configurado em
 * build time (ex: `https://api.codaqui.dev` ou `http://localhost:3001`) deve ser
 * usado diretamente. Qualquer outro host é tratado como deploy whitelabel.
 */
export function isCodaquiOrigin(origin: string, siteUrl: string): boolean {
  if (origin === siteUrl) return true;
  if (origin === CODAQUI_DEV_URL) return true;
  if (origin === "https://localhost:3000") return true;
  if (origin === "http://localhost:3030") return true; // Docusaurus alt port
  if (origin === "http://localhost:4321") return true; // Astro dev server
  return false;
}

/** True se `host` (window.location.host) é dev local — `localhost` puro ou `*.localhost[:porta]`. */
export function isLocalDevHost(host: string): boolean {
  return /(^|\.)localhost(:|$)/.test(host);
}

/** Versão pura de `resolveApiUrl` — recebe origin e a URL configurada diretamente. */
export function resolveApiUrlFor(
  origin: string | undefined,
  configuredApiUrl: string,
  siteUrl: string,
): string {
  if (origin === undefined) return configuredApiUrl;
  if (isCodaquiOrigin(origin, siteUrl)) return configuredApiUrl;
  return origin;
}

/** Versão pura de `resolveCodaquiUrl` — recebe host diretamente. */
export function resolveCodaquiUrlFor(
  host: string | undefined,
  siteUrl: string,
  baseUrl: string,
): string {
  if (host === undefined) return `${siteUrl}${baseUrl}`;
  if (isLocalDevHost(host)) return `${CODAQUI_DEV_URL}${baseUrl}`;
  return `${siteUrl}${baseUrl}`;
}

/**
 * Resolve a URL base da API em runtime, usando o `API_URL` do `./config` como
 * valor configurado em build time.
 *
 * - Em deploys "normais" (codaqui.dev, dev local): retorna o `API_URL`.
 *
 * - Em deploys whitelabel (Cloudflare Worker em `tisocial.org.br`,
 *   `*.localhost:8787`, etc.): retorna `window.location.origin`. O Worker
 *   proxia `/api`, `/auth`, `/stripe`, `/ledger`, `/members` para o backend
 *   real, então o navegador deve fazer requests **same-origin** — assim os
 *   cookies (httpOnly, sameSite=lax) viajam normalmente.
 *
 * Em SSR retorna o configured (sem `window`).
 */
export function resolveApiUrl(siteUrl: string): string {
  const origin =
    globalThis.window === undefined ? undefined : globalThis.window.location.origin;
  return resolveApiUrlFor(origin, API_URL, siteUrl);
}

/**
 * Resolve a URL canônica da Codaqui (raiz do site institucional) **adaptada ao
 * ambiente atual**. Usado pelo CodaquiBackChip no navbar de comunidades para
 * que dev local volte para `http://localhost:3000` e prod volte para
 * `https://codaqui.dev`.
 */
export function resolveCodaquiUrl(siteUrl: string, baseUrl: string): string {
  const host =
    globalThis.window === undefined ? undefined : globalThis.window.location.host;
  return resolveCodaquiUrlFor(host, siteUrl, baseUrl);
}
