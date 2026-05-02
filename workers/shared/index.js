/**
 * Reusable Cloudflare Worker — community whitelabel reverse proxy.
 *
 * One source of truth that serves any community parceira. Each community gets
 * its own `wrangler.toml` (in `workers/<slug>/`) which sets the env vars and
 * the route binding (e.g. `tisocial.org.br/*`).
 *
 * Architecture (see MULTISITE_PLAN.md §6):
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
const API_PREFIXES = [
  '/api/',
  '/auth/github',
  '/auth/me',
  '/auth/logout',
  '/auth/finalize',
  '/stripe/',
  '/ledger/',
  '/members/',
];
const API_EXACT_PATHS = ['/health', '/auth/me', '/auth/logout', '/auth/finalize'];

function isApiRequest(pathname) {
  if (API_EXACT_PATHS.includes(pathname)) return true;
  return API_PREFIXES.some((p) => pathname.startsWith(p));
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
    if (url.pathname === '/') {
      const target = `${COMMUNITY_PREFIX}/${url.search}`;
      return Response.redirect(`${url.protocol}//${url.host}${target}`, 301);
    }

    // Route 3: everything else is pass-through to STATIC_ORIGIN. The pathname
    // is preserved so React Router resolves to the community page.
    const upstream = new URL(url.pathname + url.search, STATIC_ORIGIN);
    return fetch(upstream, req);
  },
};
