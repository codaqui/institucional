<!-- AGENT-INDEX
purpose: Plano de implementação da Fase 0.5 (Multi-tenant por build matrix no Cloudflare Pages) — tenants com rotas limpas em /, Pages Function de proxy, migração dos 3 domínios live e fim da pasta workers/.
audience: AI agents executando com superpowers:subagent-driven-development.
status: pronto para execução (2026-10-27); rulings serão registrados no ledger SDD em .superpowers/sdd/2026-10-27-fase-0-5-multi-tenant-pages/ durante a execução.
related-docs:
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — spec da Fase 0 (§Multi-tenant sem workers/)
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0
  - docs/superpowers/plans/2026-10-26-fase-0-4-app-admin-membro.md — fase anterior (app admin/membro)
  - docs/plans/multisite/README.md — plano D1 (será marcado como substituído na T13)
  - docs/adrs/004-multisite-communities.md — ADR parcialmente superseda (nota na T13)
agent-protocol:
  - Cada task = worktree próprio (.worktrees/fase-0-5-task-N, branch fase-0-5/task-N a partir de develop), merge em develop assim que DONE (ruling do usuário), revisão depois.
  - Máximo 5 subagentes em paralelo (pedido do usuário).
  - O arquivo-fonte Docusaurus é o spec dos ports 1:1 (mesma convenção da 0.4).
-->

# Fase 0.5 — Multi-tenant Cloudflare Pages: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir todos os tenants (codaqui + tisocial + elasnocodigo + devparana) em projetos Cloudflare Pages por build matrix, com rotas limpas em `/` nos domínios próprios, proxy de API via Pages Function, migração dos 3 domínios live e deleção da pasta `workers/`.

**Architecture:** Um único app Astro com `srcDir` alternado por build: o build codaqui usa `frontend/src/` (e passa a emitir `/comunidades/<slug>/*`); o build de cada tenant usa `frontend/src-tenants/<slug>/` (symlinks para os diretórios compartilhados + páginas próprias que nascem em rotas limpas em `/`). O branding vem de build time reaproveitando `comunidades/<slug>/community.config.ts`. A API continua sendo chamada same-origin (padrão já existente em `src/lib/api-proxy.ts` — `resolveApiUrl` retorna `window.location.origin` em hosts whitelabel); uma Pages Function `functions/[[path]].ts` replica o proxy do Worker atual (lista de prefixos de API, forward com cookies) e delega o restante ao assets estático. Deploy por direct upload no GitHub Actions com matrix por tenant (`wrangler pages deploy`), sem consumir quota de build do Pages.

**Tech Stack:** Astro 7 (output static, srcDir switching), React 19 ilhas (existentes), Tailwind v4, MUI v9, Cloudflare Pages + Pages Functions, wrangler ^4.87 (devDep da raiz), GitHub Actions.

**Spec:** `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (§Multi-tenant sem workers/, §Arquitetura de build e deploy, fase 0.5 da tabela).

## Global Constraints

- **Contratos intocados:** backend, snapshots (`static/events`, `static/social-stats`), workflows de sync, Stripe, Giscus, gtag — refactor só da camada de apresentação (spec §Contratos).
- **Backend: zero mudanças.** Os 3 domínios de tenant já estão em `ALLOWED_ORIGINS_PROD` (`backend/src/common/allowed-origins.config.ts`); o fluxo de login (handoff `#token` + `POST /auth/finalize` same-origin via proxy) e a doação (`resolveOrigin` com Origin repassado) já funcionam cross-domain com proxy same-origin. Gap conhecido fora do escopo: `<hash>.tisocial.pages.dev` cai no fallback `codaqui.dev` em `resolveReturnUrl` (match exato de origin) — aceito (previews de tenant não são critério; documentado no runbook).
- **Paridade de URLs:** o build codaqui passa a servir `/comunidades/<slug>/*` e o gate `diff-urls.mjs` perde a exclusão de `/comunidades` (paridade 100% vs `build/` de referência). Builds tenant usam gate próprio (`tenant-urls.mjs`, allow-list).
- **`comunidades/` (Docusaurus) NÃO é modificada** — ainda serve codaqui.dev até a 0.6; o frontend apenas IMPORTA `community.config.ts` e os dados. Exceções de escrita fora de `frontend/`: `Makefile`, `DEVELOPMENT.md`, `AGENTS.md`, `docs/`, deleção de `workers/`, e os novos arquivos `frontend/tenants.config.mjs` / `frontend/tenants.config.d.ts`.
- **Nunca hardcode de hex** em código — cores de tenant são DADOS (`community.config.ts`) e fluem como CSS vars; código novo usa tokens `--cq-*` / Tailwind / MUI.
- **Ilha única `client:only="react"` por página**; shells app com `noindex` (convenção R10 da 0.4); commits em pt-BR conventional; todo `.md` novo exige header `AGENT-INDEX`.
- **Máximo 5 subagentes em paralelo** (pedido do usuário); worktrees por task; merge em develop assim que o implementador reporta DONE (ruling da 0.4), revisão depois.
- **Pagefind/busca e previews `codaqui.dev/previews/`**: fora de escopo (ponto aberto da spec fica para a 0.6).

## Decisões de arquitetura (fechadas neste plano)

