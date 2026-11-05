<!-- AGENT-INDEX
purpose: Master guide for AI agents and contributors working on this monorepo (site Astro + backend NestJS + tenants Cloudflare Pages).
audience: AI agents, maintainers
read-first: true
sections:
  - Documentação do Projeto (docs/)
  - Tech Stack (site Astro + multi-tenant Pages + backend NestJS)
  - Commands (gates por build, frontend, backend, scripts de sync)
  - Directory Structure
  - Critical Architecture Decisions (design tokens, build matrix, proxy same-origin, conteúdo canônico, eventos, ledgers financeira e de horas, badges, blog SEO)
  - Padrões de UI/Listagem pós-Fase 0 (paginação padronizada, admonitions, doc da API no site, header/menus, analytics com fallback, dados de comunidade enriquecidos)
  - Common Anti-Patterns
  - Git Workflow & Deployment (Cloudflare Pages, branch deployments)
  - PR Checklist
  - File Naming Conventions
  - About Codaqui
  - Regular Maintenance
  - Multi-tenant communities (link)
  - Insights & Social Stats (link)
related-docs:
  - DEVELOPMENT.md — setup, env vars, migrations, deploy, runbook multi-tenant/secrets
  - README.md — repo overview
  - docs/README.md — índice central da documentação técnica
  - docs/adrs/001-event-platform.md — plataforma de eventos
  - docs/adrs/002-club-sortcoins.md — Clube Codaqui SortCoins
  - docs/adrs/003-club-business-pj.md — Clube Codaqui Business (PJ)
  - docs/adrs/004-multisite-communities.md — multi-tenant frontend
  - docs/adrs/006-directorates-designations.md — diretorias, designations e roles derivadas
  - docs/adrs/007-community-registry.md — registro, seed, snapshot, selo e doações de comunidades
  - docs/adrs/013-hour-ledger.md — horas, ownership, guests, declarações e badges da Fase 2
  - docs/adrs/014-assemblies.md — assembleias, Discussion manual, snapshot, Giscus e cartório da Fase 3
  - docs/modules/events/CODE_MANUAL.md — manual prático de eventos, horas, ownership e guests
  - docs/modules/events/ROLES.md — papéis manuais, derivados e staff de eventos
  - docs/modules/community/COMMUNITY_SITES.md — registro e conteúdo whitelabel das comunidades
  - docs/modules/insights/SOCIAL_STATS.md — estatísticas e presença digital
agent-protocol:
  - Always read this AGENT-INDEX block FIRST in any .md file before scanning content. It tells you what's inside and where else to look — saves tokens.
  - Each .md in this repo (and in `backend/`) has its own AGENT-INDEX header. Trust it as the doc's TLDR.
-->

# AGENTS.md — Codaqui Monorepo

> Instructions for AI agents, contributors, and maintainers.

## 📑 Document index protocol (read first)

Every `.md` in this repo (and in `backend/`) starts with an `<!-- AGENT-INDEX -->` HTML comment block. **Always read it before searching the body of the file** — it's a TLDR with:

- `purpose`, `audience`, `status` (when applicable)
- `sections` — high-level outline so you can jump to the right part
- `related-docs` — cross-references to avoid duplication
- `agent-protocol` — explicit hints for AI agents

Use this protocol to save tokens: read the header, then `view_range` only the section you need. Do **not** dump the full file unless the header tells you everything is essential.

When creating new `.md` files in this repo, **always include an `<!-- AGENT-INDEX -->` header at the top** following the same shape (see `AGENTS.md`, `DEVELOPMENT.md`, `README.md` as templates).

---

## 📚 Documentação do Projeto

A pasta `docs/` centraliza a documentação técnica. Sempre consulte [`docs/README.md`](docs/README.md) primeiro; ela organiza o conteúdo em três categorias:

| Categoria | Onde | Conteúdo |
|-----------|------|----------|
| **ADRs** | `docs/adrs/` | Decisões arquiteturais já implementadas |
| **Módulos** | `docs/modules/` | Documentação viva dos módulos em produção |
| **Planos** | `docs/plans/` | RFCs, melhorias em andamento e planos futuros |

Decisões arquiteturais principais:

- [Plataforma de Gestão de Eventos](docs/adrs/001-event-platform.md)
- [Clube Codaqui (SortCoins)](docs/adrs/002-club-sortcoins.md)
- [Clube Codaqui Business (PJ)](docs/adrs/003-club-business-pj.md)
- [Multi-tenant Frontend para Comunidades](docs/adrs/004-multisite-communities.md)
- [Ledger de horas, ownership, guests e perfil público](docs/adrs/013-hour-ledger.md)
- [Assembleias híbridas com Discussion manual e registro fino](docs/adrs/014-assemblies.md)

Manuais de módulos:

- [Manual do Código — Eventos](docs/modules/events/CODE_MANUAL.md)
- [Mapa de Papéis — Eventos](docs/modules/events/ROLES.md)

Planos futuros:

- [Multi-tenant — Fases Pendentes](docs/plans/multisite/README.md)
- [Real Network / Matchmaking](docs/plans/real-network/README.md)
- [UI/UX de Eventos](docs/plans/event-uiux-improvements/README.md)
- [Plano de Atualização de Dependências](docs/plans/update/README.md)

> Mantenha esses arquivos atualizados quando alterar roles, fluxos de eventos, adicionar fontes ou corrigir bugs recorrentes.

---

## Tech Stack

### Site (Astro 7 — Cloudflare Pages)

| Layer | Technology |
|-------|-----------|
| **Framework** | Astro 7 (`astro` ^7.4, static output, `@astrojs/mdx`, `@astrojs/rss`, `@astrojs/sitemap`) |
| **Multi-tenant** | Build matrix por tenant — `TENANT=<slug>` troca o `srcDir` em build-time (`frontend/astro.config.mjs` + `frontend/tenants.config.mjs`) |
| **Edge** | Cloudflare Pages (direct upload via Wrangler) + **Pages Function** `frontend/functions/[[path]].ts` (proxy de API same-origin) |
| **Ilhas React** | React 19 + MUI v9 (`@mui/material` ^9, `@mui/icons-material`) + Emotion — hidratação sob demanda (`client:load` / `client:visible` / `client:only`) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) com tokens `--cq-*` do Design System (`frontend/src/styles/tokens.css`) |
| **Language** | TypeScript ~5.6 |
| **Comentários** | Giscus (`@giscus/react`, repo: `codaqui/institucional`; Blog por `og:title`, Assembleias por `pathname` e categoria configurada por `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID`) |
| **Pagamentos** | Stripe.js embutido (`@stripe/react-stripe-js`) no fluxo de doação |
| **Node** | ≥24 (enforced em `package.json` engines, raiz e `frontend/`) |
| **Hosting** | Cloudflare Pages — projetos `codaqui`, `tisocial`, `elasnocodigo`, `devparana` |

