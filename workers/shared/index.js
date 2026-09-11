/**
 * Reusable Cloudflare Worker — community whitelabel reverse proxy.
 *
 * One source of truth that serves any community parceira. Each community gets
 * its own `wrangler.toml` (in `workers/<slug>/`) which sets the env vars and
 * the route binding (e.g. `tisocial.org.br/*`).
 *
 * Architecture (see docs/plans/multisite/README.md §6):
 *
 *   tisocial.org.br/                 ──redirect 301──► tisocial.org.br/comunidades/tisocial/
 *   tisocial.org.br/<api-path>       ──proxy──► api.codaqui.dev/<path>
 *   tisocial.org.br/<other>          ──proxy──► codaqui.dev/<other>      (pass-through)
 *
 * Pass-through (vs. path rewriting) is intentional: Docusaurus is a SPA where
 * the React Router renders pages based on `window.location.pathname`. Stripping
 * the `/comunidades/<slug>` prefix client-side would break routing — it would
 * render Codaqui's home instead of the community page. The redirect on `/`
 * gives a clean entrypoint while the rest stays under the prefix.
 *
 * Cookies set by the backend (no Domain attribute) become first-party for the
 * community host because all `/auth/*` and `/stripe/*` calls go through this
 * Worker, which lives at the same origin as the browser.
 *
 * Required env vars (declared in wrangler.toml [vars]):
 *   - STATIC_ORIGIN     e.g. "https://codaqui.dev"
 *   - API_ORIGIN        e.g. "https://api.codaqui.dev"
 *   - COMMUNITY_PREFIX  e.g. "/comunidades/tisocial" (no trailing slash)
 */

// Paths que vão para o backend (API). Importante: `/auth/callback` é uma
// página do frontend (Docusaurus) que finaliza o fluxo OAuth — não confundir
// com `/auth/github/callback` (rota do backend que o GitHub chama).
// Lista validada contra os controllers do backend (backend/src/**/*.controller.ts)
// e contra todas as chamadas `${apiUrl}/...` / `authFetch("/...")` do frontend
// (em dominio whitelabel o frontend usa window.location.origin para TODAS elas).
// `/auth/callback` continua de fora de proposito: e pagina Docusaurus.
const API_PREFIXES = [
  '/api/',
  '/auth/github',
  '/auth/me',
  '/auth/logout',
  '/auth/finalize',
  '/stripe/',
  '/ledger/',
  '/members/',
  '/events/',
  '/reimbursements/',
  '/companies/',
  '/club/',
  '/vendors/',
  '/account-transfers/',
  '/admin/',
  '/notifications/',
];
const API_EXACT_PATHS = new Set(['/health', '/docs', '/auth/me', '/auth/logout', '/auth/finalize']);

function isApiRequest(pathname) {
  if (API_EXACT_PATHS.has(pathname)) return true;
  // Prefixos terminam em '/': normaliza para casar chamadas "bare" como
  // `/vendors` e `/reimbursements` (usadas pelo frontend sem barra final).
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return API_PREFIXES.some((p) => normalized.startsWith(p));
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reescreve somente metadados sociais/canonicos no HTML pass-through.
 *
 * NAO toca em links de navegacao, assets, scripts ou APIs: o path precisa
 * permanecer /comunidades/<slug> para que o React Router do Docusaurus continue
 * resolvendo a pagina correta. A reescrita e cirurgica em og:url e canonical,
 * trocando STATIC_ORIGIN pelo dominio proprio da comunidade.
 */
function rewriteSocialUrls(html, host, staticOrigin) {
  const originPattern = escapeRegExp(staticOrigin);

  let rewritten = html.replace(
    new RegExp(
      `<meta\\s+([^>]*?)property=["']og:url["']\\s+([^>]*?)content=["']${originPattern}`,
      'gi'
    ),
    `<meta $1property="og:url" $2content="https://${host}`
  );

  rewritten = rewritten.replace(
    new RegExp(
      `<link\\s+([^>]*?)rel=["']canonical["']\\s+([^>]*?)href=["']${originPattern}`,
      'gi'
    ),
    `<link $1rel="canonical" $2href="https://${host}`
  );

  return rewritten;
}

export default {
  async fetch(req, env) {
    const { STATIC_ORIGIN, API_ORIGIN, COMMUNITY_PREFIX } = env;
    const url = new URL(req.url);

    // Route 1: API calls go straight to the backend (cookies stay first-party
    // since this Worker shares origin with the browser).
    if (isApiRequest(url.pathname)) {
      const upstream = new URL(url.pathname + url.search, API_ORIGIN);
      return fetch(upstream, req);
    }

    // Route 2: bare root (`/`) redirects to the community prefix so the user
    // lands on the community home with the SPA router seeing the right path.
    // Use the non-trailing-slash form to match Docusaurus trailingSlash: false.
    if (url.pathname === '/') {
      const target = `${COMMUNITY_PREFIX}${url.search}`;
      return Response.redirect(`${url.protocol}//${url.host}${target}`, 301);
    }

    // Route 3: everything else is pass-through to STATIC_ORIGIN. The pathname
    // is preserved so React Router resolves to the community page.
    // GitHub Pages serves Docusaurus clean URLs without a trailing slash
    // (e.g. /comunidades/elasnocodigo works, /comunidades/elasnocodigo/ 404s),
    // so normalize the upstream request to the non-trailing-slash variant.
    const upstreamPath = url.pathname.replace(/\/$/, '') || '/';
    const upstream = new URL(upstreamPath + url.search, STATIC_ORIGIN);

    // Nunca encaminha credenciais ao estatico: o cookie de sessao (JWT httpOnly)
    // do dominio da comunidade nao pode vazar para o GitHub Pages/Fastly.
    const staticHeaders = new Headers(req.headers);
    staticHeaders.delete('cookie');
    staticHeaders.delete('authorization');
    const res = await fetch(upstream, {
      method: req.method,
      headers: staticHeaders,
      redirect: 'follow',
    });

    // Route 3a: para crawlers sociais, reescreve og:url e canonical para o
    // dominio proprio da comunidade, reforcando a identidade do site whitelabel.
    const contentType = res.headers.get('content-type') || '';
    if (res.status === 200 && contentType.includes('text/html')) {
      const html = await res.text();
      const rewritten = rewriteSocialUrls(html, url.host, STATIC_ORIGIN);
      const newHeaders = new Headers(res.headers);
      newHeaders.delete('content-length');
      // O body foi reescrito: um content-encoding gzip stale quebraria a
      // resposta em `wrangler dev` (workers-sdk#14419). Em producao a edge
      // recomprime de qualquer forma.
      newHeaders.delete('content-encoding');
      return new Response(rewritten, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    }

    return res;
  },
};