- **D1 — srcDir switching para builds tenant.** Astro não permite "não emitir" páginas estáticas; trocar `srcDir` por `TENANT` é o mecanismo idiomático que filtra rotas por build (a spec manda "filtrar rotas"; o mecanismo exato é implementação nossa).
- **D2 — 4 tenants no matrix: `codaqui`, `tisocial`, `elasnocodigo`, `devparana`.** Os 3 workers estão live (verificação 2026-10-27: `curl` dos 3 domínios devolve 301 → `/comunidades/<slug>`). Deletar `workers/` sem migrar os 3 quebraria domínios no ar — escolhido pelo usuário ("caso ideal, subimos tudo no Pages, aceito 1–2h offline").
- **D3 — Pages Function em `functions/[[path]].ts` (não `functions/api/[[path]].ts`).** O app já chama a API same-origin com os paths reais do backend (`/auth/finalize`, `/members/...` — herdado do Docusaurus via `resolveApiUrl`). A Function replica a semântica do Worker atual (lista de prefixos + exatos) e delega o resto ao estático via `context.next()`. A convenção `/api/*` da spec exigiria tocar todas as ilhas — rejeitada.
- **D4 — `_redirects` de compatibilidade por tenant**: `/comunidades/<slug>(/*)` → `/(/*)` 301 (URLs indexadas pelo Worker pass-through), gerado em postbuild só quando `TENANT` está setado.
- **D5 — og:url/canonical por build**: `site` do Astro vem do tenant no matrix (`SITE_URL`), eliminando a reescrita cirúrgica de HTML do Worker — como manda a spec.
- **D6 — Conteúdo de blog/docs das comunidades continua em `comunidades/<slug>/` (fonte única)**; o Astro acessa via symlinks comitados em `frontend/src/content/community-blog/<slug>` → `../../../../comunidades/<slug>/blog` (4 níveis: `community-blog` → `content` → `src` → `frontend` → raiz do repo). Funciona no Linux/mac (CI ubuntu + devs mac); Windows exige `core.symlinks` (nota no DEVELOPMENT.md).

## File Structure

```
frontend/
├── tenants.config.mjs (+ .d.ts)      # fonte única: lista de tenants (site/project/community)
├── astro.config.mjs                   # TENANT → srcDir/site/define PUBLIC_TENANT
├── functions/
│   └── [[path]].ts                    # Pages Function: proxy API + delega estático
├── src-tenants/<slug>/                # srcDir dos builds tenant (4 tenants)
│   ├── pages/                         # rotas limpas: index, apoiar, transparencia, equipe, blog/*, docs/*
│   ├── content.config.ts              # collection communityBlog (glob via symlink)
│   ├── env.d.ts
│   └── components|layouts|lib|data|content|styles|public  → symlinks para ../../src/*
├── src/
│   ├── lib/
│   │   ├── tenant.ts                  # getTenant(), loadTenantConfig(), tenantCssVars(), tenantNav()
│   │   ├── api-proxy-paths.ts         # isApiProxyPath() (compartilhado com a Function)
│   │   └── api-url.ts                 # (existe) resolveApiUrl — sem mudança
│   ├── components/astro/community/    # CommunityLayout + seções (hero/explore/impact/channels)
│   ├── components/astro/community/devparana/   # Rfc* ports
│   ├── pages/comunidades/<slug>/...   # wrappers do build codaqui (todas as comunidades)
│   └── content/community-blog/<slug>  # symlinks para comunidades/<slug>/blog
├── scripts/
│   ├── build-tenant-redirects.mjs     # postbuild: dist/_redirects quando TENANT setado
│   └── tenant-urls.mjs                # gate allow-list por tenant build
└── public/_redirects                  # NÃO — redirects de tenant são gerados (D4)
```

**Workflows/docs:** `.github/workflows/deploy-astro.yml` (novo), `pr-check.yml` (job de build tenant), `DEVELOPMENT.md` (secrets + runbook de DNS), `Makefile` (`astro-verify-tenants`), `docs/plans/multisite/README.md` (banner substituído), `docs/adrs/004-*.md` (nota), e remoção de `workers/` + referências.

---

### Task 1: Infra de tenant — `tenants.config.mjs` + `src/lib/tenant.ts` + wiring do `astro.config.mjs`

**Files:**
- Create: `frontend/tenants.config.mjs`
- Create: `frontend/tenants.config.d.ts`
- Create: `frontend/src/lib/tenant.ts`
- Test: `frontend/src/lib/tenant.test.ts`
- Modify: `frontend/astro.config.mjs`

**Interfaces:**
- Produces (usado por T2–T14, pelo workflow e pelos scripts):
  - `TENANTS: Array<{ tenant: string; community: string; site: string; project: string }>` e `TENANT_BY_NAME: Record<string, …>` (de `tenants.config.mjs`, importável de Node e de Vite).
  - `getTenant(): "tisocial" | "elasnocodigo" | "devparana" | null` — lê `import.meta.env.PUBLIC_TENANT`.
  - `tenantSite(tenant: string): string` — URL canônica do tenant.

- [ ] **Step 1: Testes falhando do tenant lib**

```ts
// frontend/src/lib/tenant.test.ts
import { describe, expect, it } from "vitest";
import { getTenant, tenantSite } from "./tenant";

describe("tenant", () => {
  it("getTenant() retorna null quando PUBLIC_TENANT vazio (build codaqui)", () => {
    expect(getTenant()).toBeNull();
  });
  it("tenantSite resolve a URL canônica do tenant", () => {
    expect(tenantSite("tisocial")).toBe("https://tisocial.org.br");
    expect(tenantSite("devparana")).toBe("https://devparana.org");
  });
  it("tenantSite lança para tenant desconhecido", () => {
    expect(() => tenantSite("nope")).toThrow(/desconhecido/);
  });
});
```

