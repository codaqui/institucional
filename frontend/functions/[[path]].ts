/// <reference types="@cloudflare/workers-types" />
import { isApiProxyPath } from "../src/lib/api-proxy-paths";

const DEFAULT_API_ORIGIN = "https://api.codaqui.dev";

/**
 * Pages Function de proxy — substitui o Worker `workers/shared/index.js` (Fase 0.5).
 *
 * Semântica 1:1 com a rota de API do Worker: mesmos `API_EXACT_PATHS`/`API_PREFIXES`
 * (helper compartilhado em `src/lib/api-proxy-paths.ts`), forward do request original
 * (method, headers e cookies intactos) para `API_ORIGIN`. `/auth/callback` continua
 * NÃO sendo API — é a página do frontend que finaliza o fluxo OAuth (mesma exclusão
 * proposital do Worker; não confundir com `/auth/github/callback`, rota do backend).
 *
 * Diferenças em relação ao Worker, todas porque o proxy agora serve o estático do
 * PRÓPRIO Cloudflare Pages (sem terceiro no caminho):
 * - Sem redirect de `/` para `COMMUNITY_PREFIX`: cada tenant é um build/deploy próprio
 *   no Pages — a raiz do domínio já é a home do tenant.
 * - Sem reescrita de og:url/canonical (`rewriteSocialUrls`): o build do tenant já emite
 *   as metatags com o domínio correto.
 * - Sem stripping de `cookie`/`authorization` no caminho estático: o Worker cortava
 *   esses headers porque encaminhava o HTML para o GitHub Pages (terceiro) — o cookie
 *   de sessão httpOnly do domínio da comunidade não podia vazar para Fastly/GitHub.
 *   Aqui o asset é servido pela própria edge do Pages via `context.next()`, sem
 *   upstream externo: não existe para onde o cookie possa vazar.
 */
export const onRequest: PagesFunction<{ API_ORIGIN?: string }> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  if (!isApiProxyPath(url.pathname)) return next();
  const upstream = new URL(url.pathname + url.search, env.API_ORIGIN ?? DEFAULT_API_ORIGIN);
  return fetch(upstream, request);
};