### Backend (NestJS — local + produção ARM64)

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| **Language** | TypeScript 5.7 |
| **ORM** | TypeORM 0.3.28 + `@nestjs/typeorm` 11 |
| **Database** | PostgreSQL 18 (`postgres:18-alpine`) |
| **Autenticação** | GitHub OAuth + JWT (Passport.js — `passport-github2` + `passport-jwt`, `@nestjs/passport`, `@nestjs/jwt`), httpOnly cookie |
| **Validação** | `class-validator` 0.14 + `class-transformer` (ValidationPipe global, whitelist + transform) |
| **Rate Limiting** | `@nestjs/throttler` 6.5 |
| **API Docs** | `@nestjs/swagger` 11.2 (Swagger UI) |
| **Storage** | ⚠ **Sem upload pelo backend**: comprovantes/recibos são **links externos** que o time sobe manualmente em serviços confiáveis. O `StorageModule` valida URLs (`POST /storage/validate-receipt-url`) — exige HTTPS e hostname numa allowlist: Google Drive/Docs, Dropbox, OneDrive (`1drv.ms`), Imgur. **Não há S3/MinIO conectado**; o backend não escreve em disco local nem em bucket. |
| **Pagamentos** | Stripe SDK 21 (Checkout Sessions + Webhooks com validação obrigatória de assinatura) |
| **E-mail** | `nodemailer` 9 (SMTP Gmail — `SMTP_*` + `EMAIL_FROM` no `.env.example`; sem credenciais os envios são logados como `skipped` com `SMTP_NOT_CONFIGURED`, sem contar como falha) |
| **GitHub-as-Database** | Token OAuth do próprio membro (scope `public_repo`, criptografado em repouso — `GITHUB_TOKEN_ENCRYPTION_KEY` + `GITHUB_REPO_*` no `.env.example`). ⚠️ **Legado:** hoje usado apenas pelo force-sync manual do snapshot interno (`POST /events/internal/snapshot`, abre PR em nome do membro — canônico se colaborador; fork flow senão; será removido, ver `docs/plans/events-sync-improvements/` Camada 3). Overrides e organizers migraram para o PostgreSQL (`event_overrides`, `event_organizer_ownership`) |
| **Reverse Proxy (prod)** | Traefik (infra externa do servidor ARM64) |
| **Container** | Podman Compose (`compose.yaml` dev, `compose.prod.yaml` ARM64) |
| **Image (prod)** | `ghcr.io/codaqui/institucional-backend:latest-arm64-v8` |

**Versionamento do backend:** ver `backend/package.json` (não fixar a versão nesta doc). Toda mudança em `backend/` exige **bump semver** (feat → minor, fix → patch): o workflow `publish-backend.yml` (manual) usa o `version` para a tag da imagem multi-arch (amd64 + arm64/v8) no GHCR e para a release `v<versão>-backend` — e o **redeploy em produção é manual no Coolify** (ver Commands).

**Site**: https://codaqui.dev · **API**: https://api.codaqui.dev · **Repo**: https://github.com/codaqui/institucional · **CNPJ**: 44.593.429/0001-05

---

## Commands

> Setup completo, variáveis de ambiente, migrations e guia de deploy: **[DEVELOPMENT.md](./DEVELOPMENT.md)**. Não duplique aqui.

Antes de submeter mudanças, rode os **gates por build**:

```bash
# Site codaqui (gate completo)
make astro-verify          # build + astro check + vitest + tsc da Pages Function
                           # + smoke do dist/ + gate de paridade de URLs (diff-urls)

# Builds multi-tenant (codaqui + 3 tenants)
make astro-verify-tenants  # 4 builds + allow-list de URLs por tenant (tenant-urls)
```

Comandos por camada:

```bash
# Frontend (frontend/ — app Astro)
cd frontend && npm run build     # build estático em dist/ (copia snapshots + conteúdo antes)
cd frontend && npm run check     # astro check (tipos de .astro — gate só no build codaqui, ver R7 abaixo)
cd frontend && npm run test      # vitest (libs, contratos e ilhas)

# Backend (se mexeu em backend/)
cd backend && npm run build      # nest build
cd backend && npx jest --silent  # testes unitários

# Scripts de sync (raiz — leves, sem install pesado)
npm run test:scripts             # node --test scripts/*.test.mjs
npm run sync                     # eventos + social-stats + analytics → static/
npm run sync:assemblies          # /assemblies/public → static/assemblies/ (fora do agregador sync)
npm run sync:badges              # /hours/public → static/badges/ (fora do agregador sync)
```

> ⚠️ **Mudança em `backend/` exige bump de `version` em `backend/package.json`** (semver: feat → minor, fix → patch). O workflow `publish-backend.yml` (manual) usa essa versão para a tag da imagem Docker no GHCR e para a release `v<versão>-backend` — sem bump, o deploy publica por cima da versão anterior.