(O teste de getTenant com valor setado usa `vi.stubEnv` + reset de módulo — padrão de `api-url.test.ts`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/tenant.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`frontend/tenants.config.mjs`:

```js
// Fonte única dos tenants da Fase 0.5 — consumida por astro.config.mjs (Node),
// por src/lib/tenant.ts (Vite) e pelos scripts de gate. O matrix do workflow
// .github/workflows/deploy-astro.yml espelha esta lista (manter sincronizado).
export const TENANTS = [
  { tenant: "tisocial", community: "tisocial", site: "https://tisocial.org.br", project: "tisocial" },
  { tenant: "elasnocodigo", community: "elasnocodigo", site: "https://elasnocodigo.com.br", project: "elasnocodigo" },
  { tenant: "devparana", community: "devparana", site: "https://devparana.org", project: "devparana" },
];
export const TENANT_BY_NAME = Object.fromEntries(TENANTS.map((t) => [t.tenant, t]));
```

`frontend/tenants.config.d.ts` (tipos para os imports TS):

```ts
export interface TenantDef { tenant: string; community: string; site: string; project: string; }
export const TENANTS: TenantDef[];
export const TENANT_BY_NAME: Record<string, TenantDef>;
```

`frontend/src/lib/tenant.ts`:

```ts
import { TENANT_BY_NAME } from "../../tenants.config.mjs";

export type TenantName = keyof typeof TENANT_BY_NAME & string;

/** Tenant do build atual (build-time, via vite define em astro.config.mjs). */
export function getTenant(): TenantName | null {
  const t = import.meta.env.PUBLIC_TENANT as string | undefined;
  return t ? (t as TenantName) : null;
}

/** URL canônica (site) de um tenant — usada em SEO/OG e links absolutos. */
export function tenantSite(tenant: string): string {
  const def = TENANT_BY_NAME[tenant];
  if (!def) throw new Error(`Tenant desconhecido: ${tenant}`);
  return def.site;
}
```

`frontend/astro.config.mjs` — wiring (modificar o topo do arquivo existente, manter o restante):

```js
import { TENANT_BY_NAME } from "./tenants.config.mjs";

const TENANT = process.env.TENANT ?? null;
const tenantDef = TENANT ? TENANT_BY_NAME[TENANT] : null;
if (TENANT && !tenantDef) throw new Error(`TENANT desconhecido: ${TENANT}`);
// SITE_URL explícito vence (previews locais/CI); senão o do tenant; senão codaqui.
const SITE_URL = process.env.SITE_URL ?? tenantDef?.site ?? "https://codaqui.dev";

export default defineConfig({
  srcDir: tenantDef ? `./src-tenants/${tenantDef.tenant}` : "./src",
  site: SITE_URL,
  // …manter integrations/markdown/trailingSlash existentes…
  vite: {
    plugins: [tailwindcss()],
    define: { "import.meta.env.PUBLIC_TENANT": JSON.stringify(TENANT ?? "") },
  },
});
```

- [ ] **Step 4: Rodar testes + gates**

Run: `cd frontend && npx vitest run src/lib/tenant.test.ts && npm run check && npm run build`
Expected: tudo verde (build codaqui sem TENANT continua idêntico — `git status` do `frontend/dist` não é commitado, mas o diff de URLs deve seguir 100%: `node scripts/diff-urls.mjs` após o build).

- [ ] **Step 5: Commit**

```bash
git add frontend/tenants.config.mjs frontend/tenants.config.d.ts frontend/src/lib/tenant.ts frontend/src/lib/tenant.test.ts frontend/astro.config.mjs
git commit -m "feat(fase-0.5): infra de tenant — tenants.config, lib/tenant e srcDir switching no astro.config"
```

---

### Task 2: Adapters de config das comunidades — `src/lib/community.ts`

**Files:**
- Create: `frontend/src/lib/community.ts`
- Test: `frontend/src/lib/community.test.ts`

**Interfaces:**
- Consumes: `getTenant()` (T1); `CommunitySiteConfig` e dados de `comunidades/<slug>/` (existentes, read-only).
- Produces:
  - `loadTenantConfig(tenant): Promise<CommunitySiteConfig>` — importa `comunidades/<slug>/community.config.ts` default export.
  - `tenantCssVars(config): Record<string, string>` — `--community-primary`, `--community-primary-dark`, `--community-primary-light`, `--community-accent`, `--community-footer-bg` a partir de `config.theme`.
  - `tenantNav(config): Array<{ label: string; to: string }>` — `navMenu` achatado (items com submenu viram link para o primeiro `to` do submenu — replicar o achatamento do swizzle `src/theme/Navbar/Content/index.tsx` do Docusaurus).
  - `communityBasePath(config): string` — `/comunidades/<slug>`.

- [ ] **Step 1: Testes falhando** — cobrir: loadTenantConfig("tisocial") devolve slug/cores/nav esperados (assert em campos conhecidos do config: `theme.primary === "#8DC044"`, `features.donations === true`); tenantCssVars mapeia as 5 chaves; tenantNav achata menu com submenu; communityBasePath.

- [ ] **Step 2: Ver falhar** — Run: `cd frontend && npx vitest run src/lib/community.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — dynamic imports literais por tenant:

```ts
export async function loadTenantConfig(tenant: TenantName): Promise<CommunitySiteConfig> {
  switch (tenant) {
    case "tisocial": return (await import("../../../comunidades/tisocial/community.config")).default;
    case "elasnocodigo": return (await import("../../../comunidades/elasnocodigo/community.config")).default;
    case "devparana": return (await import("../../../comunidades/devparana/community.config")).default;
  }
}
```

(tipo `CommunitySiteConfig` import type-only de `../../../comunidades/shared/types`.) Nota: `devparana/community.config.ts` importa dados locais (`./src/data/...`) — imports relativos dentro de `comunidades/` resolvem naturalmente. O `tisocial/community.config.ts` importa `./src/data/campaigns.json` — idem. Se o Vite reclamar de fs.allow no **dev server** (`astro dev` com TENANT), acrescentar `server: { fs: { allow: [".."] } }` ao vite config (comentário explicando). Build não é afetado.

- [ ] **Step 4: Testes verdes + check** — `npx vitest run src/lib/community.test.ts && npm run check`.

- [ ] **Step 5: Commit** — `feat(fase-0.5): adapters de community.config — loadTenantConfig, tenantCssVars, tenantNav`

---

### Task 3: Pages Function de proxy — `functions/[[path]].ts` + `src/lib/api-proxy-paths.ts`

**Files:**
- Create: `frontend/src/lib/api-proxy-paths.ts`
- Test: `frontend/src/lib/api-proxy-paths.test.ts`
- Create: `frontend/functions/[[path]].ts`
- Modify: `frontend/package.json` (devDep `@cloudflare/workers-types`; script `pages:dev`)

**Interfaces:**
- Produces: `isApiProxyPath(pathname: string): boolean` — paridade 1:1 com o Worker (`workers/shared/index.js`): exatos `{"/health","/docs","/auth/me","/auth/logout","/auth/finalize"}` + prefixos `["/api/","/auth/github","/auth/me","/auth/logout","/auth/finalize","/stripe/","/ledger/","/members/","/events/","/reimbursements/","/companies/","/club/","/vendors/","/account-transfers/","/admin/","/notifications/"]` com normalização de trailing slash para calls "bare" (mesma lógica do Worker). **`/auth/callback` NÃO é API** (é página — mesma exclusão proposital do Worker).
- Produces: `onRequest` Pages Function — API → `fetch(new URL(pathname + search, env.API_ORIGIN ?? "https://api.codaqui.dev"), request)` (headers/cookies intactos, como o Worker); não-API → `context.next()` (assets estáticos). Stripping de `cookie`/`authorization` no caminho estático: **não necessário** (sem terceiro — o asset serve do próprio Pages; documentar no comentário).

- [ ] **Step 1: Testes falhando de `isApiProxyPath`** — casos: `/health` true; `/auth/github?x=1` (só pathname) true; `/auth/callback` **false**; `/comunidades/tisocial` false; `/stripe/checkout-session` true; `/vendors` (bare) true; `/vendorsxyz` false; `/blog` false; `/` false.

- [ ] **Step 2: Ver falhar** — Run: `cd frontend && npx vitest run src/lib/api-proxy-paths.test.ts` → FAIL.

- [ ] **Step 3: Implementar** os dois arquivos:

```ts
// frontend/src/lib/api-proxy-paths.ts
/** Lista 1:1 com workers/shared/index.js (Fonte: API_PREFIXES/API_EXACT_PATHS). */
const API_EXACT_PATHS = new Set(["/health", "/docs", "/auth/me", "/auth/logout", "/auth/finalize"]);
const API_PREFIXES = ["/api/", "/auth/github", "/auth/me", "/auth/logout", "/auth/finalize", "/stripe/", "/ledger/", "/members/", "/events/", "/reimbursements/", "/companies/", "/club/", "/vendors/", "/account-transfers/", "/admin/", "/notifications/"];

export function isApiProxyPath(pathname: string): boolean {
  if (API_EXACT_PATHS.has(pathname)) return true;
  const p = pathname.endsWith("/") && pathname !== "/" ? pathname : pathname + "/";
  return API_PREFIXES.some((prefix) => p.startsWith(prefix));
}
```

```ts
// frontend/functions/[[path]].ts
/// <reference types="@cloudflare/workers-types" />
import { isApiProxyPath } from "../src/lib/api-proxy-paths";

const DEFAULT_API_ORIGIN = "https://api.codaqui.dev";

export const onRequest: PagesFunction<{ API_ORIGIN?: string }> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  if (!isApiProxyPath(url.pathname)) return next();
  const upstream = new URL(url.pathname + url.search, env.API_ORIGIN ?? DEFAULT_API_ORIGIN);
  return fetch(upstream, request);
};
```

- [ ] **Step 4: Verificação local da Function** — buildar e servir com wrangler:

```bash
cd frontend && npm run build && npx wrangler pages dev dist --port 8787
# em outro shell: curl -s http://localhost:8787/health → {"status":"ok",...} (veio do backend real)
# curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/ → 200 (HTML do site)
# curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/auth/callback → 200 (página)
```

(Backend local `make db-up` + `PORT=3001 npm run start:dev` deve estar no ar para o /health; se indisponível, validar só o roteamento estático e registrar smoke de proxy como pendência — padrão 0.4.)

- [ ] **Step 5: Gates + commit** — `npx vitest run && npm run check && npm run build` verdes; commit `feat(fase-0.5): Pages Function de proxy (functions/[[path]].ts) + isApiProxyPath 1:1 com o Worker`.

---

### Task 4: Componentes compartilhados de comunidade — `src/components/astro/community/`

**Files:**
- Create: `frontend/src/components/astro/community/CommunityLayout.astro`
- Create: `frontend/src/components/astro/community/CommunityTextHero.astro`
- Create: `frontend/src/components/astro/community/CommunityExploreSection.astro`
- Create: `frontend/src/components/astro/community/CommunityImpactSection.astro`
- Create: `frontend/src/components/astro/community/CommunityChannelsSection.astro`
- Test: `frontend/src/lib/community-sections.test.ts` (helpers puros extraídos)

**Interfaces:**
- Consumes: T2 (tenantCssVars, tenantNav, communityBasePath), T1.
- Produces (usado por T5–T10):
  - `<CommunityLayout config site title>` — `<html lang="pt-BR">` com: `<style>` inline das CSS vars do tenant no `:root`; `<title>{title} | {config.shortName}</title>` + meta description/OG (og:image `config.socialImage ?? config.logoUrl` com URL absoluta via `site`); header com logo (`config.logoUrl`) linkando `/` **no build tenant** e `communityBasePath(config)` **no build codaqui** (prop `homeHref` resolvida pelo caller), nav achatado (T2), chip "← Codaqui" via `resolveCodaquiUrl` em builds tenant (replicar `CodaquiBackChip`); footer com `theme.footerBg` + navMenu.
  - Seções presentacionais portando o markup de `comunidades/shared/components/{CommunityTextHero,CommunityExploreSection,CommunityImpactSection,CommunityChannelsSection}.tsx` para `.astro`+Tailwind, mesmos textos/estrutura; dados por props.
  - Helpers testáveis em `src/lib/community-sections.ts`: `impactStatsFromCampaigns(campaigns)` (mesma derivação de `comunidades/tisocial/src/pages/index.tsx` — ações = count, pessoas = sum beneficiados, R$ = formatBRL), `exploreCardsFromConfig(config)` (features → cards, mesmo rótulo/ordem do original).

- [ ] **Step 1: Testes falhando** dos helpers puros (impactStats com campaigns fixture: 2 ações, 30 pessoas, "R$ 1.500,00"; exploreCards com features `{donations:true, transparency:true, events:false, blog:true, docs:true}` → 4 cards com labels esperados replicando o original).

- [ ] **Step 2: Ver falhar** → FAIL.

- [ ] **Step 3: Implementar** helpers + componentes. Regras: zero JS de runtime (astro puro), hexes só vindos de `config` (CSS vars), textos 1:1 com os componentes-fonte (o fonte é spec — ler cada `.tsx` de `comunidades/shared/components/`).

- [ ] **Step 4: Verificação estrutural** — build codaqui continua verde (`npm run build && npm run check`); os componentes só são exercidos de fato em T5+ (páginas), aqui basta compilar. Testes dos helpers verdes.

- [ ] **Step 5: Commit** — `feat(fase-0.5): componentes Astro de comunidade (CommunityLayout + seções) e helpers`

---

### Task 5: Tenant build do tisocial — `src-tenants/tisocial/` + redirects pós-build

**Files:**
- Create: `frontend/src-tenants/tisocial/{pages/index.astro,pages/apoiar.astro,pages/transparencia.astro,pages/equipe.astro}`
- Create: `frontend/src-tenants/tisocial/content.config.ts`
- Create: `frontend/src-tenants/tisocial/env.d.ts`
- Create: symlinks: `frontend/src-tenants/tisocial/{components,layouts,lib,data,content,styles,public}` → `../../src/*`
- Create: `frontend/scripts/build-tenant-redirects.mjs`
- Modify: `frontend/package.json` (`build` ganha `&& node scripts/build-tenant-redirects.mjs`)

**Interfaces:**
- Consumes: T1–T4; `DonationFlowIsland` (existe, suporta `lockedTargetId`/`authCommunitySlug` — replicar o uso de `comunidades/shared/components/CommunityApoiarPage.tsx`); `TransparencyApp` (existe — replicar `CommunityTransparenciaPage.tsx` passando slug).
- Produces:
  - Build `TENANT=tisocial npm run build` emitindo `/`, `/apoiar`, `/transparencia`, `/equipe` com branding tisocial e rotas limpas.
  - `scripts/build-tenant-redirects.mjs` — quando `TENANT` setado, escreve `dist/_redirects`:
    ```
    /comunidades/<slug> / 301
    /comunidades/<slug>/* /:splat 301
    ```

- [ ] **Step 1: Scaffold** — criar dirs + symlinks comitados (`ln -s ../../src/components frontend/src-tenants/tisocial/components` etc.; `git add` grava o symlink). `env.d.ts`:

```ts
/// <reference types="astro/client" />
interface ImportMetaEnv { readonly PUBLIC_TENANT: string; readonly PUBLIC_API_URL?: string; readonly PUBLIC_STRIPE_PUBLISHABLE_KEY?: string; }
interface ImportMeta { readonly env: ImportMetaEnv; }
```

- [ ] **Step 2: Redirects pós-build (TDD)** — teste de script: com `TENANT=tisocial` e `dist/` mock, `build-tenant-redirects.mjs` escreve as 2 linhas corretas; sem TENANT, não escreve. Rodar e ver falhar → implementar → verde.

- [ ] **Step 3: Páginas tenant (ports 1:1)** — ler `comunidades/tisocial/src/pages/{index,apoiar,transparencia,equipe}.tsx` + componentes shared e reproduzir em `.astro` usando T4:
  - `index.astro` — `getTenant()` → `loadTenantConfig`; CommunityTextHero (`config.hero`), CommunityExploreSection, CommunityImpactSection (`impactStatsFromCampaigns` com `campaigns.json` importado de `../../../../comunidades/tisocial/src/data/campaigns.json` — path via symlink `data/`? **não**: o symlink `data` aponta para `src/data`; importar diretamente pelo path relativo cruzado `../../../../comunidades/tisocial/src/data/campaigns.json`), CommunityChannelsSection.
  - `apoiar.astro` — mesmo contrato de `CommunityApoiarPage`: ilha `DonationFlowIsland` com `lockedTargetId={config.slug}` + `authCommunitySlug={config.slug}`, mesmos textos.
  - `transparencia.astro` — `TransparencyApp` com slug da comunidade (replicar `useCommunityBalance(community.slug)` → prop da ilha).
  - `equipe.astro` — porte de `equipe.tsx` usando `team.ts` da comunidade (`../../../../comunidades/tisocial/src/data/team.ts`).
  - Todas com `<CommunityLayout config site title>`. Em builds tenant, links internos usam rotas limpas; `homeHref="/"`.

- [ ] **Step 4: Buildar os dois modos** —

```bash
cd frontend && npm run build && node scripts/diff-urls.mjs   # codaqui inalterado, paridade 100%
TENANT=tisocial npm run build && node scripts/tenant-urls.mjs dist tisocial  # tenant-urls ainda não existe (T11) — validar manualmente: ls dist/{index,apoiar,transparencia,equipe}/index.html + cat dist/_redirects
```

- [ ] **Step 5: Commit** — `feat(fase-0.5): tenant build tisocial — src-tenants scaffold, 4 páginas, redirects pós-build`

---

### Task 6: Blog e docs do tisocial (builds tenant E codaqui)

**Files:**
- Create: symlink `frontend/src/content/community-blog/tisocial` → `../../../../comunidades/tisocial/blog`
- Modify: `frontend/src/content.config.ts` (collection `communityBlog`)
- Create: `frontend/src-tenants/tisocial/content.config.ts`
- Create: `frontend/src-tenants/tisocial/pages/blog/{index.astro,[...slug].astro,tags/[tag].astro,rss.xml.ts}`
- Create: `frontend/src-tenants/tisocial/pages/docs/[...slug].astro`
- Create: `frontend/src/pages/comunidades/tisocial/blog/{index.astro,[...slug].astro,tags/[tag].astro}` + `rss.xml.ts`
- Create: `frontend/src/pages/comunidades/tisocial/docs/[...slug].astro`
- Create: `frontend/src/pages/comunidades/tisocial/{index.astro,apoiar.astro,transparencia.astro,equipe.astro}` (wrappers codaqui do restante do tisocial)

**Interfaces:**
- Produces: collection `communityBlog` (schema: title, date, authors (string), tags (string[]), draft?, image?, slug) — glob `src/content/community-blog/tisocial/*.md` no src principal e `./content/community-blog/tisocial/*.md` no tenant (mesma definição duplicada nos dois content.config, como fazem blog/trilhas).
- Regras de paridade (fonte: plugin blog Docusaurus em `docusaurus.config.ts:172-222`): rotas `/comunidades/tisocial/blog`, `/comunidades/tisocial/blog/<slug do frontmatter>`, `/comunidades/tisocial/blog/tags/<tag>` (+paginação se o original emitir — conferir com `diff-urls` em T11), RSS `type: "all"` → `rss.xml` (e `atom.xml`/`feed.json` se o build de referência os tiver — verificar `build/comunidades/tisocial/blog/`). Blog tenant nasce em `/blog*`. Docs: única página `docs/index.md` → `/docs` (tenant) e `/comunidades/tisocial/docs` (codaqui).

- [ ] **Step 1: Collection + teste de carregamento** — teste: `getCollection("communityBlog")` retorna 10 posts com slugs legados; frontmatter `authors: tisocial` preservado.

- [ ] **Step 2: Páginas** — porte 1:1 do `BlogLayout`/lista do Docusaurus (blogTitle `"T.I. Social — Blog"`, banner com gradiente `theme.primary→primaryDark`, posts com autor/data/tags, Giscus **não** entra em blog de comunidade — conferir fonte). Wrappers codaqui reutilizam os mesmos componentes com `homeHref=/comunidades/tisocial`.

- [ ] **Step 3: Gates** — build codaqui: `node scripts/diff-urls.mjs` cobrindo `/comunidades/tisocial/*` (exclusão ainda ativa até T11 — validar que as URLs existem com `ls`/grep no dist). Build tenant tisocial: `/`, `/blog`, 10 posts, `/blog/tags/*`, `/docs`.

- [ ] **Step 4: Commit** — `feat(fase-0.5): blog+docs tisocial em Astro (tenant e /comunidades/tisocial)`

---

### Task 7: Tenant elasnocodigo completo (builds tenant E codaqui)

**Files:**
- Create: `frontend/src-tenants/elasnocodigo/` (mesmo scaffold de T5: symlinks, env.d.ts, content.config vazio de blog — a comunidade não tem blog; pode omitir content.config se não houver collections)
- Create: `frontend/src-tenants/elasnocodigo/pages/{index.astro,apoiar.astro,transparencia.astro,equipe.astro}`
- Create: `frontend/src/pages/comunidades/elasnocodigo/{index.astro,apoiar.astro,transparencia.astro,equipe.astro,docs/[...slug].astro}`

**Interfaces:**
- Consumes: T1–T5 (mesma maquinaria; sem blog/collections).
- Regras: porte 1:1 de `comunidades/elasnocodigo/src/pages/*` (fonte é spec); `features` do config ligam seções (events/blog/docs false) — não emitir seções desligadas.

- [ ] **Step 1: Scaffold + páginas tenant** — build `TENANT=elasnocodigo` emitindo `/`, `/apoiar`, `/transparencia`, `/equipe`.
- [ ] **Step 2: Wrappers codaqui** — `/comunidades/elasnocodigo/*` + docs.
- [ ] **Step 3: Gates** — builds dos dois modos + presença das URLs.
- [ ] **Step 4: Commit** — `feat(fase-0.5): tenant elasnocodigo (build tenant + /comunidades/elasnocodigo)`

---

### Task 8: Tenant devparana completo (builds tenant E codaqui)

**Files:**
- Create: `frontend/src-tenants/devparana/` (scaffold)
- Create: `frontend/src-tenants/devparana/pages/{index.astro,apoiar.astro,transparencia.astro,equipe.astro,embaixadores.astro,rfcs.astro,mentores.astro}`
- Create: `frontend/src/components/astro/community/devparana/{RfcCard.astro,RfcList.astro,RfcStatusBadge.astro,RfcHero.astro}` (nomes conforme os componentes-fonte reais em `comunidades/devparana/src/components/`)
- Create: `frontend/src/pages/comunidades/devparana/{…mesmas páginas…,docs/[...slug].astro}`

**Interfaces:**
- Regras específicas: `eventSources: ["meetup:devparana"]` → seção de eventos na home filtrando `loadEventsIndex().events` por `sourceKey` (mesmo filtro do original); dados de embaixadores/mentores/team de `comunidades/devparana/src/data/*`; RFCs replicam comportamento dos `Rfc*` (fonte é spec). Ilha de membros: replicar o uso de `useCodaquiMembers` do original — se for fetch client-side de `/members`, usar `MembersDirectoryIsland`/`MembersWallIsland` existente com filtro; se for build-time, `loadPublicMembers()` já existe.

- [ ] **Step 1: Scaffold + componentes RFC** — testes puros se houver helpers (ex.: status→cor do badge, via data).
- [ ] **Step 2: Páginas tenant + wrappers codaqui**.
- [ ] **Step 3: Gates** — builds + URLs (incl. seção eventos filtrada).
- [ ] **Step 4: Commit** — `feat(fase-0.5): tenant devparana (build tenant + /comunidades/devparana, RFCs, embaixadores)`

---

### Task 9: campostechpg no build codaqui + gate de paridade atualizado

**Files:**
- Create: `frontend/src/pages/comunidades/campostechpg/{index.astro,apoiar.astro,transparencia.astro,equipe.astro,mentores.astro,docs/[...slug].astro}`
- Modify: `frontend/scripts/diff-urls.mjs` (remover exclusão `/comunidades`)

**Interfaces:**
- campostechpg não tem domínio/tenant — só wrappers codaqui (mesma maquinaria de T7/T8, `eventSources: ["sympla:campostech"]`).
- **O gate `diff-urls` passa a cobrir `/comunidades/*` em todos os builds codaqui** — executar e corrigir faltas (blog tags/paginação do tisocial, feeds, etc.) até 100%.

- [ ] **Step 1: Wrappers campostechpg**.
- [ ] **Step 2: Remover exclusão** do diff-urls + atualizar comentário do histórico.
- [ ] **Step 3: `npm run build && node scripts/diff-urls.mjs` → 100%** (iterar nas faltas — cada URL faltante é bug das T5–T8).
- [ ] **Step 4: Commit** — `feat(fase-0.5): campostechpg em /comunidades + diff-urls cobre comunidades (paridade 100%)`

---

### Task 10: CI — workflow de deploy matrix + pr-check

**Files:**
- Create: `.github/workflows/deploy-astro.yml`
- Modify: `.github/workflows/pr-check.yml` (job `astro-tenants`)

**Interfaces:**
- Secrets/vars novos (documentados na T11): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Workflow (padrões do repo: `permissions: {}`, concurrency, `actions/setup-node@v6` node 24, `npm ci`):

```yaml
name: Deploy Astro (Pages)
on:
  push: { branches: [main, develop] }
  workflow_dispatch:
    inputs: { tenant: { description: "Tenant único (vazio = todos)", required: false, default: "" } }
concurrency: { group: deploy-astro-${{ github.ref }}, cancel-in-progress: true }
permissions: {}
jobs:
  deploy:
    # `if` em nível de STEP (job-level if não vê `matrix` no GitHub Actions).
    strategy:
      fail-fast: false
      matrix:
        include:
          - { tenant: codaqui, project: codaqui, site: "https://codaqui.dev" }
          - { tenant: tisocial, project: tisocial, site: "https://tisocial.org.br" }
          - { tenant: elasnocodigo, project: elasnocodigo, site: "https://elasnocodigo.com.br" }
          - { tenant: devparana, project: devparana, site: "https://devparana.org" }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - name: Build (${{ matrix.tenant }})
        if: ${{ secrets.CLOUDFLARE_API_TOKEN != '' && (github.event.inputs.tenant == '' || github.event.inputs.tenant == matrix.tenant) }}
        working-directory: frontend
        run: |
          npm ci --ignore-scripts
          TENANT=${{ matrix.tenant }} SITE_URL=${{ matrix.site }} npm run build
      - name: Deploy direct upload (${{ matrix.project }})
        if: ${{ secrets.CLOUDFLARE_API_TOKEN != '' && (github.event.inputs.tenant == '' || github.event.inputs.tenant == matrix.tenant) }}
        run: npx wrangler pages deploy frontend/dist --project-name=${{ matrix.project }} --branch=${{ github.ref_name }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Notas: `--branch` cria branch deployment para previews; o deploy vira production quando a branch é a production branch configurada no projeto Pages (`main`). O `if` com secrets evita vermelho até os secrets existirem (documentar no runbook — build local `make astro-verify-tenants` é a fonte de verdade até lá). O step de deploy roda na raiz para reusar o `wrangler` das devDependencies do package.json raiz (`npx` não o baixa de novo).

- pr-check: job `astro-tenants` com matrix dos 4 tenants rodando só `npm ci` + `TENANT=… npm run build` (sem deploy) — quebra de build de tenant vira vermelho no PR.

- [ ] **Step 1: Workflow novo + job no pr-check**.
- [ ] **Step 2: Validar YAML** (`npx yaml` parse ou actionlint se disponível) e simular build matrix localmente (rodar os 4 builds na sequência — já garantido pelas T5–T9).
- [ ] **Step 3: Commit** — `ci(fase-0.5): deploy matrix Pages (direct upload) + build de tenants no pr-check`

---

### Task 11: Gates de tenant + runbook de operação (DEVELOPMENT.md)

**Files:**
- Create: `frontend/scripts/tenant-urls.mjs`
- Modify: `Makefile` (`astro-verify-tenants`; `astro-verify` existente mantido)
- Modify: `DEVELOPMENT.md` (secrets, projetos Pages, runbook DNS com rollback, nota Windows `core.symlinks`)

**Interfaces:**
- `tenant-urls.mjs <dist> <tenant>` — allow-list: `/`, `/apoiar`, `/transparencia`, `/equipe`; se houver `src/content/community-blog/<slug>`: `/blog` + slugs lidos dos frontmatters (regex `^slug:\s*(.+)$`) + `/blog/tags` (opcional); `/docs`. Exit 1 listando faltantes.
- Makefile: `astro-verify-tenants` — para cada tenant: `TENANT=<t> npm run build` (em frontend) + `node scripts/tenant-urls.mjs dist <t>`; e `astro-verify` ganha a chamada do diff-urls já existente (nada muda).
- DEVELOPMENT.md runbook (seção nova "Multi-tenant (Fase 0.5)"):
  1. Criar os 4 projetos Pages (`npx wrangler pages project create <project> --production-branch=main` ou dashboard).
  2. Secrets do repo: `CLOUDFLARE_API_TOKEN` (mínimo: *Cloudflare Pages:Edit* no account) + `CLOUDFLARE_ACCOUNT_ID` (documentado na tabela de secrets).
  3. Por domínio tenant (janela de 1–2h offline aceita): remover a rota/custom domain do Worker (dashboard Cloudflare → Workers Routes), apontar o domínio para o projeto Pages (apex → registro CNAME para `<project>.pages.dev` com flattening; subdomínios wildcard `*.<domínio>` conforme o Worker tinha — avaliar necessidade), aguardar SSL universal.
  4. Verificação pós-DNS: `/` serve a home do tenant (não redirect), `/blog` (tisocial), login via doação >R$100 (handoff cross-domain), doação Stripe embedded, `/comunidades/<slug>/*` → 301 para `/*`.
  5. Rollback: reverter o DNS + redeploy do Worker do histórico do git (`git checkout <sha-antes-da-deleção> -- workers/ && npm run worker:deploy:<slug>`).
  6. Nota: previews `<branch>.<project>.pages.dev` caem no fallback codaqui.dev em redirects de login/doação (gap `*.pages.dev` documentado — fora de escopo).
  7. Nota dev Windows: symlinks exigem `git config core.symlinks true`.

- [ ] **Step 1: Script tenant-urls (TDD leve: fixture dist fake)**.
- [ ] **Step 2: Makefile target**.
- [ ] **Step 3: DEVELOPMENT.md** (seções conforme acima, com AGENT-INDEX do arquivo mantido intacto — só adicionar seção).
- [ ] **Step 4: `make astro-verify-tenants` verde**.
- [ ] **Step 5: Commit** — `docs(fase-0.5): gates de tenant (tenant-urls) + runbook de operação Cloudflare Pages`

---

### Task 12: Marcar D1 como substituído + nota de supersessão na ADR 004

**Files:**
- Modify: `docs/plans/multisite/README.md`
- Modify: `docs/adrs/004-multisite-communities.md`

- [ ] **Step 1:** Banner no topo do README do D1 (após o AGENT-INDEX): bloco de citação "⚠️ **Substituído (2026-10-27)** — esta arquitetura (Worker pass-through) foi substituída pela Fase 0.5 do anexo [refatoracao-frontend-astro.md](../codaqui-1-0/refatoracao-frontend-astro.md): build matrix por tenant no Cloudflare Pages + Pages Function. Mantido para histórico."
- [ ] **Step 2:** ADR 004 — adicionar seção `## Registro de supersessão parcial (2026-10-27)` (precedente: entradas datadas da ADR 001): decisão D1 (Worker pass-through) superseda parcialmente pela Fase 0.5; ADR 011 (a produzir no merge da 0.6) consolida a decisão nova; o que permanece válido: segregação por comunidade no ledger/Stripe e o piloto de conteúdo.
- [ ] **Step 3: Commit** — `docs(fase-0.5): marca plano D1 como substituído e ADR 004 com nota de supersessão parcial`

---

### Task 13: Deletar `workers/` e limpar referências (SOMENTE após confirmação de DNS)

> **Gatilho:** executar quando o usuário confirmar que os 3 domínios estão servindo do Pages (runbook T11 verificado). Até lá, `workers/` permanece.

**Files:**
- Delete: `workers/` (pasta inteira)
- Modify: `package.json` raiz (remover scripts `worker:dev:*`/`worker:deploy:*`; remover `wrangler` das devDeps? **manter** — o workflow usa `npx wrangler pages deploy`)
- Modify: `Makefile` (remover targets `worker-dev-*`/`worker-deploy-*`)
- Modify: `compose.yaml` (remover serviços `worker-*`)
- Modify: `DEVELOPMENT.md` (remover seção de deploy de Workers; apontar para o runbook da 0.5)
- Modify: `AGENTS.md` (seção "Multi-tenant communities": substituir o parágrafo D1 por ponteiro para `docs/modules/community/COMMUNITY_SITES.md` — atualizar esse módulo com a arquitetura nova: matrix + Pages Function; **não reescrever o AGENTS.md inteiro — isso é da 0.6**)

- [ ] **Step 1: Deletar pasta + referências (grep por `workers/` no repo para não deixar resto: scripts, docs, Dockerfile).**
- [ ] **Step 2: Gates completos** — `cd frontend && npm run build && npm run check && npm run test && node scripts/diff-urls.mjs` + `make astro-verify-tenants` + typecheck raiz. `compose config` válido (`podman compose -f compose.yaml config -q`).
- [ ] **Step 3: Commit** — `chore(fase-0.5): remove workers/ — multi-tenant agora é build matrix + Pages Function`

---

### Task 14: Verificação final da 0.5

- [ ] **Step 1: Gates completos na develop** — build dos 4 tenants + codaqui, check, test, diff-urls 100%, tenant-urls dos 4.
- [ ] **Step 2: Smoke pós-DNS (com os domínios apontados)** — checklist do runbook executado; registrar resultado no relatório (itens que exigem login real/documentação seguem o padrão de pendência ambiental das fases anteriores).
- [ ] **Step 3: Checkboxes + commit final** — marcar o plano; commit `chore(fase-0.5): verificação final — tenants no Pages, workers/ removida, paridade 100%`.

## Critérios de pronto (da spec, mapeados)

- [ ] tisocial.org.br servindo rotas limpas em `/` (T5 + T11 runbook) — **e elasnocodigo.com.br / devparana.org** (D2)
- [ ] login cross-domain OK (T3 proxy + finalize same-origin; smoke T11/T14)
- [ ] doação Stripe cross-domain OK (mesmos trilhos; smoke T11/T14)
- [ ] pasta `workers/` deletada (T13, após DNS confirmado)
- [ ] build matrix + projeto Pages por tenant (T10)
- [ ] Pages Function de proxy (T3)
- [ ] paridade: `/comunidades/*` no build codaqui via diff-urls 100% (T9)
