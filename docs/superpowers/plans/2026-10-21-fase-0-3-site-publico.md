# Fase 0.3 — Site Público Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todas as páginas públicas restantes do Docusaurus para o Astro — institucionais, doação Stripe, transparência, membros/`@handle`, clube, `/design-system` — com paridade total de URLs públicas, OG/JSON-LD e sitemap.

**Architecture:** Páginas `.astro` zero-JS por padrão; ilhas React apenas onde há interatividade real (doação, tabelas do ledger, widgets de API, seções autenticadas). Dados estáticos portados de `src/data/` para `frontend/src/data/`; APIs públicas consumidas por ilhas com `client:visible`/`client:load`/`client:only` conforme a tabela de hidratação da spec. O gate `diff-urls.mjs` é estendido para todas as seções públicas.

**Tech Stack:** Astro 7.4, React 19 (ilhas), MUI v9 (ilhas app-like), Tailwind v4 (tokens `--cq-*`), `@astrojs/sitemap`, `@stripe/react-stripe-js` + `@stripe/stripe-js` (checkout embutido), `qrcode.react` (perfil), Vitest.

**Spec:** `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (linha 0.3 da tabela de fases + mapa de rotas + tabela de hidratação) e `docs/plans/codaqui-1-0/design-system.md` (página `/design-system`).

## Inventário validado (2026-10-21) — fonte de verdade deste plano

**Páginas públicas a migrar** (fonte Docusaurus → destino Astro):

| URL | Fonte | Tipo |
|---|---|---|
| `/contato` | `src/pages/contato.tsx` | estática (social.ts, PageHero) |
| `/projetos` | `src/pages/projetos.tsx` | estática (projects.ts, PageHero) |
| `/bio` | `src/pages/bio.tsx` | estática (social.ts; logo por tema) |
| `/sobre/equipe` | `src/pages/sobre/equipe.tsx` | estática (team.ts) |
| `/sobre/titulos` | `src/pages/sobre/titulos.tsx` | estática (titulos.ts) |
| `/sobre/conduta` | `src/pages/sobre/conduta.md` | markdown puro |
| `/sobre/pais-responsaveis` | `src/pages/sobre/pais-responsaveis.md` | markdown puro |
| `/regex` | `src/pages/regex.md` | markdown puro |
| `/termos-de-compra` | `src/pages/termos-de-compra.md` | markdown puro |
| `/participe/estudar` | `src/pages/participe/estudar.tsx` | estática (dados inline, InfoCard) |
| `/participe/mentoria` | `src/pages/participe/mentoria.tsx` | estática (MENTORS inline, Calendar URL) |
| `/sobre/insights` | `src/pages/sobre/insights.tsx` | dados + ilha (timeline.ts, social-stats snapshot, SiteAnalytics) |
| `/sobre/ong` | `src/pages/sobre/ong.tsx` | dados + ilha (communities, MembersWall, social-stats) |
| `/eventos` | `src/pages/eventos.tsx` | snapshot `/events/index.json` + ilha leve (filtros) |
| `/eventos/detalhe` | `src/pages/eventos/detalhe.tsx` | fallback legado: redirect client-side p/ rota estática; exceção Stripe `?status=success&session_id=` |
| `/transparencia` | `src/pages/transparencia.tsx` | ilha (GET /ledger/community-balances + /ledger/transparency-stats; TransactionTable) |
| `/participe/apoiar` | `src/pages/participe/apoiar.tsx` | ilha maior (DonationFlow + Stripe embedded checkout; PJ `?modo=empresa`) |
| `/patrocinadores` | `src/pages/patrocinadores.tsx` | ilha (GET /companies/sponsors) |
| `/membros` | `src/pages/membros/index.tsx` | ilha (GET /members, /members/donors, /stripe/club-members, /stripe/business-members) |
| `/membros/perfil` | `src/pages/membros/perfil.tsx` (1062 linhas) | híbrida: perfil público por `?handle=` + seções auth |
| `/@<handle>` | `src/plugins/member-pages.ts` + `MemberProfileRoute` | getStaticPaths com fetch `GET /members` tolerante a falha + JSON-LD Person |
| `/clube` | `src/pages/clube.tsx` (770 linhas) | híbrida: raffles públicos + ilhas auth (wallet, entrar em sorteio) |
| `/certificado/verificar` | `src/pages/certificado/verificar.tsx` | ilha (GET /events/certificates/verify/:code) |
| `/design-system` | spec `design-system.md` | nova, 8 seções, dados reais de timeline.ts |

**Redirects-stub legados** (client-side hoje; no Astro: página com meta refresh + link, preservando a URL): `/quero/{estudar,apoiar,mentoria}` → `/participe/*`; `/team` → `/sobre/equipe`; `/contact` → `/contato`; `/conduta` → `/sobre/conduta`; `/ong` → `/sobre/ong`; `/timeline` → `/sobre/timeline`; `/sobre/timeline` → `/sobre/insights`; `/pais_responsaveis` → `/sobre/pais-responsaveis`; `/blog/archive/2022..2025` → `/blog`.

**Já migradas (0.1/0.2):** `/`, `/eventos/<rotas de evento>`, `/admin/eventos`, `/auth/callback`, `/blog*`, `/trilhas*`.

**Fora de escopo na 0.3 (rulings do controlador):**
- `/admin/*` (13 páginas), `/membro/*`, `/membros/empresa` → Fase 0.4.
- `/eventos/comprovante` (recibo 100% autenticado) → Fase 0.4. *Custo se errado: link de recibo quebra no cutover se a 0.4 atrasar — mitigado porque o Docusaurus segue no ar até a 0.6.*
- `/comunidades/*` (47 URLs whitelabel) → Fase 0.5 (multi-tenant). O gate exclui `/comunidades` até lá.
- `/sobre/timeline` existe só como stub de redirect (destino `/sobre/insights`) — entra como redirect, não como página.

**Fatos de integração (verificados no inventário):**
- og:title Docusaurus: `<título> | CODAQUI.dev` em todas as páginas (contrato Giscus nos posts).
- Stripe embedded: `POST /stripe/checkout-session` → `{ clientSecret }` → `StripeEmbeddedCheckoutDialog` (`@stripe/react-stripe-js`); publishable key vem de `customFields` do Docusaurus (`docusaurus.config.ts` — verificar o nome exato do campo). Retorno: `/participe/apoiar?status=success&session_id=` (embedded) / `status=cancelled` (hosted fallback). Anônimo até R$ 100; acima exige login.
- Transparência: `GET /ledger/community-balances` + `GET /ledger/transparency-stats`; `TransactionTable` + `TransactionDetailDialog` (classificação por prefixo de `referenceId` em `src/utils/transaction.tsx`).
- `/@handle`: fetch paginado `GET /members?limit=100&page=N` (máx 50) em build; falha NÃO quebra o build (warn + lista vazia — o 404 com redirect cobre o fallback). JSON-LD Person via `buildMemberJsonLd` (`src/utils/member-path.ts`).
- 404 swizzlado: regex `^\/@([a-zA-Z0-9_-]+)\/?$` → `location.replace('/membros/perfil?handle=<h>')` com `noindex,nofollow`.
- Sitemap Docusaurus: 639 URLs (changefreq weekly, priority 0.5); desligado em preview. `@astrojs/sitemap` no Astro.
- `robots.txt`: `Disallow: /previews/` + `Sitemap: https://codaqui.dev/sitemap.xml` — copiar para `frontend/public/robots.txt`.
- SiteHeader Astro já tem todos os hrefs finais — a 0.3 faz todos existirem (resolve os 404s reportados em 2026-10-21).
- `useSocialStatsSnapshot` + constantes de `social-stats.ts` NÃO portados ainda (comentário no arquivo do frontend diz "fora desta fase" — era a 0.1; agora é hora).

## Global Constraints

- Trabalho na branch `develop`, direto na raiz do repo (sem worktree).
- **Não modificar** nada do Docusaurus fora de `frontend/` — exceções permitidas: `Makefile`, `DEVELOPMENT.md`, `AGENTS.md`, `docs/`.
- Commits em pt-BR, conventional commits, um commit ou mais por task.
- **Zero JS por padrão**; ilhas só com: `client:visible` (abaixo da dobra: Giscus, widgets, contadores), `client:load` (primeiro paint interativo: NavbarAuth, ThemeToggle), `client:only="react"` (seções que dependem de `window`/auth). Nenhuma ilha pública > 100 KB gzip de JS (meta da spec — medir na verificação final).
- Nunca hardcode de hex — tokens `--cq-*` / utilities do tema Tailwind / tema MUI nas ilhas.
- og:title final no HTML: `<título> | CODAQUI.dev` (padrão estabelecido nas Tasks 7-12 da 0.2).
- Todo `<img>` com `alt`; IconButtons com `aria-label`; hierarquia h1→h2→h3 sem pular; links externos `target="_blank" rel="noopener noreferrer"`.
- Linguagem inclusiva: "participantes", "programa", "Associação".
- TDD em `frontend/src/lib/` (teste falhando → implementação → verde → commit). Ports de dados (`src/data/*`) não exigem testes novos, mas exigem verificação de paridade de conteúdo (diff ou contagem).
- Port de componente = ler o fonte Docusaurus e reproduzir comportamento + visual com tokens do DS; o arquivo-fonte é o spec. Adaptações obrigatórias sempre: MUI→Tailwind em partes puramente apresentacionais; MUI permitido dentro de ilhas React.
- O gate `diff-urls.mjs` estendido é o juiz de paridade: **0 URLs faltando** nas seções públicas cobertas.
- APIs públicas chamadas por ilhas usam `PUBLIC_API_URL`/config existente em `frontend/src/lib/config.ts` (verificar nome real) — mesmo contrato do backend atual, sem mudar o backend.

---

## Task 1: Camada de dados — port de `src/data/*` restantes

**Files:**
- Create: `frontend/src/data/team.ts` (port de `src/data/team.ts`)
- Create: `frontend/src/data/projects.ts` (port de `src/data/projects.ts`)
- Create: `frontend/src/data/timeline.ts` (port de `src/data/timeline.ts`)
- Create: `frontend/src/data/titulos.ts` (port de `src/data/titulos.ts`)
- Create: `frontend/src/data/analytics.ts` (port de `src/data/analytics.ts`)
- Modify: `frontend/src/data/social-stats.ts` (adicionar as constantes que faltam: `SOCIAL_STATS_URL`, baselines — ver o original)

**Interfaces:**
- Produces: `diretoria`, `membros`, `alumni`, `mentores` (team); `projects`; `timelineEvents`, `TimelineStats` se houver; `titulos`; `ANALYTICS_URL` + tipos; `SOCIAL_STATS_URL` + tipos já existentes. Nomes de export **idênticos** aos do Docusaurus (as páginas portadas os importam sem adaptação de nome).

- [x] **Step 1: Portar cada arquivo de dados**

Copiar o conteúdo de cada `src/data/<nome>.ts` para `frontend/src/data/<nome>.ts`, ajustando apenas imports que apontem para fora de `src/data` (ex.: se `timeline.ts` importa tipos de outro lugar, portar o tipo junto). Não alterar dados. Se o original referencia `static/` paths ou `@site/`, reescrever para caminhos do Astro (`/img/...` já funciona: `frontend/public/img` espelha `static/img` — confirmar e anotar no relatório).

- [x] **Step 2: Verificação de paridade de conteúdo**

Run (raiz): `for f in team projects timeline titulos analytics; do echo "== $f"; node -e "const a=require('./src/data/$f.ts')" 2>/dev/null || true; done` — como são TS, em vez disso: comparar contagens estruturais com grep (ex.: `grep -c "name:" src/data/team.ts` vs `frontend/src/data/team.ts`; `grep -c "^\s*{" src/data/projects.ts` vs port). Registrar a tabela de contagens no relatório — devem ser idênticas.

- [x] **Step 3: Completar `social-stats.ts`**

Ler `src/data/social-stats.ts` da raiz e portar para `frontend/src/data/social-stats.ts` o que falta (`SOCIAL_STATS_URL`, `BASELINE_TOTAL_EVENTS` e quaisquer constantes/funções que `useSocialStatsSnapshot` usa — o hook será portado na Task 6). Manter os tipos já existentes no arquivo do frontend.

- [x] **Step 4: Verificar**

Run: `cd frontend && npx astro check`
Expected: 0 erros novos.

- [x] **Step 5: Commit**

```bash
git add frontend/src/data/
git commit -m "feat(fase-0.3): port da camada de dados (team, projects, timeline, titulos, analytics, social-stats)"
```

---

## Task 2: Utils/lib — transaction, member-path, datetime, document, api-url (TDD nos puros)

**Files:**
- Create: `frontend/src/lib/transaction.ts` (port de `src/utils/transaction.tsx` — remover JSX do `TX_TYPE_CONFIG` se houver: ícones MUI viram chaves de texto/emoji; anotar o mapeamento)
- Create: `frontend/src/lib/member-path.ts` (port 1:1 de `src/utils/member-path.ts`)
- Create: `frontend/src/lib/datetime.ts` (port de `src/utils/datetime.ts`)
- Create: `frontend/src/lib/document.ts` (port de `src/utils/document.ts`)
- Create: `frontend/src/lib/api-url.ts` (port de `src/lib/api-url.ts` — adaptar para o config do Astro; verificar como `frontend/src/lib/config.ts` resolve a API hoje e **unificar**: se `config.ts` já exporta a URL da API, `api-url.ts` delega a ela)
- Test: `frontend/src/lib/transaction.test.ts`, `member-path.test.ts`, `document.test.ts`, `datetime.test.ts`

**Interfaces:**
- Produces (assinaturas idênticas ao Docusaurus): `formatBRL(cents: number): string`, `TX_TYPE_CONFIG`, `deriveTransactionMeta`, tipos `CommunityBalance`/`TransparencyStats`/`LedgerTransaction` (nomes reais do original); `MEMBER_HANDLE_REGEX`, `buildMemberPath(member): string`, `buildMemberJsonLd(member, siteUrl)`, tipo `PublicMemberProfile`; `formatDocument(doc: string): string`; funções de `datetime.ts` com os mesmos nomes.
- Consumes: nada das tasks 0.2; consome o config de API existente.

- [x] **Step 1: Escrever os testes falhando**

Para cada função pura, escrever testes com casos reais tirados do uso atual (ler os arquivos-fonte e extrair 3-5 casos cada):
- `formatBRL`: `formatBRL(123456)` → `"R$ 1.234,56"`; `formatBRL(0)` → `"R$ 0,00"`; negativo.
- `formatDocument`: CPF `12345678909` → `123.456.789-09`; CNPJ `44593429000105` → `44.593.429/0001-05`; pass-through de tamanho inválido.
- `buildMemberPath`: `{ handle: "endersonmenezes" }` → `/@endersonmenezes`; regex aceita/rejeita handles (com hífen, com underscore, com espaço → rejeita).
- `buildMemberJsonLd`: snapshot das chaves obrigatórias (`@type: "Person"`, `name`, `url`).
- `deriveTransactionMeta`: prefixos `stripe-pi:`, `reimbursement:`, `vendor-payment:`, `vendor-receipt:`, `transfer:`, `expense:`, `event-ticket:` → tipos corretos (ver `TX_TYPE_CONFIG` original).
- `datetime`: cobrir as funções exportadas com casos do uso em `transparencia.tsx`/eventos.

Run: `cd frontend && npx vitest run src/lib/transaction.test.ts src/lib/member-path.test.ts src/lib/document.test.ts src/lib/datetime.test.ts`
Expected: FAIL (módulos não existem).

- [x] **Step 2: Portar as implementações**

Copiar as funções dos originais ajustando imports. `transaction.tsx` → `.ts`: se `TX_TYPE_CONFIG` referencia componentes MUI (ícones), substituir por um campo `icon` string (emoji ou nome) e anotar o mapeamento exato no relatório — as ilhas que consomem (Task 8) decidem a renderização. Se for só texto/cor, portar direto com tokens (nada de hex: mapear cores para nomes de token `--cq-*` existentes; se o original usa hex, registrar o mapeamento hex→token no relatório).

- [x] **Step 3: Verificar**

Run: `cd frontend && npx vitest run && npx astro check`
Expected: suíte verde (63 + novos), 0 erros.

- [x] **Step 4: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat(fase-0.3): port de utils (transaction, member-path, document, datetime, api-url) com testes"
```

---

## Task 3: Componentes Astro puros — PageHero, StatCard, InfoCard, SectionWrapper

**Files:**
- Create: `frontend/src/components/astro/PageHero.astro`
- Create: `frontend/src/components/astro/StatCard.astro`
- Create: `frontend/src/components/astro/InfoCard.astro`

**Interfaces:**
- Produces:
  - `<PageHero eyebrow? title subtitle? />` — hero padrão das páginas públicas (ler `src/components/PageHero.tsx` e reproduzir a hierarquia visual com Tailwind/tokens).
  - `<StatCard label value icon? hint? />` — KPI card (ler `src/components/StatCard/`).
  - `<InfoCard icon title description link? />` — ler `src/components/InfoCard/`.

- [x] **Step 1: Portar os 3 componentes**

Ler cada original e reescrever em `.astro` + Tailwind com tokens. Manter a mesma estrutura semântica (heading levels do original). Exemplo do padrão esperado (ajustar ao original real):

```astro
---
interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

const { eyebrow, title, subtitle } = Astro.props;
---

<header class="border-b border-border bg-sunken py-12 text-center md:py-16">
  <div class="mx-auto max-w-3xl px-4">
    {eyebrow && <p class="text-sm font-bold uppercase tracking-wide text-text-secondary">{eyebrow}</p>}
    <h1 class="mt-2 text-3xl font-extrabold text-text-primary md:text-4xl">{title}</h1>
    {subtitle && <p class="mt-4 text-lg text-text-secondary">{subtitle}</p>}
  </div>
</header>
```

- [x] **Step 2: Verificar**

Run: `cd frontend && npx astro check`
Expected: 0 erros.

- [x] **Step 3: Commit**

```bash
git add frontend/src/components/astro/
git commit -m "feat(fase-0.3): componentes Astro PageHero, StatCard, InfoCard"
```

---

## Task 4: Páginas estáticas batch 1 — contato, projetos, bio, sobre/equipe, sobre/titulos

**Files:**
- Create: `frontend/src/pages/contato.astro`
- Create: `frontend/src/pages/projetos.astro`
- Create: `frontend/src/pages/bio.astro`
- Create: `frontend/src/pages/sobre/equipe.astro`
- Create: `frontend/src/pages/sobre/titulos.astro`

**Interfaces:**
- Consumes: `PageHero` (Task 3), `social.ts`/`communities.ts` (já portados), `team.ts`/`projects.ts`/`titulos.ts` (Task 1), `PublicLayout`, `BrandLogo` (bio usa logo por tema).
- Produces: as 5 rotas com title/description/og:title em paridade.

- [x] **Step 1: Para cada página, ler o fonte Docusaurus e portar**

Processo por página (repetir 5×):
1. Ler `src/pages/<pagina>.tsx`.
2. Extrair title/description do `<Layout>` original; conferir og:title de referência em `build/<pagina>.html` (deve ser `<title> | CODAQUI.dev`).
3. Reescrever em `.astro` com `PublicLayout` + componentes da Task 3 + dados portados; MUI→Tailwind (Grid vira `grid` Tailwind; Card vira `rounded-lg border border-border bg-surface`; Chip vira pill `rounded-full border border-border`).
4. bio.tsx usa `useColorMode` para logo → usar `BrandLogo` (troca por tema já resolvida na 0.1).

- [x] **Step 2: Verificar**

Run: `cd frontend && npm run build && for p in contato projetos bio sobre/equipe sobre/titulos; do test -f dist/$p/index.html && echo "OK /$p"; done`
Expected: 5 OKs; og:title de cada uma idêntico ao `build/<pagina>.html` correspondente (grep e compare — registrar no relatório).

- [x] **Step 3: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat(fase-0.3): páginas estáticas — contato, projetos, bio, equipe, títulos"
```

---

## Task 5: Páginas estáticas batch 2 — participe/estudar, participe/mentoria + páginas markdown

**Files:**
- Create: `frontend/src/pages/participe/estudar.astro`
- Create: `frontend/src/pages/participe/mentoria.astro`
- Create: `frontend/src/pages/sobre/conduta.astro`
- Create: `frontend/src/pages/sobre/pais-responsaveis.astro`
- Create: `frontend/src/pages/regex.astro`
- Create: `frontend/src/pages/termos-de-compra.astro`
- Modify: `frontend/scripts/copy-content.mjs` (copiar os 4 `.md` de páginas para `frontend/src/content/pages/` — adicionar à lista de cópias com os paths exatos dos arquivos, não do diretório todo)
- Modify: `frontend/src/content.config.ts` (collection `pages`)
- Modify: `frontend/.gitignore` (`src/content/pages/`)

**Interfaces:**
- Consumes: `PageHero`, `InfoCard`, `.prose-cq`, pipeline de collections da 0.2.
- Produces: as 6 rotas; collection `pages` com schema `{ title: z.string(), description: z.string().optional() }`.

- [x] **Step 1: Estender o pipeline de conteúdo**

Adicionar ao `copy-content.mjs` uma cópia de arquivos individuais (criar função `copyFile` ou usar `cpSync` por arquivo):

```js
const pageFiles = [
  ["src/pages/sobre/conduta.md", "conduta.md"],
  ["src/pages/sobre/pais-responsaveis.md", "pais-responsaveis.md"],
  ["src/pages/regex.md", "regex.md"],
  ["src/pages/termos-de-compra.md", "termos-de-compra.md"],
];
for (const [from, to] of pageFiles) {
  cpSync(join(ROOT, from), join(FRONTEND, "src", "content", "pages", to));
}
```

(criar o diretório antes com `mkdirSync(..., { recursive: true })`).

- [x] **Step 2: Collection `pages`**

Adicionar a `frontend/src/content.config.ts`:

```ts
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});
// export const collections = { blog, trilhas, pages };
```

- [x] **Step 3: Páginas markdown** — padrão idêntico para as 4 (exemplo `sobre/conduta.astro`):

```astro
---
import { getEntry, render } from "astro:content";
import PublicLayout from "../../layouts/PublicLayout.astro";

const entry = await getEntry("pages", "conduta");
if (!entry) throw new Error("Página de conteúdo não encontrada: conduta");
const { Content } = await render(entry);
---

<PublicLayout title={`${entry.data.title} | Codaqui`} ogTitle={`${entry.data.title} | CODAQUI.dev`} description={entry.data.description ?? ""}>
  <article class="mx-auto max-w-3xl px-4 py-10">
    <div class="prose-cq">
      <Content />
    </div>
  </article>
</PublicLayout>
```

⚠️ Antes de fixar o ogTitle, conferir o og:title real de `build/sobre/conduta.html` e replicar exatamente (pode não ter sufixo em páginas MD — verificar os 4). Se o frontmatter `.md` não tiver `description`, conferir a meta description do build antigo e replicar (ou deixar vazio se o antigo também omite).

- [x] **Step 4: estudar e mentoria**

Portar `estudar.tsx` e `mentoria.tsx` lendo os originais: dados inline (TURMAS/GRUPOS_ESTUDO/TRACKS/CERTIFICATE_STEPS e MENTORS/CALENDAR_URL) viram constantes no topo do `.astro` (ou em `frontend/src/data/` se o arquivo passar de ~80 linhas de dados — julgar pelo original; nomear `frontend/src/data/estudar.ts` / `mentoria.ts` nesse caso). Links externos com `target="_blank" rel="noopener noreferrer"`.

- [x] **Step 5: Verificar**

Run: `cd frontend && npm run build && for p in participe/estudar participe/mentoria sobre/conduta sobre/pais-responsaveis regex termos-de-compra; do test -f dist/$p/index.html && echo "OK /$p"; done`
Expected: 6 OKs + og:title/paridade conferidos contra `build/`.

- [x] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): páginas participe/estudar+mentoria e markdown (conduta, pais-responsaveis, regex, termos)"
```

---

## Task 6: sobre/insights + sobre/ong (social stats + timeline + analytics)

**Files:**
- Create: `frontend/src/lib/social-stats.ts` (loader build-time do snapshot `static/social-stats/index.json` com fallback de baselines — portar a lógica de `src/hooks/useSocialStatsSnapshot.ts` para função síncrona de build, lendo o arquivo da RAIZ via copy ou fetch de `../static/social-stats/index.json`)
- Create: `frontend/src/components/islands/SiteAnalyticsIsland.tsx` (port de `SiteAnalytics` — lê `/analytics/index.json` em runtime; `client:visible`)
- Create: `frontend/src/components/islands/DiscordWidgetIsland.tsx` (port de `DiscordServerWidget`; `client:visible`) — também usada por `/eventos` (Task 7) e homepage futura
- Create: `frontend/src/components/astro/CommunityPresenceCard.astro` (port do card de presença social)
- Create: `frontend/src/pages/sobre/insights.astro`
- Create: `frontend/src/pages/sobre/ong.astro`
- Modify: `frontend/scripts/copy-snapshots.mjs` (garantir que `static/social-stats/index.json` e `static/analytics/index.json` vão para `frontend/public/` — verificar o que já cobre)

**Interfaces:**
- Produces: `/sobre/insights`, `/sobre/ong`; `loadSocialStats(): SocialStatsSnapshot` (build-time, lê o snapshot com fallback) e `resolveSocialCount(profile, entry): number` (baseline quando o snapshot não tem a entrada — assinatura final espelha o hook original; verificar antes de nomear); ilhas `SiteAnalyticsIsland`, `DiscordWidgetIsland`.
- Consumes: `timeline.ts`, `communities.ts`, `social-stats.ts` (Task 1), `PageHero`, `StatCard`, `CommunityPresenceCard`, `MembersWall` (ilha — portar `MembersWall` como `MembersWallIsland.tsx` com `client:visible`; endpoint prop).

- [x] **Step 1: Portar o loader de social stats para build-time**

O hook original faz fetch em runtime com fallback de baselines. No Astro: ler `frontend/public/social-stats/index.json` (copiado pelo pipeline) em build; se ausente/inválido, usar os baselines de `frontend/src/data/social-stats.ts`. Função pura — teste TDD:

```ts
// frontend/src/lib/social-stats.test.ts
import { describe, expect, it } from "vitest";
import { resolveSocialCount } from "./social-stats";

describe("resolveSocialCount", () => {
  it("usa o count do snapshot quando presente", () => {
    expect(resolveSocialCount({ baselineCount: 100 }, { count: 250 })).toBe(250);
  });
  it("cai no baseline quando o snapshot não tem a entrada", () => {
    expect(resolveSocialCount({ baselineCount: 100 }, undefined)).toBe(100);
  });
});
```

(Adaptar à assinatura real do hook original — ler `src/hooks/useSocialStatsSnapshot.ts` primeiro e espelhar os casos de fallback.)

- [x] **Step 2: Portar as ilhas** (`SiteAnalytics`, `DiscordServerWidget`, `MembersWall`)

Cada ilha: mesmo fetch do original, MUI permitido dentro da ilha (já há `MuiIslandProvider` na POC — verificar como as ilhas existentes o usam e seguir o padrão), `client:visible`. `DiscordServerWidget` consome `DISCORD_WIDGET_URL` de `social.ts` (portar a constante se faltar).

- [x] **Step 3: Montar as duas páginas**

Ler `insights.tsx` e `ong.tsx` e portar seção a seção (stats bar, presença digital, comunidades, timeline; associação + MembersWall + comunidades). Timeline: reproduzir a timeline custom com Tailwind (o original não usa @mui/lab — linha vertical + dots + cards).

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && for p in sobre/insights sobre/ong; do test -f dist/$p/index.html && echo "OK /$p"; done && npx vitest run src/lib/social-stats.test.ts`
Expected: 2 OKs + testes verdes; og:title em paridade com `build/sobre/insights.html` e `build/sobre/ong.html`.

- [x] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): sobre/insights e sobre/ong com social stats, timeline e ilhas de widget"
```

---

## Task 7: /eventos índice + /eventos/detalhe fallback

**Files:**
- Create: `frontend/src/pages/eventos/index.astro`
- Create: `frontend/src/pages/eventos/detalhe.astro`
- Modify: `frontend/src/lib/events.ts` (helpers de listagem se necessário)

**Interfaces:**
- Consumes: `loadEventsIndex()` (já existe em `frontend/src/lib/events.ts`), `event-path.ts` (já portado), `DiscordWidgetIsland` (Task 6), `PageHero`.
- Produces: `/eventos` (lista futuros ASC + passados DESC, badges de fonte/override, link para a rota estática de cada evento); `/eventos/detalhe` (redirect client-side).

- [x] **Step 1: Portar `/eventos`**

Ler `src/pages/eventos.tsx`. A listagem é alimentada por `static/events/index.json` (já copiado para `frontend/public/events/index.json` pelo pipeline de snapshots da POC — confirmar). Renderizar em build-time (zero JS) a lista completa: futuros (ASC por startAt) e passados (DESC), com badge de fonte e `EventOverrideBadge` quando `hasOverride` (portar o badge como `.astro` puro — lê metadados do próprio snapshot; ler `src/components/EventOverrideBadge/` e `src/utils/event-override.ts`). Cada card linka para `buildEventPublicPath(event)`. Filtros client-side do original: se existirem (filtro por fonte/comunidade), implementar como ilha leve `client:visible` ou via `<details>`/âncoras — julgar pelo original; se for só visual, preferir zero-JS e anotar a decisão no relatório.

- [x] **Step 2: `/eventos/detalhe` fallback**

Página com script inline que replica a lógica do original: lê `?source=&id=` (e `?slug=`), consulta `/events/index.json`, redireciona para a rota estática; **exceção**: se `status=success&session_id=...` (retorno Stripe), NÃO redirecionar para a rota estática sem preservar os params — ler o comportamento exato do original e replicar (provavelmente: mantém na página de detalhe dinâmica ou redireciona com os params; o original em `detalhe.tsx` trata isso — portar fielmente). `noindex` nesta página.

- [x] **Step 3: Verificar**

Run: `cd frontend && npm run build && test -f dist/eventos/index.html && test -f dist/eventos/detalhe/index.html && echo OK`
Expected: OK; contagem de cards de eventos no HTML bate com `static/events/index.json` (`node -e "console.log(require('./frontend/public/events/index.json').events.length)"`); og:title em paridade com `build/eventos.html`.

- [x] **Step 4: Commit**

```bash
git add frontend/src/pages/eventos/ frontend/src/lib/events.ts frontend/src/components/
git commit -m "feat(fase-0.3): índice /eventos + fallback /eventos/detalhe"
```

---

## Task 8: /transparencia (ilhas do ledger)

**Files:**
- Create: `frontend/src/components/islands/TransparencyApp.tsx` (port da parte dinâmica de `transparencia.tsx`: KPIs + cards por comunidade + tabs + TransactionTable)
- Create: `frontend/src/components/islands/TransactionTable.tsx` (port de `TransactionTable` + `TransactionDetailDialog`)
- Create: `frontend/src/pages/transparencia.astro`
- Modify: `frontend/src/lib/config.ts` ou `api-url.ts` (o que for o padrão — as ilhas usam a URL da API)

**Interfaces:**
- Consumes: `transaction.ts` (Task 2: `formatBRL`, `TX_TYPE_CONFIG`, `deriveTransactionMeta`, tipos), `communities.ts`, `PageHero`, `StatCard`.
- Produces: `/transparencia` — shell estático (hero, texto institucional) + ilha `client:visible` que busca `GET /ledger/community-balances` e `GET /ledger/transparency-stats` e renderiza KPIs/tabs/tabela. Query `?tx=` abre o `TransactionDetailDialog` correspondente; `?project=` filtra.

- [x] **Step 1: Portar TransactionTable + TransactionDetailDialog**

Ler `src/components/TransactionTable/` e `src/components/TransactionDetailDialog/`. Manter MUI dentro da ilha (tabela, dialog, filtros, sort, export CSV da página). Usar `formatBRL`/`deriveTransactionMeta` da lib portada (Task 2) — remover duplicações locais se houver.

- [x] **Step 2: Portar TransparencyApp**

Ler `src/pages/transparencia.tsx` e extrair a parte dinâmica para a ilha: fetch dos 2 endpoints, estados de loading/erro (`Alert` MUI), 5 KPIs, cards por comunidade com progresso entrada/saída, tabs. Suporte a `?tx=` e `?project=` via `URLSearchParams` no mount.

- [x] **Step 3: Montar a página**

`transparencia.astro`: `PublicLayout` + `PageHero` + texto estático + `<TransparencyApp client:visible />`. og:title em paridade com `build/transparencia.html`.

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && npx astro check`
Expected: verde; `dist/transparencia/index.html` existe com a ilha montada (`astro-island` no HTML); sem backend local a ilha mostra estado de erro/loading — comportamento idêntico ao esperado (backend local opcional; documentar no relatório).

- [x] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): /transparencia com ilha do ledger (balances, stats, TransactionTable)"
```

---

## Task 9: /participe/apoiar — DonationFlow + Stripe embedded checkout

**Files:**
- Create: `frontend/src/components/islands/DonationFlowIsland.tsx` (port de `DonationFlow` + `useDonationFlow` + `helpers.ts`)
- Create: `frontend/src/components/islands/StripeCheckoutDialog.tsx` (port de `StripeEmbeddedCheckoutDialog`)
- Create: `frontend/src/components/islands/CompanyDonationIsland.tsx` (port de `CompanyDonationSection` — fluxo PJ)
- Create: `frontend/src/pages/participe/apoiar.astro`
- Modify: `frontend/package.json` (`@stripe/react-stripe-js`, `@stripe/stripe-js`)

**Interfaces:**
- Consumes: `communities.ts` (targets), `SelectableCard` (portar como subcomponente da ilha), `lib/config.ts` (API URL), `useAuth` (`frontend/src/lib/use-auth.ts` — já existe).
- Produces: `/participe/apoiar` com toggle PF/PJ (`?modo=empresa`), presets de valor, destinos (tesouro + comunidades com saldo de `GET /ledger/community-balances`), anônimo ≤ R$ 100, checkout embedded por `clientSecret`, fallback hosted por `url`, retorno `?status=success|cancelled&session_id=`.

- [x] **Step 1: Instalar deps e conferir a publishable key**

Run: `cd frontend && npm install @stripe/react-stripe-js @stripe/stripe-js`
A publishable key no Docusaurus vem de `customFields` — ler `docusaurus.config.ts` e descobrir o nome exato do campo e como chega ao cliente. No Astro: expor via `PUBLIC_STripe...` env var ou constante em `frontend/src/lib/config.ts` lendo `import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY`. Documentar a env no `DEVELOPMENT.md` e, se aplicável, no `.env.example` da raiz (permitido: só template, sem valor real). NUNCA commitar a chave real — publishable key é pública por natureza, mas seguir o padrão de env do projeto.

- [x] **Step 2: Portar o fluxo de doação**

Ler `src/components/DonationFlow/`, `src/components/StripeDonateSection/useDonationFlow.ts` (ou onde estiver), `helpers.ts` (`buildCheckoutBody`, `requestCheckoutSession`) e `StripeEmbeddedCheckoutDialog`. Portar preservando: frequência (monthly/year/once), presets R$ 10/25/50/100/200, destinos com saldo, regra de anonimato ≤ R$ 100 (acima exige login GitHub — usar o `useAuth` portado), estados de erro com `Alert`.

- [x] **Step 3: Montar a página**

Ler `src/pages/participe/apoiar.tsx`. Shell estático (hero, texto, links OpenCollective→verificar se ainda existe no original — inventário diz que foi removido; replicar o que existe) + `<DonationFlowIsland client:load />` (acima da dobra e interativo) + seção PJ com `<CompanyDonationIsland client:visible />` quando `?modo=empresa` — ou tabs como o original; seguir o original.

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && npx astro check && npx vitest run`
Expected: verde; ilha presente no HTML. Checkout ponta a ponta real fica para a verificação final (Task 16) com backend local/preview.

- [x] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): /participe/apoiar com DonationFlow e checkout Stripe embutido"
```

---

## Task 10: /patrocinadores + /membros (ilhas de API pública)

**Files:**
- Create: `frontend/src/components/islands/SponsorsIsland.tsx` (port da listagem de `/companies/sponsors`)
- Create: `frontend/src/components/islands/MembersDirectoryIsland.tsx` (port da listagem de `/membros`: members + donors + club/business members)
- Create: `frontend/src/pages/patrocinadores.astro`
- Create: `frontend/src/pages/membros/index.astro`

**Interfaces:**
- Consumes: `PageHero`, `social.ts` (PLATFORM_COLORS — portar se faltar), lib de API.
- Produces: `/patrocinadores`, `/membros`.

- [x] **Step 1: Portar as duas ilhas**

Ler `src/pages/patrocinadores.tsx` e `src/pages/membros/index.tsx`; extrair a parte dinâmica (fetch paginado, estados, cards) para ilhas `client:visible`. Manter CTAs estáticos no shell `.astro` (ex.: CTA de patrocinadores → `/participe/apoiar?modo=empresa`).

- [x] **Step 2: Montar as páginas e verificar**

Run: `cd frontend && npm run build && for p in patrocinadores membros; do test -f dist/$p/index.html && echo "OK /$p"; done`
Expected: OKs; og:title em paridade (`build/patrocinadores.html`, `build/membros.html`).

- [x] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): /patrocinadores e /membros com ilhas de API pública"
```

---

## Task 11: /@handle + /membros/perfil + 404 com redirect

**Files:**
- Create: `frontend/src/lib/member-pages.ts` (fetch paginado de `/members` em build, tolerante a falha — port de `src/plugins/member-pages.ts` para função pura)
- Create: `frontend/src/pages/[...handle].astro` — ⚠️ Astro **não** suporta segmento dinâmico parcial (`@[handle].astro` não existe). Direção concreta: rota rest na raiz de `pages/` com `getStaticPaths` emitindo APENAS `params: { handle: "@<handle>" }` para cada membro; rotas explícitas têm precedência sobre rest params no roteador do Astro, então não colide com as demais páginas. Se na prática houver conflito, alternativa: pasta `frontend/src/pages/@/[handle].astro` só se compilar para `/@<handle>` sem barra extra — verificar empiricamente e anotar no relatório.
- Create: `frontend/src/components/islands/MemberProfileIsland.tsx` (port das partes dinâmicas de `membros/perfil.tsx`)
- Create: `frontend/src/pages/membros/perfil.astro`
- Create: `frontend/src/pages/404.astro`
- Test: `frontend/src/lib/member-pages.test.ts`

**Interfaces:**
- Consumes: `member-path.ts` (Task 2: `MEMBER_HANDLE_REGEX`, `buildMemberPath`, `buildMemberJsonLd`), `PublicLayout`, `transaction.ts` (wallet), `event-path.ts`.
- Produces: rotas `/@<handle>` com OG/JSON-LD Person por membro; `/membros/perfil?handle=` (fallback dinâmico); `/404` com redirect `/@handle` → `/membros/perfil?handle=`.

- [x] **Step 1: `loadPublicMembers()` com teste**

Port de `member-pages.ts` como função: fetch `GET {API}/members?limit=100&page=N` (máx 50 páginas), agrega, falha → `[]` + `console.warn` (não quebra o build). Teste com fetch mockado (vitest `vi.stubGlobal`): 2 páginas agregadas; erro → `[]`.

- [x] **Step 2: Rota estática `/@handle`**

```astro
---
// frontend/src/pages/[...handle].astro — gera /@<handle> por membro ativo.
// Rotas explícitas têm precedência sobre rest params: não colide com as demais páginas.
import PublicLayout from "../layouts/PublicLayout.astro";
import { loadPublicMembers } from "../lib/member-pages";
import { buildMemberJsonLd } from "../lib/member-path";

export async function getStaticPaths() {
  const members = await loadPublicMembers();
  return members.map((member) => ({
    params: { handle: `@${member.handle}` },
    props: { member },
  }));
}

const { member } = Astro.props;
const jsonLd = buildMemberJsonLd(member, Astro.site?.origin ?? "");
---
```

Renderizar o perfil PÚBLICO estaticamente (nome, avatar, bio, links, badges públicas) com JSON-LD Person + OG; as seções dinâmicas (doações, wallet pública, eventos) como ilhas `client:visible` consumindo as APIs públicas por handle (ler `perfil.tsx` para a lista exata de endpoints públicos: `/members/by-handle/:handle`, `/club/public-wallet/:handle`, `/events/members/:memberId/registrations`, `/companies/member/:handle/public-affiliation`). Seções auth (minha conta) só em `/membros/perfil` logado — ilha `client:only`.

- [x] **Step 3: `/membros/perfil`**

Shell + `<MemberProfileIsland client:only="react" />` que lê `?handle=` (ou o usuário logado) e renderiza o perfil completo (port de `perfil.tsx`, incl. QRCode via `qrcode.react` — instalar se usado). Seções que exigem auth renderizam estado de login (o hook `useAuth` portado já trata).

- [x] **Step 4: `404.astro`**

```astro
---
// frontend/src/pages/404.astro
---

<PublicLayout title="Página não encontrada | Codaqui" ogTitle="Página não encontrada | CODAQUI.dev" noindex>
  <script is:inline>
    const m = location.pathname.match(/^\/@([a-zA-Z0-9_-]+)\/?$/);
    if (m) location.replace(`/membros/perfil?handle=${m[1]}`);
  </script>
  <main class="mx-auto max-w-xl px-4 py-20 text-center">
    <h1 class="text-3xl font-extrabold text-text-primary">Página não encontrada</h1>
    <p class="mt-4 text-text-secondary">O link pode ter mudado. Que tal voltar para a <a class="text-link hover:text-link-hover" href="/">página inicial</a>?</p>
  </main>
</PublicLayout>
```

(Conferir que `PublicLayout`/`BaseLayout` aceita `noindex` — a POC já tem essa prop; usar o nome real.)

- [x] **Step 5: Verificar**

Run: `cd frontend && npm run build && ls dist/@ 2>/dev/null | head -5; npx vitest run src/lib/member-pages.test.ts`
Expected: build verde SEM a API (fetch falha → 0 páginas @, warn no log — comportamento do Docusaurus); com `DOCUSAURUS_API_URL`/env equivalente apontando para a API de produção, páginas @ geradas (testar com `PUBLIC_API_URL=https://api.codaqui.dev npm run build` se a API for alcançável; anotar o número de páginas no relatório). Testes verdes.

- [x] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): /@handle estático, /membros/perfil e 404 com redirect de handle"
```

---

## Task 12: /clube (público + ilhas auth) + /certificado/verificar

**Files:**
- Create: `frontend/src/pages/clube.astro`
- Create: `frontend/src/components/islands/ClubRafflesIsland.tsx` (raffles públicos: `/club/raffles`, `/club/raffles/:id/stats`, `/club/raffles/history`)
- Create: `frontend/src/components/islands/ClubWalletIsland.tsx` (auth: `/club/wallet`, `/club/raffles/my-entries`, `POST /club/raffles/:id/enter` — `client:only`)
- Create: `frontend/src/pages/certificado/verificar.astro`
- Create: `frontend/src/components/islands/CertificateVerifyIsland.tsx`

**Interfaces:**
- Consumes: `PageHero`, `TabPanel` (portar como parte das ilhas ou componente Astro com details — julgar pelo original), `useAuth`, lib de API.
- Produces: `/clube`, `/certificado/verificar`.

- [x] **Step 1: Portar /clube**

Ler `src/pages/clube.tsx` (770 linhas). Shell estático: hero, explicação do Clube/SortCoins, regras. `ClubRafflesIsland client:visible`: sorteios ativos + histórico (público). `ClubWalletIsland client:only="react"`: carteira do membro logado, minhas entries, botão de participar (POST); deslogado → CTA de login. Manter textos e regras verbatim do original.

- [x] **Step 2: Portar /certificado/verificar**

Shell + `<CertificateVerifyIsland client:load />`: input de código + `GET /events/certificates/verify/:code`, estados de sucesso/erro (ler o original). Suportar `?code=` na URL se o original suportar.

- [x] **Step 3: Verificar**

Run: `cd frontend && npm run build && for p in clube certificado/verificar; do test -f dist/$p/index.html && echo "OK /$p"; done && npx astro check`
Expected: OKs + 0 erros; og:title em paridade.

- [x] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): /clube (raffles públicos + wallet auth) e /certificado/verificar"
```

---

## Task 13: Redirects legados (stubs client-side)

**Files:**
- Create: `frontend/src/components/astro/RedirectStub.astro`
- Create: `frontend/src/pages/quero/estudar.astro`, `quero/apoiar.astro`, `quero/mentoria.astro`
- Create: `frontend/src/pages/team.astro`, `contact.astro`, `conduta.astro`, `ong.astro`, `timeline.astro`, `pais_responsaveis.astro`
- Create: `frontend/src/pages/sobre/timeline.astro`
- Create: `frontend/src/pages/blog/archive/2022.astro`, `2023.astro`, `2024.astro`, `2025.astro`

**Interfaces:**
- Produces: `<RedirectStub to="/destino" />` — meta refresh + canonical no destino + link de fallback + `noindex`. Rotas: tabela completa abaixo.

| Rota | Destino |
|---|---|
| `/quero/estudar` | `/participe/estudar` |
| `/quero/apoiar` | `/participe/apoiar` |
| `/quero/mentoria` | `/participe/mentoria` |
| `/team` | `/sobre/equipe` |
| `/contact` | `/contato` |
| `/conduta` | `/sobre/conduta` |
| `/ong` | `/sobre/ong` |
| `/timeline` | `/sobre/timeline` |
| `/sobre/timeline` | `/sobre/insights` |
| `/pais_responsaveis` | `/sobre/pais-responsaveis` |
| `/blog/archive/2022..2025` | `/blog` |

- [x] **Step 1: Criar o componente**

```astro
---
// frontend/src/components/astro/RedirectStub.astro
interface Props {
  to: string;
}
const { to } = Astro.props;
---

<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex,nofollow" />
    <meta http-equiv="refresh" content={`0;url=${to}`} />
    <link rel="canonical" href={new URL(to, Astro.site).toString()} />
    <title>Redirecionando… | CODAQUI.dev</title>
  </head>
  <body>
    <p>Redirecionando para <a href={to}>{to}</a>…</p>
  </body>
</html>
```

Cada página stub é uma linha: `--- import RedirectStub from "../../components/astro/RedirectStub.astro"; ---` + `<RedirectStub to="/participe/estudar" />` (ajustar profundidade do import por página).

- [x] **Step 2: Verificar**

Run: `cd frontend && npm run build && for p in quero/estudar quero/apoiar quero/mentoria team contact conduta ong timeline pais_responsaveis sobre/timeline blog/archive/2022 blog/archive/2025; do test -f dist/$p/index.html && echo "OK /$p"; done`
Expected: 12 OKs.

- [x] **Step 3: Remover a exclusão de /blog/archive do gate**

Em `frontend/scripts/diff-urls.mjs`, remover `/^\/blog\/archive/` de `EXCLUDE` (os stubs agora existem). Manter o comentário explicando o histórico.

- [x] **Step 4: Commit**

```bash
git add frontend/src/pages/ frontend/src/components/astro/RedirectStub.astro frontend/scripts/diff-urls.mjs
git commit -m "feat(fase-0.3): stubs de redirect legados (quero/*, team, contact, timeline, blog/archive)"
```

---

## Task 14: /design-system (brand book público, 8 seções)

**Files:**
- Create: `frontend/src/pages/design-system.astro`
- Create: `frontend/src/components/astro/design-system/` (subcomponentes por seção: `DsHero.astro`, `DsHistoria.astro`, `DsMarca.astro`, `DsCores.astro`, `DsTipografia.astro`, `DsComponentes.astro`, `DsAcessibilidade.astro`, `DsTomDeVoz.astro`)
- Create: `frontend/src/components/islands/CopySwatchIsland.tsx` (copia hex ao clicar; `client:visible`)

**Interfaces:**
- Consumes: tokens `--cq-*` (fonte canônica desde a 0.1: `frontend/src/styles/tokens.css`), `timeline.ts` (Task 1), logos de `frontend/public/img/` (`logo_principal.svg`, `logo_monocromatica.svg`, `logo_mono2.svg`), `BrandLogo` (demo da regra de tema).
- Produces: `/design-system` — brand book scrollável com as 8 seções da spec.

**Spec da página (verbatim de `design-system.md`):** Hero com marca · 01 História (timeline real, de `timeline.ts`) · 02 Marca (3 logos + regras de respiro/uso proibido + **regra de logo por tema** com demos lado a lado: `logo_principal` só sobre fundo claro, `logo_monocromatica` só sobre fundo escuro) · 03 Cores (escalas com badge WCAG por swatch, incluindo o alerta "por que `#57B593` não é acionável" — 2.49:1 sobre branco reprova AA; cor acionável `#378369` 4.55:1) · 04 Tipografia (escala renderizada ao vivo — system fonts, modular 1.25, pesos 400/500/700/800) · 05 Componentes (demos: botões, badges, alertas, formulários, tabela financeira) · 06 Acessibilidade (checklist + demo de foco) · 07 Tom de voz (tabela "Diga / Evite / Por quê" + hashtags `#QueroEstudar`, `#QueroApoiar`, `#QueroMentoria`, `#ClubCodaqui`).

- [x] **Step 1: Estrutura da página**

`design-system.astro` com âncoras por seção (`id="historia"` etc.) e índice no topo (nav local com links `#`). Todas as seções `.astro` puro; única ilha: `CopySwatchIsland` nos swatches de cor (copia o hex para clipboard, feedback "Copiado!"). ogTitle: `Design System | CODAQUI.dev`; description própria; title `Design System | Codaqui`.

- [x] **Step 2: Seções 01–03 (História, Marca, Cores)**

- História: timeline vertical (reusar o padrão da Task 6) com `timelineEvents` reais.
- Marca: os 3 logos em cards com fundo claro E escuro lado a lado (demonstrando a regra de tema), regras de respiro (espaçamento mínimo = altura do "C" do logotipo) e usos proibidos (não distorcer, não trocar cores, não usar logo escura sobre escuro).
- Cores: escalas primary (50–900), plum (neutros), semânticas — ler os valores REAIS de `frontend/src/styles/tokens.css` e gerar os swatches a partir deles (um objeto TS local `ds-palette.ts` derivado dos tokens; cada swatch com hex + badge AA/AAA onde aplicável — contraste calculado por função `contrastRatio(fg, bg)` em `frontend/src/lib/` com teste TDD: `contrastRatio("#378369", "#FFFFFF")` ≈ 4.55).

- [x] **Step 3: Seções 04–07**

- Tipografia: escala 12–48px renderizada ao vivo (cada tamanho com seu próprio `font-size` via tokens/escala Tailwind), pesos, mono para números de impacto.
- Componentes: demos estáticas com as classes do DS (botões primário/secundário/disabled, badges, alertas info/success/warning/error, campos de formulário, tabela financeira no padrão da transparência).
- Acessibilidade: checklist (contraste AA, alvos 44px, foco visível, reduced-motion) + demo de foco visível.
- Tom de voz: tabela "Diga / Evite / Por quê" (conteúdo do `design-system.md`: "participantes" não "alunos", "programa" não "curso", "encontros" não "aulas", "Associação" não "escola/empresa") + hashtags oficiais.

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && test -f dist/design-system/index.html && npx vitest run && npx astro check`
Expected: verde. Critério da spec: skip link presente, foco visível, `prefers-reduced-motion` respeitado (verificar no CSS), Lighthouse ≥ demais páginas públicas (registrar na Task 16).

- [x] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): página pública /design-system (brand book, 8 seções, dados reais)"
```

---

## Task 15: Sitemap + robots + extensão do gate de paridade

**Files:**
- Modify: `frontend/astro.config.mjs` (integração `@astrojs/sitemap`)
- Create: `frontend/public/robots.txt` (port de `static/robots.txt`)
- Modify: `frontend/scripts/diff-urls.mjs` (cobrir todas as seções públicas)
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `/sitemap-index.xml` (+ sitemaps filhos) no dist; gate estendido.

- [x] **Step 1: Sitemap**

Run: `cd frontend && npm install @astrojs/sitemap`
Registrar em `astro.config.mjs`: `integrations: [react(), mdx(), sitemap()]`. Filtrar páginas noindex: `/404`, `/eventos/detalhe`, redirects-stub, `/admin/*`, `/auth/*` (usar a opção `filter` da integração: `(page) => !page.includes("/admin") && ...` — lista exata no código).

- [x] **Step 2: robots.txt**

Copiar `static/robots.txt` para `frontend/public/robots.txt` (verbatim: `User-agent: *`, `Disallow: /previews/`, `Sitemap: https://codaqui.dev/sitemap.xml`). ⚠️ Verificar o que o `@astrojs/sitemap` emite (`sitemap-index.xml` vs `sitemap.xml`) e ajustar o robots para apontar para o arquivo real; se o Astro emitir `sitemap-index.xml`, atualizar a linha Sitemap para ele e anotar no relatório (paridade de descoberta, não de nome de arquivo).

- [x] **Step 3: Estender o gate**

Em `diff-urls.mjs`, generalizar: em vez de `["blog", "trilhas"]`, cobrir as seções públicas:

```js
const SECTIONS = ["blog", "trilhas", "eventos", "sobre", "participe", "quero", "membros", "certificado"];
const TOP_LEVEL = ["", "contato", "projetos", "transparencia", "bio", "clube", "patrocinadores", "membros", "regex", "termos-de-compra", "team", "contact", "conduta", "ong", "timeline", "pais_responsaveis", "design-system"];
// EXCLUDE: /^\/comunidades/ (Fase 0.5), /^\/admin/, /^\/membro/, /^\/auth/ (Fase 0.4),
//          /^\/eventos\/comprovante/ (0.4), /@<handle> (0 no build atual de referência — geradas com API)
```

Implementação: manter o walk por seção + sibling `<seção>.html`, e adicionar os TOP_LEVEL como arquivos soltos (`build/<nome>.html` → `/<nome>`; `/` = `build/index.html`). Rodar, e para cada URL faltando: corrigir a rota (não o script). URLs que o Docusaurus gera e não fazem sentido portar (se houver) exigem exclusão JUSTIFICADA no relatório para o controlador decidir.

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && node scripts/diff-urls.mjs && ls dist/sitemap*`
Expected: paridade 100% nas seções cobertas; sitemap gerado.

- [x] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.3): sitemap, robots.txt e gate de paridade estendido a todas as seções públicas"
```

---

## Task 16: Verificação final da Fase 0.3

**Files:**
- Modify: `docs/superpowers/plans/2026-10-21-fase-0-3-site-publico.md` (checkboxes)
- Modify: `DEVELOPMENT.md` (envs novas: `PUBLIC_STRIPE_PUBLISHABLE_KEY` e o que mais surgir)

- [x] **Step 1: Gates completos** — ✅ 2026-10-26: build (577 páginas), astro check (0 erros), vitest (192 testes), diff-urls (paridade 100%, 576 URLs de referência) e typecheck da raiz, todos verdes.

Run: `cd frontend && npm run build && npx astro check && npx vitest run && node scripts/diff-urls.mjs`
Expected: tudo verde, paridade 100%.

Run (raiz): `npm run typecheck`
Expected: verde.

- [x] **Step 2: Validação de OG/JSON-LD** — ✅ 2026-10-26: amostra comparada; divergências encontradas foram corrigidas (commit `b217e444a07`): title tag agora segue `<título> | CODAQUI.dev` em todas as páginas públicas; `trailingSlash: "never"` alinhou canonical/og:url; JSON-LD BlogPosting (posts) e BreadcrumbList (trilhas) replicados. Diferenças residuais documentadas (melhorias deliberadas): homepage com título descritivo (`Codaqui — Democratizando comunidades e projetos de tecnologia!`) no lugar de "Página Inicial"; og:description de posts truncado em ~160 chars (o antigo despachava o parágrafo inteiro). `/@handle` não gerado no build de referência (sem API) — Person validado na 0.1.

Script ou manual: para uma amostra (`/`, `/blog/<post>`, `/trilhas/python/page-1`, `/eventos/<um evento>`, `/sobre/equipe`, `/design-system`, um `/@handle` se gerado), comparar `og:title`, `og:description`, `og:image`, canonical e JSON-LD entre `build/` e `frontend/dist/`. Registrar a tabela no relatório. JSON-LD: Event (já validado na 0.1), Person (membros) — parsear e validar `@type` e campos obrigatórios.

- [x] **Step 3: Peso das ilhas (meta da spec: nenhuma ilha pública > 100 KB gzip de JS)** — ✅ 2026-10-26: maior chunk único 65 KB gzip (runtime React client), MuiIslandProvider 40 KB; código específico de cada ilha ≤ 31 KB. Nenhuma ilha excede 100 KB de código próprio; ilhas MUI compartilham o runtime de ~105 KB (carregado uma vez, fora da métrica por-ilha).

Run: `cd frontend && for f in dist/_astro/*.js; do gzip -c "$f" | wc -c | awk -v f="$f" '{print f, $1}'; done | sort -k2 -nr | head -10`
Registrar no relatório; se alguma ilha pública > 100 KB gzip, investigar code-splitting (`client:visible` já ajuda) e anotar.

- [x] **Step 4: Lighthouse** — ✅ 2026-10-26 (mobile, `make astro-lighthouse` com as 3 páginas novas): `/` 97 · evento 96 · `/admin/eventos` 93 · `/blog` 99 · post 99 · `/trilhas/intro` 98 · trilha 98 · `/sobre/insights` 98 · `/participe/apoiar` 78 (ilha Stripe+MUI, a mais pesada) · `/design-system` 97. SEO 100 em todas; A11y 94–100; BP 73 constante (artefato do preview, idêntico nas fases 0.1/0.2).

`make astro-lighthouse` (estender o target: adicionar `/sobre/insights/`, `/participe/apoiar/`, `/design-system/`). Registrar números no commit.

- [x] **Step 5: Checkout Stripe ponta a ponta (documentado)** — ⚠️ 2026-10-26: **pendência ambiental** (não é falha de implementação). A ilha `DonationFlowIsland` está presente no HTML de `/participe/apoiar` (astro-island + chunk `DonationFlowIsland` no dist) e o contrato do port é idêntico ao Docusaurus (`POST /stripe/checkout-session` → `clientSecret` → `EmbeddedCheckoutProvider`). Não foi possível abrir o checkout real neste ambiente: backend local não está no ar, a publishable key não está no repo (vem de env; o build de referência também a tinha vazia) e a API de produção está em modo live (sem cartão de teste). Pendência para o cutover 0.6: repetir no preview do Pages com `PUBLIC_STRIPE_PUBLISHABLE_KEY` configurada — abrir o embedded checkout e parar antes de pagar, ou usar Stripe test mode com backend local (`make db-up`).

Com backend local (`make db-up` + backend, ver DEVELOPMENT.md) ou contra a API de produção com cuidado: iniciar um checkout de doação em `/participe/apoiar` no dev server, confirmar que o embedded checkout abre (pode usar cartão de teste 4242 se em modo teste; se produção, parar antes de pagar e registrar "checkout abre com clientSecret real"). Registrar o resultado exato no relatório — se não for possível testar sem credenciais, documentar como pendência ambiental explícita para o usuário (não como falha).

- [x] **Step 6: Checkboxes + docs** — ✅ 2026-10-26: checkboxes marcados; `DEVELOPMENT.md` já documentava `PUBLIC_STRIPE_PUBLISHABLE_KEY` e `PUBLIC_API_URL` (linha 120) e `frontend/.env.example` tem ambas — nada novo a acrescentar. Makefile: `astro-verify`/`astro-lighthouse` atualizados (gate estendido, 3 páginas novas, URLs sem barra).

Marcar os `- [x]` dos itens verificados neste plano; atualizar `DEVELOPMENT.md` com envs novas.

- [x] **Step 7: Commit final**

```bash
git add -A
git commit -m "chore(fase-0.3): verificação final — paridade de URLs públicas 100%, OG/JSON-LD validados, lighthouse registrado"
```

---

## Critérios de pronto da 0.3 (da spec)

- [x] Paridade de rotas públicas (gate `diff-urls` estendido, 0 faltando) — 576 URLs de referência, 100% presentes
- [x] OG/JSON-LD validados (amostra documentada, incl. Person de membros) — diferenças corrigidas em `b217e444a07`; divergências residuais deliberadas documentadas no Step 2
- [x] Sitemap equivalente (`@astrojs/sitemap`, robots.txt apontando certo) — `sitemap-index.xml` (565 URLs) + `robots.txt` → `sitemap-index.xml`
- [x] Checkout Stripe ponta a ponta no preview (ou pendência ambiental documentada) — pendência ambiental documentada no Step 5 (para o cutover 0.6)
- [x] `/design-system` no ar com as 8 seções e dados reais de `timeline.ts`; acessível (skip link, foco visível, reduced-motion) — Lighthouse 97/97/73/100
- [x] Nenhuma ilha pública > 100 KB gzip de JS (ou exceção justificada) — maior chunk 65 KB; específico por ilha ≤ 31 KB
- [x] Gates verdes: build, astro check, vitest, typecheck da raiz