Demais comandos (dev server, lighthouse, syncs individuais, infra Podman Compose, migrations): **`make help`** ou a seção de comandos do [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## Directory Structure

Este repositório é um **monorepo**: conteúdo canônico + scripts de sync na raiz, app do site em `frontend/`, API em `backend/`.

```
institucional/
├── backend/                     # 🖥️ API REST NestJS
│   ├── src/
│   │   ├── auth/                # GitHub OAuth + JWT (GithubStrategy + JwtStrategy)
│   │   ├── members/             # Membros da Codaqui (multi-role `roles: text[]`, autorização)
│   │   ├── github-db/           # GitHubDBService — ⚠️ legado: só force-sync de snapshot interno
│   │   ├── event-organizer/     # ⭐ Ownership de eventos externos (PostgreSQL) + validação de overrides
│   │   ├── events/              # ⭐ Plataforma de eventos: managed_events, ticket_types, orders, registrations, staff, check-in, CSV, relatórios, 18+
│   │   ├── hours/               # ⭐ Fase 2/ADR 013: hour_ledger separada, aprovações, declarações e totais públicos
│   │   ├── assemblies/          # ⭐ Fase 3/ADR 014: registro fino, numeração, autorização, auditoria e cartório de assembleias
│   │   ├── notifications/       # ⭐ E-mails (nodemailer + email_logs sent/failed/skipped, resend, summary e crons)
│   │   ├── designations/        # ⭐ member_designations: vínculos, guard e roles organizacionais derivadas
│   │   ├── directorates/        # Diretorias; edição do diretor somente na própria diretoria
│   │   ├── communities/         # ⭐ Registro/seed das 6 comunidades, selo e validação de destino de doação
│   │   ├── settings/            # app_settings + retenção operacional de auditoria (7–365 dias)
│   │   ├── common/turnstile/    # Infraestrutura Turnstile opt-in (nenhuma rota usa o guard na Fase 1a)
│   │   ├── ledger/              # ⭐ Contabilidade dupla partida + exportação CSV server-side por range
│   │   ├── stripe/              # Stripe Checkout + webhooks (donations, refunds)
│   │   ├── expenses/ transfers/ reimbursements/ vendors/  # ⭐ Módulos financeiros (gravam no ledger)
│   │   ├── audit/               # Logs governance (permanentes, sem IP) e operational (com retenção)
│   │   ├── storage/             # Valida URLs de comprovante (allowlist HTTPS; ⚠ sem upload)
│   │   └── migrations/          # TypeORM migrations (até 036; Fase 2: 033–035; Fase 3: 036)
│   └── Dockerfile               # Multi-stage: builder → runner (alpine + curl)
├── frontend/                    # 🚀 App Astro 7 — site codaqui + builds dos 3 tenants
│   ├── astro.config.mjs         # srcDir switching por TENANT; sitemap (SITEMAP_EXCLUDE); SITE_URL
│   ├── tenants.config.mjs       # ⭐ Fonte única dos tenants (slug, site, project Pages)
│   ├── functions/[[path]].ts    # ⭐ Pages Function — proxy de API same-origin (allow-list estreita)
│   ├── functions/tsconfig.json  # Type-check da Function é separado do astro check
│   ├── src/                     # App do portal codaqui (srcDir padrão)
│   │   ├── pages/               # Rotas .astro (blog/, trilhas/, eventos/, admin/, comunidades/, desenvolvedores/, …)
│   │   ├── layouts/             # BaseLayout (SEO/OG/JSON-LD/noindex), PublicLayout, AppLayout, BlogPostLayout, TrilhaLayout
│   │   ├── components/
│   │   │   ├── astro/           # Componentes de servidor (SiteHeader, EventCard, PageHero, …)
│   │   │   └── islands/         # ⭐ Ilhas React (admin/, events/, ui/PaginationControls, ApiDocsIsland, ThemeToggle, …)
│   │   ├── content/             # Collections Astro (blog, trilhas, pages, community-blog)
│   │   ├── content.config.ts    # Schemas + loaders (glob)
│   │   ├── data/                # ⭐ Camada de dados (team, communities, projects, timeline, giscus, analytics, …)
│   │   ├── lib/                 # ⭐ Lógica pura testada (events, pagination, header-menu, remark-admonitions, analytics, api-url, use-auth, mui-theme, …)
│   │   ├── test/                # ⭐ Helpers vitest compartilhados (http-mock.ts: jsonResponse/useFetchMock; render-mui.tsx: renderWithMui)
│   │   └── styles/              # tokens.css (--cq-*) + global.css (ponte @theme inline → Tailwind)
│   ├── src-tenants/             # Apps dos tenants (tisocial, elasnocodigo, devparana) — thin, reutilizam src/
│   ├── scripts/                 # ⭐ copy-content.mjs, copy-snapshots.mjs, build-tenant-redirects.mjs,
│   │                            #    diff-urls.mjs, tenant-urls.mjs, archive-urls.mjs, url-reference.json
│   └── public/                  # Assets estáticos + robots.txt (snapshots são copiados p/ cá no prebuild)
├── blog/                        # ⭐ Conteúdo canônico do blog (Markdown/MDX) — copiado p/ o app no build
│   ├── authors.yml              # Fonte canônica de autores
│   └── YYYY-MM-DD-slug.md(x)    # Posts (slug legado no frontmatter — ver decisão 7)
├── trilhas/                     # ⭐ Conteúdo canônico das trilhas (python/, github/)
├── comunidades/                 # ⭐ Configs das comunidades parceiras (READ-ONLY no app — ver decisão 4)
│   ├── index.ts                 # COMMUNITIES_CONFIG (fonte única)
│   └── <slug>/                  # community.config.ts + blog/docs (symlinks no src-tenants)
├── static/                      # ⭐ Snapshots gerados por workflows (events/, communities/, assemblies/, social-stats/, analytics/, badges/, img/)
├── scripts/                     # Syncs/validação da raiz (rodam em workflows e local)
│   └── *.mjs                    # sync-events / sync-communities / sync-assemblies / sync-social-stats / sync-analytics / sync-member-badges (+ testes .test.mjs)
│                                #    (syncs legados leem data files; communities/assemblies/badges leem a API PostgreSQL)
├── docs/                        # Documentação técnica (ADRs, módulos, planos)
├── .github/workflows/           # 9 workflows (ver Git Workflow & Deployment)
└── Makefile                     # Atalhos: astro-*, backend-*, db-*, migration-*, sync
```

---

## Critical Architecture Decisions

### 1. Design tokens `--cq-*` — zero hex solto

`frontend/src/styles/tokens.css` é a **fonte única** do Design System. Tailwind consome via `@theme inline` em `global.css` (utilitários `bg-action`, `text-primary-700`, …); o tema MUI (`src/lib/mui-theme.ts`) **espelha** os mesmos valores.

- Nunca hardcode hex em componentes — use tokens CSS (`var(--cq-*)`) ou utilitários Tailwind; em ilhas MUI, use o tema (`color="primary.700"`, `sx` com tokens do tema).
- ⚠️ Cor de marca `#57B593` (primary-500) tem contraste 2.49:1 sobre branco — **só decoração/grandes áreas**. Texto e ícones essenciais sobre claro: `--cq-color-primary-700` (`#378369`, 4.55:1) ou superior; links: primary-800.

### 2. Multi-tenant por build matrix (Fase 0.5)

- `TENANT=<slug>` em build-time troca o `srcDir` para `frontend/src-tenants/<slug>/` — rotas limpas (`/`, `/apoiar`, `/transparencia`, `/equipe`, `/blog`, `/docs`) com tema/nav da comunidade. **`frontend/tenants.config.mjs` é a fonte única** (slug, domínio `site`, projeto Pages).
- **Build codaqui = sem `TENANT`** (srcDir padrão `./src`, portal completo). `TENANT=codaqui` quebraria o build (`TENANT_BY_NAME` não tem essa chave).
- O matrix do workflow `.github/workflows/deploy-astro.yml` (e o job `astro-tenants` do `pr-check.yml`) **espelha** essa lista — ao onboarding um tenant novo, atualize os dois **e** `tenants.config.mjs` juntos.
- og:url/canonical/sitemap saem corretos por build porque `SITE_URL` vem do tenant (build-time) — não há reescrita em runtime.
- **R7 — `astro check` NÃO é gate em modo tenant:** páginas codaqui sob srcDir de tenant têm ~62 erros pré-existentes (limitação do `getCollection`). Gates: codaqui = `make astro-verify` completo; tenant = build + `tenant-urls`.

### 3. API same-origin via Pages Function — allow-list ESTREITA (lição I-1)

`frontend/functions/[[path]].ts` intercepta **somente** os paths da allow-list em `frontend/src/lib/api-proxy-paths.ts` e faz forward para `API_ORIGIN` (default `https://api.codaqui.dev`), com method/headers/cookies intactos. Todo o resto cai no asset estático via `next()`.

- O prefixo admin é **deliberadamente estreito**: `/admin/members/` (com trailing slash de propósito). O prefixo antigo `/admin/` fazia a Function interceptar as 13 páginas do painel `/admin/*` — a Function roda **antes** dos assets e do `_redirects` no Pages, e o proxy respondia 404 do backend: o painel inteiro sumia no edge (achado I-1, fix `67ac9450f9e`).
- **Nunca alargue a allow-list sem checar colisão com rotas estáticas do app.** Prefixo estreito + trailing slash; bare path casa por normalização, e `/admin/memberships` (falso positivo de `startsWith`) NÃO casa.
- `/auth/callback` **não** é API — é a página do frontend que finaliza o OAuth (não confundir com `/auth/github/callback`, rota do backend).
- No cliente, **sempre** resolva a base com `resolveApiUrl()` (`src/lib/api-url.ts`): em builds tenant o guard `PUBLIC_TENANT` força same-origin; `API_URL` cru cairia no fallback errado fora do workflow.

### 4. Conteúdo canônico na raiz — `frontend/src/content/` é gerado

- `blog/` e `trilhas/` na raiz são **canônicos**. `frontend/scripts/copy-content.mjs` (predev/prebuild) copia para `frontend/src/content/blog` e `frontend/src/content/trilhas`. **Nunca edite as cópias** — suas mudanças serão apagadas no próximo build.
- A collection `pages` (páginas soltas .md) **não** é mais copiada: os canônicos moram versionados em `frontend/src/content/pages/`.
- Assets de blog/trilhas (`blog/img/`, `trilhas/github/assets/`) são copiados para `frontend/public/blog-assets/` e `frontend/public/trilhas-assets/`.
- Snapshots (`static/events|communities|assemblies|social-stats|analytics/index.json`, `static/badges/` + imagens selecionadas) são copiados para `frontend/public/` por `copy-snapshots.mjs` no prebuild. `/assemblies/index.json` permanece estático e é exceção ao prefixo de API `/assemblies/`.
- Autores do blog: fonte canônica `blog/authors.yml`; ao alterá-la, replique em `frontend/src/data/blog-authors.ts` (o topo do arquivo aponta para cá).
- `comunidades/<slug>/` (community.config + blog/docs) é **READ-ONLY** no app — os tenants leem via symlink (`core.symlinks true` no clone). Edite o conteúdo da comunidade **na pasta `comunidades/`**, nunca no `src-tenants/`.

### 5. Eventos — snapshot estático + páginas geradas no build

> **Visão completa:** [docs/adrs/001-event-platform.md](docs/adrs/001-event-platform.md) · [Manual prático de código](docs/modules/events/CODE_MANUAL.md) · [Mapa de papéis/permissões](docs/modules/events/ROLES.md)

- A listagem pública de eventos é **estática**: o workflow `sync-event-snapshots.yml` (horário) gera JSONs em `static/events/` a partir de fontes externas (Discord, Meetup, Sympla, OCGroups, Doity — configuradas em `events.config.json`) e da fonte própria `internal:codaqui` (backend `GET /events/public/managed`). O app lê o snapshot do **filesystem em build-time** (`loadEventsIndex()` em `src/lib/events.ts`) e o build estático emite `/eventos/<rota>` por evento (`src/pages/eventos/[...path].astro`, helpers em `src/lib/event-path.ts`) com OG/JSON-LD. O mesmo índice é servido em runtime em `/events/index.json`.
- **Status:** `scheduled`, `active`, `completed`, `canceled`. Ordenação do índice: ASC por `startAt`.
- **Overrides de metadados:** via API REST do backend (`/events/overrides`, persistidos no PostgreSQL); o sync aplica os metadados estendidos antes de gravar os snapshots.
- **Eventos próprios (`internal:codaqui`):** a página de detalhe detecta a fonte e embute inscrição/checkout (`EventRegistrationIsland`).
- **Perfis de membro:** `src/pages/[...handle].astro` gera a vanity URL `/@<handle>` em build time a partir da API pública (`loadPublicMembers()` — sem API retorna `[]` com warn e o build segue; o 404 faz fallback para `/membros/perfil?handle=`).
- **Force-sync manual** (`POST /events/internal/snapshot`, botão no admin): abre PR usando o token do membro (GitHub-as-Database) — **fluxo legado**, será substituído (ver `docs/plans/events-sync-improvements/`, Camada 3).

### 6. Backend financeiro — tudo passa pelo ledger

Todo movimento financeiro passa pelo `ledger` (`Account` + `Transaction`, double-entry). Os módulos especializados gravam suas próprias entidades **e** registram a transação no ledger via `LedgerService.recordTransaction(source, destination, amount, description, referenceId)`.

#### Convenção de `referenceId`

| Módulo | Padrão | Reversal |
|--------|--------|----------|
| Stripe donation | `stripe-pi:<paymentIntentId>` | `stripe-refund:<paymentIntentId>:<refundId>` |
| Reimbursement | `reimbursement:<id>` | `reimbursement-reversal:<id>:<ts>` |
| Transfer | `transfer:<id>` | — |
| Vendor payment | `vendor-payment:<id>` | `vendor-payment-reversal:<id>:<ts>` |
| Vendor receipt | `vendor-receipt:<id>` | `vendor-receipt-reversal:<id>:<ts>` |
| Expense (lançamento direto) | `expense:<id>` | `expense-reversal:<id>:<ts>` |
| Event ticket | `event-ticket:<orderId>` | `event-ticket-refund:<orderId>:<ts>` |

> ⚠️ A captura de taxa Stripe (`stripe-fee:*`) **não** se aplica a ingressos de eventos — o handler localiza a doação pelo `referenceId` com prefixo `stripe-pi:`. Fees de eventos ficam fora do ledger por ora (follow-up conhecido).

> O frontend classifica a transação pelo **prefixo** do `referenceId` (`src/lib/transaction.ts`) e renderiza o cartão correto.

#### Padrão `persistWithLedger`

Para garantir atomicidade entre o save da entidade especializada e o registro no ledger:

```ts
const saved = await this.persistWithLedger(repo, entity, (s) => ({
  sourceAccountId, destinationAccountId, amountBrl,
  description, referenceId: `<prefix>:${s.id}`,  // ← s.id já existe (UUID gerado pelo PG)
}));
```

> ⚠️ **Use a factory `(saved) => ledgerArgs`**, NÃO um objeto literal. O UUID só é gerado depois do save — usar `entity.id` antes resulta em `referenceId: "...:undefined"`.

#### Papéis relevantes

| Role | Escopo |
|------|--------|
| `membro` | Default de todo membro |
| `admin` | Global |
| `finance-analyzer` | Global (relatórios financeiros) |
| `event_organizer` | Global + ownership por evento externo via `event_organizer_ownership` |
| `event_finance` | Global (relatórios/reembolsos de eventos) |
| `event_host` | Por evento (`event_staff`, `host`) |
| `event_checker` | Por evento (`event_staff`, `checker`) |

> Papéis de eventos detalhados em [docs/modules/events/ROLES.md](docs/modules/events/ROLES.md).

### 7. Blog — convenção de URL (SEO crítico) + comentários

Posts vivem em `blog/YYYY-MM-DD-slug.md(x)`. O frontmatter `slug` determina a URL final — preserva URLs indexadas pelo Google desde o site anterior:

```yaml
---
slug: 2024/07/22/meu-post
title: "Título do Post"
authors: [username]   # ou lista inline de objetos {name, title, url, image_url}
tags: [tag1, tag2]
date: 2024-07-22      # opcional — ausente, o app infere pela data do nome do arquivo
---
```

- `<!-- truncate -->` marca o fim do resumo na listagem (o build converte nas cópias).
- **Nunca mude o `slug` de posts publicados** — quebra URLs indexadas e mapeamento de comentários.
- Comentários Giscus usam mapping `og:title` (`frontend/src/data/giscus.ts`): o `og:title` dos posts precisa permanecer estável para o histórico de comentários sobreviver. Disable per-post com `enableComments: false` no frontmatter.

### 8. Redirects legados em `dist/_redirects` + paridade de URLs versionada

- Os redirects de URLs legadas (ex.: `/quero/apoiar`, `/team`, `/sobre/timeline`, `/conduta`, `/blog/archive/*`, … — 16 no total) vivem no **`dist/_redirects` gerado em build-time** por `frontend/scripts/build-tenant-redirects.mjs` (build codaqui). Os antigos stubs de página rediretora foram **deletados** — não recrie páginas-sombra; adicione a regra no script.
- Builds tenant emitem `_redirects` com 301 de `/comunidades/<slug>[/*]` para `[/][:splat]` (links antigos do portal funcionam no domínio próprio) **e** um `robots.txt` com o Sitemap do domínio do tenant.
- **Paridade pós-cutover:** `frontend/scripts/url-reference.json` é a referência versionada e **congelada** das URLs públicas do site anterior (gerada por `archive-urls.mjs` antes da remoção do stack antigo). `diff-urls.mjs` (dentro de `make astro-verify`) falha se qualquer URL da referência não for servida pelo build novo (página ou redirect). URLs válidas = páginas do dist ∪ sources ∪ targets do `_redirects`; redirect que aponta para o nada quebra o gate. **Não regenere a referência** — ela é o contrato do cutover.

### 9. Rotas de app noindex + fora do sitemap

Rotas de aplicativo (`/admin/*`, `/auth/*`, `/membro/*`, `/membros/empresa`, `/eventos/detalhe`, `/eventos/comprovante`, 404) passam `noindex` no layout e são excluídas do sitemap (`SITEMAP_EXCLUDE` em `astro.config.mjs`). O `robots.txt` do build codaqui aponta o Sitemap para `https://codaqui.dev/sitemap-index.xml`.

### 10. Dark mode — `data-theme` com anti-FOUC

`BaseLayout.astro` emite um script inline no `<head>` que lê a preferência salva/sistema e seta `document.documentElement.dataset.theme` **antes do paint** (sem flash). Ilhas MUI leem o mesmo atributo (`MuiIslandProvider`, `ThemeToggle`) — em ilhas, nunca assuma tema sem observar `data-theme` no `documentElement`.

### 11. Padrão de tela admin

Toda página em `frontend/src/pages/admin/*` é um `.astro` fino:

```astro
---
import AppLayout from "../../layouts/AppLayout.astro";
import AdminHubApp from "../../components/islands/admin/hub/AdminHubApp";
---

<AppLayout title="Admin" noindex>
  <AdminHubApp client:only="react" />
</AppLayout>
```

1. A ilha React usa o hook `useAuth()` (`src/lib/use-auth.ts`): `authFetch` faz `setUser(null)` em 401 → redirect automático para login.
2. Helpers em `src/lib/auth-fetch-helpers.ts`: `parseAuthJson<T>(res, onError)` para GETs (retorna `null` em erro, não throw) e `extractErrorMessage(res, fallback)` para POST/PATCH/DELETE.
3. Estado de erro com `Alert`/`loadError` no header da página.
4. Tabelas/cartões usam `<TransactionDetailDialog>` / `<WalletTransactionDetailDialog>` para detalhe rico ao clicar.
5. A base da API na ilha vem de `resolveApiUrl(import.meta.env.SITE)` — nunca `API_URL` cru (ver decisão 3).

### 12. Paginação padronizada (site + backend)

- **Frontend:** `src/lib/pagination.ts` é a fonte única — constantes `MEMBERS_PAGE_SIZE` (100), `DEFAULT_PAGE_SIZE` (50), `MAX_PAGE_SIZE` (100), `PAGE_WINDOW_SIZE` (5); interface `PaginatedResponse<T>` (`{data, total, page, totalPages, limit?}`); `pageWindow()` (janela deslizante de páginas centrada na atual) e `rangeLabel()` ("Mostrando X–Y de Z"). Ilhas/tabelas **nunca hardcodam limites** — importam daqui.
- **Componente:** `src/components/islands/ui/PaginationControls.tsx` (MUI acessível — `<nav>` com `aria-label`, `aria-current` na página ativa) **só renderiza quando há mais de uma página** (`totalPages <= 1` → `null`).
- **Backend:** DTOs de query com `@Type(() => Number)` + `@IsInt()` + `@Min(1)` + `@Max(...)` — `GetMembersQueryDto` (cap 100, default 50) e o padrão de `GetTransactionsQueryDto` do ledger (cap 50, default 10). Envelope `PaginatedResultDto` (`backend/src/ledger/dto/paginated-result.dto.ts`): `{data, total, page, totalPages, limit}`.
- **Novas listagens devem seguir esse padrão** (lib + componente + DTO + envelope) — ver também o anti-pattern correspondente.

### 13. Admonitions em trilhas e blog

- Sintaxe Docusaurus: `:::info[Título]`, `:::tip`, `:::warning`, `:::note`, fechamento `:::` em linha própria; título **sem colchetes** também vale (`:::tip Texto livre`).
- Transformer mdast em `src/lib/remark-admonitions.ts`, plugado no `markdown.processor` do `astro.config.mjs` (depois de `remarkContentAssets` — ordem importa); saída `<div class="admonition admonition-{tipo}">` com CSS em `global.css` (`.prose-cq .admonition*`, cores por tokens `--cq-*`).
- As fontes canônicas **não são reescritas** (dezenas de blocos em `trilhas/`, também usados no `blog/`) — continue editando em `trilhas/`/`blog/` na raiz (decisão 4).
- Bloco **sem fechamento `:::` fica literal de propósito** — sinaliza erro de autoria em vez de engolir o documento.

### 14. Documentação da API no site (`/desenvolvedores/api`)

- Página pública e indexável (`src/pages/desenvolvedores/api.astro`) embute `ApiDocsIsland` (`client:only`): Swagger UI (`swagger-ui-dist`, ~1,7MB) via **dynamic import** — code-split, só é baixado nessa rota.
- A ilha consome `GET /docs-json` **ao vivo** com `resolveApiUrl(import.meta.env.SITE)` (mesmo padrão das demais ilhas; em builds tenant o proxy same-origin entrega `/docs-json`).
- O backend serve `/docs-json` **em produção incondicional** (fora do guard `SWAGGER_ENABLED` — `backend/src/main.ts`); a UI `/docs` continua dev-only (`SWAGGER_ENABLED=true` em prod).
- `/docs-json` está na allow-list do proxy como path **exato** (`api-proxy-paths.ts`) — não colide com rotas estáticas.
- Try-it ativo de propósito: o CORS do backend cobre codaqui.dev + domínios dos tenants; endpoints protegidos pedem JWT Bearer (botão Authorize).

### 15. Header e menus (SiteHeader + NavbarAuth)

- `src/lib/header-menu.ts`: menus desktop em `<details>` — **single-open** (abrir um fecha os demais), **ESC fecha**, **clique fora fecha** (`initHeaderDetailsNav`); **hover-intent** via `bindHover` (openDelay 200ms, closeDelay 300ms — tempo de atravessar o gap até o painel; só instala com hover fino, `pointer: fine` — touch/teclado seguem 100% nativos do `<details>`); drawer mobile com focus trap (Tab wrap) e light dismiss.
- `NavbarAuth` (ilha, usada no header desktop e no drawer mobile): o avatar abre o menu do usuário — **Meu Perfil** (`/membro`), **Meu Clube** (`/clube`), **Minha Empresa** (`/membros/empresa`, só com `hasCompany`), **Painel Admin** por papel (href dinâmico: admin/finance → `/admin`, organizer → `/admin/eventos`, host/checker → `/admin/eventos-checkin`), **Fazer uma Doação** (`/participe/apoiar`), **Trocar conta**, **Sair**. No drawer mobile (`variant="inline"`) vira lista expandida, não dropdown.

### 16. Analytics com fallback (`/sobre/insights`)

- `src/lib/analytics.ts`: `loadAnalyticsWithFallback()` — primário `/analytics/index.json` (snapshot same-origin, `src/data/analytics.ts`); **failover** reconstrói o snapshot a partir do repo `codaqui/dados` (listing via `api.github.com` + arquivos em `raw.githubusercontent.com`, últimos 12 meses, parse defensivo — números vêm como string no formato raw).
- Validação de host **sempre por URL parsing** (`isAllowedHost`: `new URL(...)`, protocolo `https:` + hostname **exato** na lista) — **nunca `startsWith`** (`https://api.github.com.evil.example` passaria; regra CodeQL `js/incomplete-url-substring-sanitization`).
- Ilha `SiteAnalyticsIsland` com estados visíveis: skeleton CSS enquanto carrega, Alert com **Tentar novamente** em erro, seletor de período (3/6/12 meses/Todos) — falha visível em vez de seção sumindo.

### 17. Dados de comunidade enriquecidos em build time

- `comunidades/<slug>/src/data/*` é consumido em **build time** pelo app (ex.: `comunidades/devparana/src/data/ambassadors.json` → páginas `/embaixadores` do build tenant e do portal codaqui; `tisocial` tem `upcoming.json`/`campaigns.json`).
- Enriquecimento: `EmbaixadoresPage.astro` cruza os dados locais com `loadPublicMembers()` (API pública) via `findMemberByAmbassador` (`src/lib/community-devparana.ts`, matching por `githubHandle`); quando encontra o membro, **prefere `member.name`** (e avatar/linkedin/bio) sobre o cadastro local — comportamento conhecido.
- Sem API disponível no build → fallback nos dados locais (build segue).

### 18. Designations e diretorias (Fase 1a — ADR 006)

- `member_designations` é a única fonte dos vínculos novos. Não criar `directorMemberId`, `responsibleMemberId`, `directorate_members` ou tabelas paralelas. `event_organizer_ownership` e `event_staff` continuam nos modelos próprios.
- APIs reais: `GET /designations/me`; `POST /designations`, `POST /designations/:id/confirm`, `POST /designations/:id/revoke` (admin); `GET /directorates/public`, `GET /directorates/manage`, `POST /directorates` e `PATCH /directorates/:id`.
- `director @ directorate` deriva `diretor` + `voluntario`; `volunteer` deriva `voluntario`. Regras de `mentor` e `gestor_universitario` existem, mas seus módulos continuam em design. Roles derivadas não são editáveis por `PATCH /admin/members/:id`.
- Diretor edita somente a diretoria da sua designation ativa; guard e service verificam o escopo. Proxy: somente `/designations/` e `/directorates/`, nunca `/admin/`.
- **Baseline histórico da Fase 1a:** naquele recorte não existia `hour_ledger`; horas, aprovações e declarações ficavam para fase futura. **A Fase 2 introduziu** `backend/src/hours/` e a migration 033 — ver decisão 24 e [ADR 013](docs/adrs/013-hour-ledger.md).

### 19. Registro de comunidades (Fase 1a — ADR 007)

- PostgreSQL guarda o registro; `static/communities/index.json` é o snapshot público consumido no build. Branding/conteúdo continuam em `comunidades/<slug>/`, e tenants continuam exigindo `tenants.config.mjs` + workflows + Pages/DNS.
- Seis seeds: Integradas `devparana`, `elasnocodigo`, `tisocial`, `campostechpg`; Parceiras `cloudnativemaringa`, `cumbucadev`. As Integradas nascem sem responsible fabricado. Só os três tenants têm `siteEnabled=true`; CamposTech tem `siteEnabled=false`.
- APIs reais: `GET /communities/public`, `GET /communities/manage`, `POST /communities`, `PATCH /communities/:id`, `POST /communities/:id/seal/request`, `POST /communities/:id/seal`. Selo admin exige `responsible @ community` ativo, `sealNotes` e validade futura/default anual.
- Checkout direcionado aceita somente Integrada ativa; Parceira é recusada antes do Stripe. `tesouro-geral` e CamposTech continuam aceitos. Proxy: somente `/communities/`.
- `npm run sync:communities` usa `COMMUNITIES_API_URL` (default local) e rename atômico. O workflow `sync-community-snapshots.yml` roda no minuto 7 de cada hora + dispatch; o agregador `npm run sync` não inclui comunidades.
- Não declarar Autônoma, split/payout, platform fee ou mantenedores como implementados.

### 20. E1 — e-mails skipped, resend e summary

- SMTP ausente grava `email_logs.status=skipped` e `error=SMTP_NOT_CONFIGURED`, sem contar como falha nem desfazer a operação principal. Só `sent`/`failed` deduplicam crons.
- `GET /notifications/status`, `GET /notifications/emails` e `POST /notifications/emails/:id/resend` sustentam a operação. Resend exige SMTP e registration vinculada, atualiza o mesmo log e retorna 409 sem SMTP. Summary separa `sent`, `failed`, `skipped` por template. Logs expiram em 365 dias.

### 21. R1 — CSV por range e G6 — retenção de auditoria

- `GET /ledger/accounts/:id/transactions/export` é público no conjunto da conta; `GET /ledger/transactions/export` exige admin/finance-analyzer. `from`/`to` são compartilhados com a listagem, `to` inclui o dia inteiro e o CSV exporta todas as linhas do range, com BOM e escape de formula injection.
- `auditCategory()` separa `governance` (permanente, sem IP) de `operational` (expira). `GET/PUT /settings/audit-retention` configura 7–365 dias; setting vence `AUDIT_OPERATIONAL_RETENTION_DAYS` (default 30). `POST /audit/cleanup`, cron e startup usam a mesma política e nunca apagam governo.

### 22. Turnstile no guest claim (G3)

- `TurnstileService` valida resposta Cloudflare com `fetch`, timeout de 5 s, hostname exato, ação `guest_claim` e cache SHA-256 de 5 min. O guard lê `turnstileToken` ou `cf-turnstile-token` e resolve o hostname do frontend por `Origin`, `Referer`, `X-Forwarded-Host` e então `req.hostname`, restringindo o resultado exato por `TURNSTILE_HOSTNAMES`. Os nomes SPIN `TURNSTILE_SECRET`/`TURNSTILE_HOSTNAMES` são canônicos; `TURNSTILE_SECRET_KEY`/`TURNSTILE_ALLOWED_HOSTNAMES` permanecem como fallback legado.
- Desde a Fase 2, `POST /events/public/guest-claim` usa `TurnstileGuard`. Sem secret, desenvolvimento faz warn/no-op e aceita o token `development`; produção falha fechada. `TurnstileField` só renderiza com `PUBLIC_TURNSTILE_SITE_KEY`, mapeada no build a partir de `vars.TURNSTILE_SITE_KEY` (ou do alias público) e resetada após uma recusa para permitir retry com token novo.

### 23. ECA — eventos 18+ informativos

- Migration 031: `managed_events.adultOnly` boolean default false + `venueType` (`bar`, `restaurante`, `auditorio`, `campus`, `online`, `outro`). Managed events serializam ambos; overrides externos aceitam `adultOnly` boolean.
- Bar/restaurante a partir das 18h apenas sugere 18+ no formulário; ação humana marca. Badge `+18` e aviso estático não bloqueiam inscrição, não coletam idade/documento e não removem página do sitemap. Mudança pós-publicação grava auditoria de governo com antes/depois.

### 24. Fase 2 — horas e badges (ADR 013)

- `backend/src/hours/` implementa `hour_ledger` separada da ledger financeira, aprovação/rejeição com audit, crédito exactly-once no check-in, extrato/summary e declarações sem prazo de validade. Somente `event_checkin` e `directorate_activity` estão ativos; não há backfill nem horas retroativas de guests. Decisões completas: [ADR 013](docs/adrs/013-hour-ledger.md).
- `profileVisibility.hours`, `memberSince` e `badge` controlam independentemente totais/timeline, ano e selo. `scripts/sync-member-badges.mjs` lê `GET /hours/public`, valida a resposta completa e escreve `static/badges/<handle>.svg` atomicamente; falhas preservam/restauram arquivos anteriores.
- O workflow `sync-member-badges.yml` roda diariamente às **06:17 UTC** e por dispatch, e `copy-snapshots.mjs` copia os SVGs no build. **Gate de release:** depois do backend publicado, o sync inicial deve concluir com sucesso **antes da publicação do frontend**; não gerar SVGs de membros reais no branch de implementação. Release `v0.14.0-backend` publicada, sync inicial concluído no run `42098199373` e frontend publicado no run `42098283935`. Reconcile em produção concluído com `{inserted: 0, alreadyPresent: 3, orphanedActivations: 0}`; claim real em produção permanece como acompanhamento operacional.

### 25. Fase 3 — assembleias e Discussion manual (ADR 014)

- Migration 036 e backend 0.15.0 implementam o registro fino `assemblies`; pauta detalhada, quórum, votos, ata narrativa e comentários ficam no GitHub Discussions, nunca no PostgreSQL ou snapshot. `createdById` é somente trilha e não aparece nas projeções. Decisões completas: [ADR 014](docs/adrs/014-assemblies.md).
- `(type,number)` é único e o slug `<type>-<number>` é imutável. A criação usa advisory lock por tipo + `MAX(number)+1` transacional. Somente `scheduled` vira `held`/`canceled`; `heldAt >= scheduledAt`; oficial realizada exige PDF HTTPS pela allowlist e cartório completo. Não há upload nem automação de Discussion/cartório.
- APIs: `GET /assemblies/public`, `GET /assemblies/public/:slug`, `GET /assemblies` paginado (default 50/cap 100), `POST /assemblies` e `PATCH /assemblies/:id`. Criar/editar exige admin ou diretor ativo; PDF/cartório exige admin; mutações gravam audit de governo. Proxy: `/assemblies/`, com exceção estática para `/assemblies/index.json`, nunca `/admin/`.
- `npm run sync:assemblies` usa `ASSEMBLIES_API_URL`, valida toda a coleção e grava `static/assemblies/index.json` atomicamente; falha preserva o arquivo anterior. O workflow diário é 06:23 UTC + dispatch; o agregador `npm run sync` não inclui assembleias. Publicação segue backend/migration → sync inicial → build/frontend.
- A Discussion é criada manualmente na categoria **Assembleias**, com título `/assembleias/<type>-<number>`, e a coordenação do próximo número deve ser serializada pelo operador. Giscus usa `pathname` e `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` (Variable pública); sem ID há somente link/fallback. O blog continua em `og:title`/Blog. Comentários e reações permanecem no GitHub e não seguem a retenção do backend.
- **Pendências externas:** categoria/ID, Discussions reais e verificação Giscus, PR/CI/Sonar, release `v0.15.0-backend`, redeploy/migration, sync inicial e publicação/validação em produção. Não declarar esses itens concluídos nem iniciar Fase 4 por esta decisão.

---

## Common Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| `<Grid item xs={12}>` ou system props MUI (`bgcolor=`, `p=`) | MUI v9: `size={{ xs: 12 }}` no Grid; `slotProps` para slots; `sx` para estilo — nada de system props nas props do componente |
| Hex solto em componentes (`#57B593`) | Tokens `--cq-*` (Tailwind) / tema Mui espelhado (`src/lib/mui-theme.ts`) — zero hex fora de `tokens.css` |
| Editar `frontend/src/content/blog` ou `trilhas` | Editar `blog/` e `trilhas/` na raiz (copiados por `copy-content.mjs`) |
| Editar conteúdo em `frontend/src-tenants/<slug>/` | Editar `comunidades/<slug>/` (READ-WRITE) — `src-tenants` lê por symlink |
| `fetch(API_URL …)` / `API_URL` cru em ilha | `resolveApiUrl(import.meta.env.SITE)` + `authFetch` do `useAuth` |
| Alargar a allow-list do proxy com prefixo largo (`/admin/`) | Prefixo **estreito** com trailing slash (`/admin/members/`); checar colisão com rotas estáticas antes (lição I-1) |
| Criar página-sombra de redirect | Regra no `build-tenant-redirects.mjs` → `dist/_redirects` |
| Regenerar `url-reference.json` sem justificativa | Referência congelada do cutover; gate `diff-urls` deve continuar verde |
| Usar `astro check` como gate de build tenant | R7: tenant = build + `tenant-urls`; codaqui completo em `make astro-verify` |
| `TENANT=codaqui` em build/script | Build codaqui = **sem** `TENANT` (env vazia) |
| Cadastrar tenant só no workflow (ou só em `tenants.config.mjs`) | Os dois **juntos**: `tenants.config.mjs` + matrix em `deploy-astro.yml`/`pr-check.yml` |
| `referenceId: \`prefix:${entity.id}\`` antes do `repo.save()` | Factory `persistWithLedger(repo, e, (s) => ({ referenceId: \`prefix:${s.id}\` }))` |
| `import * from '@mui/material'` | Named imports: `import { Card, Grid } from '@mui/material'` |
| Hardcode Discord/WhatsApp URLs | Import from `src/data/social.ts` |
| Inline team arrays ou registros de comunidade em páginas | Team em `src/data/team.ts`; registro de comunidades no PostgreSQL + snapshot (`sync:communities`) |
| `slug: meu-post` (blog) | `slug: 2024/07/22/meu-post` (preserves Google URLs) |
| Use "alunos", "escola", "curso" | Use "participantes", "Associação", "programa" |
| Nova listagem paginada hardcodando limit/page | `src/lib/pagination.ts` (constantes + `PaginatedResponse`) + `PaginationControls` (islands/ui) + DTO backend com envelope `{data,total,page,totalPages,limit}` (decisão 12) |
| Validar host/URL com `startsWith("https://api.github.com")` | `isAllowedHost` (`src/lib/analytics.ts`) — parsing real (`new URL`), protocolo `https:` + hostname exato (CodeQL js/incomplete-url-substring-sanitization) |
| Notas/avisos em HTML cru nas trilhas e blog | Admonitions `:::info[Título]` … `:::` (`src/lib/remark-admonitions.ts`, decisão 13) |

---

## Git Workflow & Deployment

### Branches

| Branch | Deploys to | URL |
|--------|-----------|-----|
| `main` | Produção — 4 projetos Cloudflare Pages (`codaqui`, `tisocial`, `elasnocodigo`, `devparana`) | https://codaqui.dev (+ domínios dos tenants) |
| `develop` | Branch deployment no Cloudflare Pages (preview `*.pages.dev`) | homologação |

### CI/CD (`.github/workflows/` — 9 workflows)

| Workflow | Quando | O que faz |
|----------|--------|-----------|
| `deploy-astro.yml` | push em `main`/`develop` + dispatch | Build matrix (codaqui + 3 tenants) + gate `tenant-urls` + direct upload Wrangler p/ cada projeto Pages |
| `pr-check.yml` | PR → `develop`/`main` | Backend (build + jest coverage), Trivy (frontend + backend), builds Astro dos 4 projetos, `astro check` + vitest do codaqui |
| `publish-backend.yml` | manual | Build + push da imagem Docker multi-arch (amd64 + arm64/v8) p/ GHCR + release `v<versão>-backend` (usa `version` do `backend/package.json`); redeploy em produção manual no Coolify |
| `sync-event-snapshots.yml` | horário (`0 * * * *`) + dispatch | Regera `static/events/` e commita |
| `sync-community-snapshots.yml` | horário (`7 * * * *`) + dispatch | Lê `/communities/public`, regera `static/communities/index.json` e commita somente se mudou |
| `sync-assemblies.yml` | diário 06:23 UTC (`23 6 * * *`) + dispatch | Lê `/assemblies/public`, regera `static/assemblies/index.json` e commita somente se mudou |
| `sync-social-stats.yml` | diário 06:00 + dispatch | Regera `static/social-stats/` |
| `sync-analytics.yml` | diário 06:30 + dispatch | Regera `static/analytics/` |
| `sync-member-badges.yml` | diário 06:17 UTC (`17 6 * * *`) + dispatch | Lê `/hours/public`, sincroniza `static/badges/` e commita somente se mudou; sync inicial é gate antes do frontend |

### Commit Convention

```
feat(fase-0.x): descreve a mudança
fix(fase-0.x): corrige o bug
docs(fase-0.x): atualiza documentação
```

(escopo opcional; semver de backend via `version` em `backend/package.json`)

### Contribution Flow

1. Create branch from `develop`: `feat/nome` or `fix/nome`
2. Rode os gates (`make astro-verify` + `make astro-verify-tenants`; backend se aplicável)
3. Open PR targeting `develop` → `pr-check.yml` valida
4. Review → merge → branch deployment de homologação
5. Após validação, merge `develop` → `main` → produção

---

## PR Checklist

Antes de submeter:

- [ ] `make astro-verify` passa (build codaqui completo + paridade de URLs)
- [ ] `make astro-verify-tenants` passa (se tocou em `tenants.config.mjs`, layouts, lib compartilhada ou conteúdo de comunidade)
- [ ] `cd backend && npm run build && npx jest --silent` (se mexeu em `backend/`) + **bump de `version`** em `backend/package.json`
- [ ] `npm run test:scripts` (se mexeu em `scripts/*.mjs`)
- [ ] Listagens novas seguem o padrão de paginação (`pagination.ts` + `PaginationControls` + DTO backend — decisão 12)
- [ ] Blog posts novos usam `slug: YYYY/MM/DD/nome` no frontmatter
- [ ] Mudanças em conteúdo canônico foram feitas em `blog/`/`trilhas/` (não nas cópias em `frontend/src/content/`)
- [ ] Data changes em `frontend/src/data/*.ts`, não inline em páginas
- [ ] Social URLs importados de `frontend/src/data/social.ts`
- [ ] Zero hex solto — tokens `--cq-*` / tema MUI
- [ ] MUI v9: `slotProps` + `sx` (sem system props); Grid com `size={{ xs, sm, md }}`
- [ ] Redirect novo de URL legada vai no `build-tenant-redirects.mjs` (não em página-sombra)
- [ ] Imagens otimizadas (máx ~500KB; SVG para logos, JPG/PNG para fotos)
- [ ] Links externos com `target="_blank" rel="noopener noreferrer"`
- [ ] Avatares/imagens com `alt`
- [ ] IconButtons com `aria-label`
- [ ] Hierarquia de headings correta (h1 → h2 → h3, sem pular)
- [ ] Linguagem inclusiva: "participantes", "programa", "encontros", "Associação"
- [ ] Nenhum segredo commitado (templates vivem em `.env.example`)
- [ ] Tenant novo: `tenants.config.mjs` + matrix dos workflows + runbook do [DEVELOPMENT.md](./DEVELOPMENT.md)

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Blog post | `blog/YYYY-MM-DD-slug.md` | `blog/2024-07-22-welcome.md` |
| Blog image | `blog/img/YYYY-MM-DD-slug/` | `blog/img/2024-07-22-welcome/hero.png` |
| Página Astro | `frontend/src/pages/nome.astro` ou `frontend/src/pages/<dir>/[...slug].astro` | `frontend/src/pages/sobre/equipe.astro` |
| Layout Astro | `frontend/src/layouts/NomeLayout.astro` | `frontend/src/layouts/PublicLayout.astro` |
| Componente de servidor | `frontend/src/components/astro/Nome.astro` | `frontend/src/components/astro/EventCard.astro` |
| Ilha React | `frontend/src/components/islands/NomeIsland.tsx` | `frontend/src/components/islands/ThemeToggle.tsx` |
| Lib (lógica pura) | `frontend/src/lib/nome.ts` (+ `nome.test.ts`) | `frontend/src/lib/event-path.ts` |
| Data file | `frontend/src/data/nome.ts` | `frontend/src/data/team.ts` |
| Script de build/sync | `frontend/scripts/nome.mjs` / `scripts/nome.mjs` | `frontend/scripts/copy-content.mjs` |
| Static asset | `static/img/description.ext` | `static/img/og-codaqui.jpg` |

---

## About Codaqui

Codaqui is a **Brazilian non-profit association** (not a school or company) that democratizes technology education for youth. It serves as an umbrella for partner tech communities.

- **Branding**: "Associação Codaqui" — never "escola" or "empresa"
- **Language**: "participantes" (not "alunos"), "programa" (not "curso"), "encontros" (not "aulas")
- **Values**: Transparency, inclusion, collaboration, collective growth
- **License**: Creative Commons Attribution-ShareAlike
- **Contact**: contato@codaqui.dev
- **Communities**: DevParaná, Elas no Código, CamposTech, T.I. Social, Cloud Native Maringá

### Social

| Platform | Handle |
|----------|--------|
| GitHub | [@codaqui](https://github.com/codaqui) |
| Discord | [Server](https://discord.com/invite/xuTtxqCPpz) |
| WhatsApp | [Group](https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up) |
| Instagram | [@codaqui.dev](https://instagram.com/codaqui.dev) |
| LinkedIn | [codaqui](https://www.linkedin.com/company/codaqui) |
| Twitter/X | [@codaquidev](https://twitter.com/codaquidev) |
| YouTube | [@codaqui](https://youtube.com/@codaqui) |

---

## Regular Maintenance

| What | When | Where |
|------|------|-------|
| Team changes | As needed | `frontend/src/data/team.ts` |
| New community partners | As needed | API `/communities` + responsible por designation + `npm run sync:communities`; social stats em `scripts/sync-social-stats.mjs` + `social-stats.config.json` |
| Community registry changes | As needed | Admin/API → `npm run sync:communities` → novo build; não editar o snapshot |
| Assembly Discussions e documentos | As needed, operação manual | Categoria Assembleias + título igual ao pathname; cadastro em `/admin/assembleias`; narrativa no GitHub; PDF/cartório por admin → `npm run sync:assemblies` → novo build |
| Timeline events | Annually | `frontend/src/data/timeline.ts` |
| Social links (WhatsApp expires) | When links change | `frontend/src/data/social.ts` (canônico — também lido pelo `sync-social-stats.mjs`) |
| Manual follower counts (YouTube/Instagram) | When updated | `frontend/src/data/social.ts` + `frontend/src/data/communities.ts` (`baselineCount`) |
| Event sources/fallbacks | As needed | `events.config.json` |
| Event snapshots sync | Automatic (hourly workflow) | `static/events/` via `sync-event-snapshots.yml` |
| Community snapshots sync | Automatic (hourly, minute 7) | `static/communities/` via `sync-community-snapshots.yml` |
| Assembly snapshots sync | Automatic (06:23 UTC daily) + dispatch | `scripts/sync-assemblies.mjs` → `static/assemblies/` via `sync-assemblies.yml` |
| Social stats sync (Discord/Meetup/GitHub) | Automatic (06:00 daily) | `static/social-stats/` via `sync-social-stats.yml` |
| Analytics sync | Automatic (06:30 daily) | `static/analytics/` via `sync-analytics.yml` |
| Member badges sync | Automatic (06:17 UTC daily) + dispatch; sync inicial obrigatório antes do frontend | `scripts/sync-member-badges.mjs` → `static/badges/` via `sync-member-badges.yml`; backend publicado primeiro, sem SVGs reais no branch |
| New tenant onboarding | As needed | `frontend/tenants.config.mjs` + matrix dos workflows + runbook do [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Dependencies | Quarterly | `frontend/package.json` → `npm update` |

---

## Multi-tenant communities

Os sites whitelabel das comunidades parceiras são servidos por **build matrix no Cloudflare Pages** (Fase 0.5): um projeto Pages por tenant — fonte única em `frontend/tenants.config.mjs` (`tisocial`, `elasnocodigo`, `devparana`) — com rotas limpas em `/` via `TENANT=<slug>` trocando o `srcDir` do app Astro em build-time, e proxy de API/login via **Pages Function** (`frontend/functions/[[path]].ts`).

> Operação, gates (R7), runbook de DNS/secrets e gaps conhecidos (`*.pages.dev`, symlinks no Windows): [DEVELOPMENT.md](./DEVELOPMENT.md) → "Multi-tenant (Fase 0.5)". Onde vive cada peça de conteúdo, checklist para nova comunidade e anti-patterns: [docs/modules/community/COMMUNITY_SITES.md](docs/modules/community/COMMUNITY_SITES.md).

---

## Insights & Social Stats

A página `/sobre/insights` agrega quatro módulos: **live stats bar**, **presença digital**, **comunidades parceiras** e a **linha do tempo** (timeline).

> Detalhes completos — fontes de dados, schema do snapshot, atualização manual e workflow de sync — estão em [docs/modules/insights/SOCIAL_STATS.md](docs/modules/insights/SOCIAL_STATS.md).

---

## References

- [Astro docs](https://docs.astro.build/)
- [MUI v9 Components](https://mui.com/material-ui/all-components/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/) · [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Giscus](https://giscus.app/)
- [GitHub Discussions](https://github.com/codaqui/institucional/discussions)
