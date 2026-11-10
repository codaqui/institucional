<!-- AGENT-INDEX
purpose: Setup, environment variables, migrations and deploy procedures for the monorepo.
audience: Developers running the project locally, DevOps, AI agents needing operational details.
status: Atualizado pós-Fase 0.6 — o app Docusaurus foi removido; o site oficial é o app Astro em frontend/ (Cloudflare Pages).
sections:
  - Arquitetura do Monorepo
  - Frontend (Astro) — app oficial em frontend/: setup, comandos, convenções, syncs
  - Multi-tenant (Fase 0.5) — sites whitelabel das comunidades no Cloudflare Pages: gates e runbook de operação
  - Backend (NestJS) — npm scripts, Stripe CLI for webhooks
  - Full Stack (Frontend + Backend + Infra) — Podman Compose
  - Migrations (TypeORM) — generate/run/revert
  - Variáveis de Ambiente — .env reference
  - Deploy — Cloudflare Pages (automático) + backend ARM64 (manual) + runbook de cutover do codaqui.dev (Fase 0.6)
  - Git: merge de main no branch de feature
  - Convenção de Commits
related-docs:
  - AGENTS.md — architecture decisions, patterns, anti-patterns
  - README.md — high-level overview
agent-protocol: All operational/setup commands live HERE — AGENTS.md only references this file. If user asks "how do I run X?" check this first.
-->

# Development Guide

> Manual técnico para desenvolvedores do monorepo Codaqui.
> Para visão geral do projeto, veja o [README.md](./README.md).
> Para padrões de código e convenções, veja o [AGENTS.md](./AGENTS.md).

---

## Arquitetura do Monorepo

| Camada | Diretório | Serve via |
|--------|-----------|-----------|
| **Frontend** (Astro) | `frontend/` | Cloudflare Pages (CI) · `make up` (Compose :3000) · `make astro-dev` (dev :4321) |
| **Backend** (NestJS) | `backend/` | Podman Compose (local + produção ARM64) |
| **Infra** | `compose.yaml` / `compose.prod.yaml` | Podman Compose |

O site é o app Astro em `frontend/` — o Docusaurus da raiz foi removido na Fase 0.6.
O conteúdo canônico de blog/trilhas continua na raiz (`blog/`, `trilhas/`) e é copiado
para dentro do app em build-time (`frontend/scripts/copy-content.mjs`, via `predev`/`prebuild`);
os snapshots de `static/` idem (`copy-snapshots.mjs`). Nunca edite as cópias em
`frontend/src/content/` — edite as fontes.

O `package.json` da raiz é mínimo: só os scripts `astro:*`, `sync:*` e `test:scripts`,
com devDependencies leves (`playwright` + `wrangler`) usadas pelos syncs e pelo deploy.
Dependências de verdade vivem em `frontend/package.json` e `backend/package.json`.

---

## Frontend (Astro)

**Quando usar:** editar páginas, blog, trilhas, componentes, dados, estilos ou tokens do
design system. Não precisa de Podman nem do backend.

### Setup

```bash
cd frontend
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev            # → http://localhost:4321
```

Ou, da raiz (após `make setup`): `make astro-dev`.

Variáveis do app Astro (prefixo `PUBLIC_*`, embutidas no bundle cliente em build time):

| Variável | Descrição |
|----------|-----------|
| `PUBLIC_API_URL` | URL base da API NestJS (default `http://localhost:3001`) |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave pública Stripe (`pk_test_...` em dev) usada pelo checkout embutido de `/participe/apoiar`. Vazia desativa o botão de doação |
| `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` | ID público da categoria Reuniões do GitHub Discussions, embutido no build para Giscus por `pathname`. Vazia mantém link/fallback estático; não é segredo |

O CORS do backend já aceita qualquer `localhost:<porta>` — nenhuma configuração extra.
Login GitHub funciona ponta a ponta com o backend local rodando (`compose.yaml`, porta 3001).

### Comandos

Dentro de `frontend/`:

```bash
npm run dev        # dev server (:4321) — copia conteúdo/snapshots antes (predev)
npm run build      # build estático em dist/ — copia antes (prebuild)
npm run preview    # serve o build localmente
npm run check      # astro check (tipos de .astro)
npm run test       # vitest (libs e contratos)
```

Pela raiz, via Makefile:

```bash
make astro-dev             # dev server
make astro-build           # build estático (dist/)
make astro-check           # astro check
make astro-test            # vitest
make astro-verify          # verificação completa: build + check + test + type-check da
                           # Pages Function + smoke do dist/ + gate de paridade de URLs
make astro-verify-tenants  # 4 builds (codaqui + 3 tenants) + gate de allow-list de URLs
                           # por tenant — ver "Multi-tenant (Fase 0.5)"
make astro-lighthouse      # Lighthouse mobile nas páginas principais (requer Chrome)
make astro-preview         # serve o build (:4321)
```

`make astro-verify` inclui o **gate de paridade de URLs** (`frontend/scripts/diff-urls.mjs`):
cada URL pública da referência versionada `frontend/scripts/url-reference.json` precisa
existir no `frontend/dist/` (como página ou redirect). A referência é um snapshot do build
final do Docusaurus, gerado antes da remoção dele — **não é regenerável**; se o gate
reclamar de uma divergência legítima, ajuste a decisão de URL com o time (e o redirect em
`frontend/scripts/build-tenant-redirects.mjs`), não a referência.

### O que editar sem o backend

| O que | Onde |
|-------|------|
| Blog posts | `blog/YYYY-MM-DD-slug.md` (fonte canônica) |
| Trilhas | `trilhas/python/` ou `trilhas/github/` (fonte canônica) |
| Páginas | `frontend/src/pages/` |
| Componentes (Astro/React) | `frontend/src/components/` |
| Dados das listas (equipe, comunidades, projetos, timeline, social) | `frontend/src/data/` (canônico — os syncs da raiz leem destes mesmos arquivos) |
| Tokens do design system | `frontend/src/styles/tokens.css` |
| Estilos globais | `frontend/src/styles/global.css` |

### Sync de dados estáticos

Scripts na raiz que buscam dados externos e gravam snapshots em `static/` — sem expor
chaves ao browser. Dependências leves da raiz (`npm install` na raiz é suficiente).

| Comando | O que faz |
|---------|-----------|
| `npm run sync:events` | Eventos (Discord + Meetup + internal) → `static/events/` |
| `npm run sync:events:full` | Re-pagina todos os eventos passados |
| `npm run sync:social` | Contagens de membros/seguidores → `static/social-stats/index.json` |
| `npm run sync:analytics` | Analytics → `static/analytics/` |
| `npm run sync:analytics:full` | Re-pagina todo o histórico de analytics |
| `npm run sync:communities` | `GET /communities/public` → `static/communities/index.json` (rename atômico) |
| `npm run sync:assemblies` | `GET /assemblies/public` → `static/assemblies/index.json` (validação completa + rename atômico) |
| `npm run sync:universities` | `GET /universities/public` → `static/universities/index.json` (validação completa + rename atômico) |
| `npm run sync:mentors` | `GET /mentorship/public` → `static/mentors/index.json` (perfis públicos + insights agregados, validação completa + rename atômico) |
| `npm run sync:company-badges` | `GET /companies/badges/public` → `static/badges/empresas/<uuid>.svg` (somente selos vigentes, escrita atômica) |
| `npm run sync` | `sync:events` + `sync:social` + `sync:analytics` em sequência |
| `npm run sync:full` | Versão completa (full) de todos os syncs |
| `npm run test:scripts` | Testes dos scripts de sync/validação (`node --test`) |

> **`make sync-events` (recomendado em dev):** igual ao `npm run sync:events`, mas exporta
> `INTERNAL_EVENTS_API_URL=http://localhost:3001` para a fonte `internal:codaqui` (eventos
> próprios publicados no Postgres) ser resolvida do backend dev — sem isso o sync cai no
> fallback do último snapshot em disco.

Para comunidades, `COMMUNITIES_API_URL` define a base da API (default `http://localhost:3001`).
O sync filtra novamente `status=active`, preserva o shape legado e não altera `generatedAt`
quando os dados permanecem iguais. O workflow `sync-community-snapshots.yml` roda a cada hora
no minuto 7 e por dispatch. **O agregador `npm run sync` não inclui comunidades**; rode o sync
específico quando alterar esse registro.

Para assembleias, `ASSEMBLIES_API_URL` define a base da API (default `http://localhost:3001`).
O sync valida todos os registros e invariantes, preserva o snapshot anterior em falha e mantém
`generatedAt` quando os dados não mudam. O workflow `sync-assemblies.yml` roda diariamente às
06:23 UTC e por dispatch. **O agregador `npm run sync` não inclui assembleias**; mudanças no
registro exigem esse sync e um novo build para alterar `/assembleias`.

Para o Universitário, `UNIVERSITIES_API_URL` define a base da API (default `http://localhost:3001`).
O sync valida a coleção completa, rejeita motivação/e-mail/candidaturas e preserva o snapshot anterior
em falha. O workflow `sync-universities.yml` roda diariamente às 06:26 UTC e por dispatch. **O agregador
`npm run sync` não inclui o Universitário**; mudanças públicas exigem sync e novo build de `/universitario`.

Para mentoria, `MENTORS_API_URL` define a base da API (default `http://localhost:3001`). O sync rejeita
campos fora da projeção pública e preserva o snapshot anterior em falha. O workflow `sync-mentors.yml`
roda diariamente às 06:21 UTC e por dispatch, fora do agregador `npm run sync`. O UUID público é o do
perfil de mentoria; membros, aprovadores, mentorandos e sessões individuais nunca entram no snapshot.

Para selos de empresas, `COMPANY_BADGES_API_URL` define a base da API (default `http://localhost:3001`).
O sync rejeita qualquer campo fora da projeção pública, escreve `static/badges/empresas/<uuid>.svg`
atomicamente e restaura os arquivos anteriores em falha. O workflow `sync-company-badges.yml` roda
diariamente às 06:19 UTC e por dispatch, fora do agregador `npm run sync`.

**Secret necessário:** `DISCORD_BOT_TOKEN` — sem ele os scripts preservam os snapshots existentes.

Pela raiz, `make sync`, `make sync-events`, `make sync-events-full`, `make sync-social`, `make sync-analytics`, `make sync-communities`, `make sync-assemblies`, `make sync-mentors` e `make sync-company-badges` espelham os comandos da tabela.

### Operação manual de Assembleias (Fase 3)

A [ADR 014](docs/adrs/014-assemblies.md) é a referência de contratos e limites. A operação da
Discussion e do Giscus é deliberadamente manual:

1. Use a categoria **Reuniões** já existente em `codaqui/institucional`, com ID público
   `DIC_kwDOG9s0Ns4CxJVR`. Para conferir as categorias atuais:

   ```bash
   gh api graphql -f query='query { repository(owner:"codaqui",name:"institucional") { discussionCategories(first:50) { nodes { id name } } } }'
   ```

2. A Variable `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` já está configurada no GitHub Actions. Para
   desenvolvimento local, use o mesmo ID quando quiser testar os comentários integrados. Sem o ID,
   o detalhe mantém o link da Discussion e informa que os comentários integrados estão pendentes;
   o blog continua na categoria Blog e `og:title`.
3. Antes de cada cadastro, coordene o próximo número do tipo com um único operador. Crie a
   Discussion na categoria Reuniões com título exatamente `/assembleias/<type>-<number>` e
   cadastre imediatamente sua URL em `/admin/assembleias`. O banco atribui o número sob lock, mas
   não reserva a Discussion externa: evite criações simultâneas do mesmo tipo nesse passo e
   confira o slug retornado. A API valida o formato/repositório da URL, não a categoria ou título.
4. Mantenha pauta detalhada, quórum, votos, ata narrativa e comentários na Discussion. No banco e
   no admin, grave somente o resumo e os metadados. Tipo, número, slug e Discussion não mudam após
   a criação; cancelamento preserva a transparência pública.
5. Para realizar uma assembleia oficial, um admin informa `heldAt`, URL HTTPS do PDF em host
   aceito pelo `StorageService` e livro/página/data do cartório. Não há upload nem automação de
   cartório. Diretores ativos podem criar/editar, mas não alterar dados cartorários.
6. Depois do redeploy do backend e da confirmação da migration 036, rode o sync inicial antes do
   frontend. Crie Discussions reais para a validação e confira o Giscus com `mapping="pathname"`
   e a categoria Reuniões. Fallback estático e testes não substituem essa verificação.

Comentários e reações ficam no GitHub, fora do PostgreSQL e do snapshot. A retenção operacional do
backend não os remove; moderação, exportação e exclusão seguem o GitHub. Remover ou renomear uma
Discussion pode quebrar o vínculo e o histórico exibido.

### Convenções do app Astro

- Tokens do Design System (`--cq-*`) em `src/styles/tokens.css` são a fonte única — Tailwind (`@theme inline` em `global.css`) e MUI (`src/lib/mui-theme.ts`) consomem deles. Nunca hardcode de hex.
- Cor de marca `#57B593` é só decoração; cor acionável é `#378369` (claro) / `#89CBB3` (escuro).
- Ilhas React: `client:load` (vivo no primeiro paint), `client:visible` (abaixo da dobra), `client:only="react"` (páginas app com auth). O padrão é zero JS.
- Autenticação: `src/lib/auth-client.ts` (puro) + `src/lib/use-auth.ts` (hook) — cookie httpOnly assinado pelo backend.
- Conteúdo blog/trilhas: `blog/` e `trilhas/` da raiz são as fontes canônicas; o Astro consome cópias geradas em build-time por `scripts/copy-content.mjs` (nunca edite `frontend/src/content/` direto).
- Autores do blog: a fonte canônica é `blog/authors.yml`; ao alterá-la, replique a mudança manualmente em `frontend/src/data/blog-authors.ts` (o comentário no topo do arquivo aponta para cá).

---

## Multi-tenant (Fase 0.5)

**Quando usar:** operar os sites whitelabel das comunidades (T.I. Social, Elas no Código, DevParaná), servidos por **Cloudflare Pages** a partir do mesmo app Astro em `frontend/`. Arquitetura e decisões: [docs/superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md](docs/superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md) e [ADR 004](docs/adrs/004-multisite-communities.md).

### Como funciona

- `TENANT=<slug>` em build-time troca o `srcDir` para `frontend/src-tenants/<slug>/` — rotas limpas (`/`, `/apoiar`, `/transparencia`, `/equipe`, `/blog`, `/docs`) com o tema/nav da comunidade. **Build codaqui = sem `TENANT`** (srcDir padrão `./src`, portal completo).
- `frontend/tenants.config.mjs` é a fonte única dos tenants (slug, domínio `site`, nome do projeto Pages). O matrix do workflow `.github/workflows/deploy-astro.yml` espelha essa lista **mais o build codaqui** (`{ tenant: "", project: "codaqui" }`).
- Cada build de tenant grava `dist/_redirects` com 301 de `/comunidades/<slug>[/*]` para `[/][:splat]` — links antigos do portal continuam funcionando no domínio próprio.
- Gate local: `make astro-verify-tenants` — 4 builds (codaqui + 3 tenants) + allow-list de URLs por tenant (`frontend/scripts/tenant-urls.mjs`).
- **R7 — `astro check` NÃO é gate em modo tenant:** páginas codaqui sob srcDir de tenant têm 62 erros pré-existentes (limitação do `getCollection`). Gates por build: codaqui = build + `astro check` + testes + `diff-urls` (`make astro-verify`); tenant = build + `tenant-urls`.

### Runbook de operação

**Estado (2026-10-27):** os 3 domínios das comunidades (tisocial.org.br, elasnocodigo.com.br, devparana.org) **já foram migrados para o Cloudflare Pages** e os Workers correspondentes excluídos — a pasta `workers/` foi removida do repo. O projeto `codaqui` também já recebe deploys no Pages; o cutover de DNS de `codaqui.dev` (GitHub Pages → Pages) é a **Fase 0.6** — runbook em [Deploy → Cutover codaqui.dev (Fase 0.6)](#cutover-codaquidev-fase-06).

Referência para operar e manter os sites tenant:

1. **Projetos Pages** — `codaqui`, `tisocial`, `elasnocodigo`, `devparana` (o matrix do workflow `.github/workflows/deploy-astro.yml` tem uma entrada por build, incluindo `{ tenant: "", project: codaqui }` para o build sem `TENANT`; os nomes dos 3 projetos tenant vêm de `tenants.config.mjs` → `project`). O `wrangler pages deploy` **não** cria projeto automaticamente — sem criar antes, o deploy falha com "project not found". Para criar um projeto novo:

   ```bash
   npx wrangler pages project create <project> --production-branch=main
   ```

   (Ou via dashboard Cloudflare → Workers & Pages → Create → Pages.)

2. **Secrets do repositório** (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (escopo mínimo *Cloudflare Pages:Edit* no account) + `CLOUDFLARE_ACCOUNT_ID` — ver tabela na seção [Deploy](#secrets-e-variáveis-do-github-actions).

3. **Cutover de DNS de um domínio tenant** (registro histórico da migração dos 3 tenants, 2026-10-27):
   1. Remover a rota/custom domain do Worker legado (dashboard Cloudflare → Workers & Pages → `<worker>` → Settings → Domains & Routes / Triggers).
   2. Apontar o domínio para o projeto Pages: **apex** → registro CNAME para `<project>.pages.dev` (a Cloudflare faz flattening de CNAME em apex); **subdomínios wildcard** `*.<domínio>` conforme necessário.
   3. Aguardar o SSL universal do edge (em geral minutos).

4. **Verificação pós-deploy:**
   - `/` serve a home do tenant (não um redirect);
   - `/blog` lista os posts (tisocial);
   - login via doação >R$100 (handoff cross-domain para codaqui.dev) e doação Stripe embutida funcionando;
   - `/comunidades/<slug>/*` → 301 para `/*` (regras do `dist/_redirects`).

5. **Rollback de DNS (emergência):** apontar o DNS de volta para o serviço anterior e, se ainda for o caso do Worker legado, restaurá-lo do histórico do git:

   ```bash
   git checkout <sha-antes-da-remoção> -- workers/
   npx wrangler deploy --config workers/<slug>/wrangler.toml
   ```

### Gaps conhecidos

- **Previews `*.pages.dev`:** builds de preview (`<branch>.<project>.pages.dev`) caem no fallback `codaqui.dev` nos redirects de login/doação (gap `*.pages.dev` — fora de escopo da fase).
- **Windows:** os `src-tenants/<slug>/content` são symlinks — ative `git config core.symlinks true` (global ou no repo) antes de clonar, ou reponha os symlinks após o clone.

---

## Backend (NestJS)

**Quando usar:** desenvolver ou depurar endpoints, integração Stripe, módulo de Ledger ou lógica server-side.

### Setup (sem Podman)

```bash
cd backend
npm install
npm run start:dev   # Watch mode → http://localhost:3000
```

Para ter um banco disponível sem subir tudo:

```bash
make db-up   # Sobe apenas o PostgreSQL e aguarda estar pronto
```

Configure as variáveis no `.env` da raiz (veja [Variáveis de Ambiente](#variáveis-de-ambiente)):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=codaqui
DB_PASSWORD=codaqui_pass
DB_NAME=codaqui_db
```

### Build

```bash
cd backend
npm run build   # Compila → dist/
```

> Sempre rode antes de abrir um PR que altere o backend.

Pela raiz, os atalhos `make backend-start`, `make backend-build`, `make backend-test` e `make backend-lint` equivalem aos comandos acima.

### Módulos e Endpoints

| Módulo | Endpoints principais | Descrição |
|--------|---------------------|-----------|
| `LedgerModule` | `GET /ledger/community-balances` · `GET /ledger/accounts` · `GET /ledger/accounts/:id/transactions` · `GET /ledger/accounts/:id/transactions/export` · `GET /ledger/transactions/export` · `POST /ledger/accounts` · `POST /ledger/transactions` | Double-entry, filtros `from`/`to` e CSV server-side com BOM e proteção contra formula injection. Exportação por conta é pública; todas as contas exige admin/finance-analyzer. |
| `StripeModule` | `POST /stripe/checkout-session` · `POST /stripe/webhook` · `GET /stripe/my-donations` · `GET /stripe/my-subscriptions` · `DELETE /stripe/subscriptions/:id` | Pagamentos. Doação direcionada exige comunidade Integrada ativa; `tesouro-geral` e CamposTech continuam aceitos. |
| `AuthModule` | `GET /auth/github` · `GET /auth/github/callback` · `GET /auth/me` · `GET /auth/logout` | Autenticação via GitHub OAuth + JWT. |
| `MembersModule` | `GET /members` · `GET /members/:id` · `GET /members/me` · `PUT /members/me` · `GET /admin/members` · `PATCH /admin/members/:id` | Perfis. Roles derivadas por designations não podem ser editadas manualmente. |
| `DesignationsModule` | `GET /designations/me` · `POST /designations` · `POST /designations/:id/confirm` · `POST /designations/:id/revoke` | Fonte única dos vínculos novos; escritas admin sincronizam `diretor`, `voluntario`, `mentor` e `gestor_universitario`. |
| `DirectoratesModule` | `GET /directorates/public` · `GET /directorates/manage` · `POST /directorates` · `PATCH /directorates/:id` | Diretor edita somente a diretoria de sua designation ativa; admin tem acesso global. |
| `CommunitiesModule` | `GET /communities/public` · `GET /communities/manage` · `POST /communities` · `PATCH /communities/:id` · `POST /communities/:id/seal/request` · `POST /communities/:id/seal` | Seis seeds (4 Integradas/2 Parceiras), responsible por designation e selo admin com avaliação/validade. |
| `NotificationsModule` | `GET /notifications/status` · `GET /notifications/emails` · `POST /notifications/emails/:id/resend` · templates/preview/test | Logs `sent`/`failed`/`skipped`, summary por template e reenvio do mesmo log; SMTP ausente não conta como falha. |
| `SettingsModule` | `GET /settings/audit-retention` · `PUT /settings/audit-retention` | Admin; retenção operacional de 7–365 dias, com precedência sobre o fallback de ambiente. |
| `ReimbursementsModule` | `POST /reimbursements` · `GET /reimbursements` · `GET /reimbursements/my` · `GET /reimbursements/public/:id` · `PATCH /reimbursements/:id/approve` · `PATCH /reimbursements/:id/reject` | Solicitações de reembolso com fluxo de aprovação. |
| `TransfersModule` | `POST /account-transfers` · `GET /account-transfers` · `PATCH /account-transfers/:id/approve` · `PATCH /account-transfers/:id/reject` | Transferências entre contas do Ledger. |
| `ExpensesModule` | `POST /expenses` · `GET /expenses` · `GET /expenses/:id` · `POST /expenses/:id/approve` · `POST /expenses/:id/pay` | Gestão de despesas organizacionais. |
| `StorageModule` | `POST /storage/validate-receipt-url` | Valida URLs de comprovante: exige HTTPS e hostname em allowlist (Google Drive/Docs, Dropbox, OneDrive/1drv.ms, Imgur). Os arquivos ficam nos serviços confiáveis (upload manual pelo time); o backend não usa S3/MinIO/disco. |
| `AuditModule` | `GET /audit/logs` · `POST /audit/cleanup` | Logs de governo permanentes e sem IP; somente operacionais expiram pela política efetiva. |

Desde a Fase 2, `POST /events/public/guest-claim` usa `TurnstileGuard`. O widget depende de `PUBLIC_TURNSTILE_SITE_KEY` no build, alimentada por `TURNSTILE_SITE_KEY` no ambiente local/Actions (o alias público continua aceito); o backend exige `TURNSTILE_SECRET` e restringe hostname/ação `guest_claim` por `TURNSTILE_HOSTNAMES`. Os nomes `TURNSTILE_SECRET_KEY` e `TURNSTILE_ALLOWED_HOSTNAMES` permanecem como fallback legado. O token `development` é aceito somente fora de produção, com aviso e sem secret configurado; produção sem secret falha fechada e nunca simula sucesso. Após uma recusa, o formulário permanece disponível e o widget é resetado para emitir um token novo.

### Swagger / OpenAPI

Disponível em `http://localhost:3000/docs` (sem containers) ou `http://localhost:3001/docs` (via Compose). Desabilitado em produção por padrão — para habilitar: `SWAGGER_ENABLED=true`.

O JSON do spec (`GET /docs-json`) é servido **sempre, inclusive em produção** (fora do guard `SWAGGER_ENABLED`): ele alimenta a página pública [`/desenvolvedores/api`](frontend/src/pages/desenvolvedores/api.astro) do site (Swagger UI embarcada via `ApiDocsIsland`, code-split só nessa rota — ver decisão 14 do `AGENTS.md`).

### Webhook do Stripe

**Em desenvolvimento** — o `make up` sobe o Stripe CLI como container e captura o secret automaticamente. Ou rode manualmente:

```bash
# Instale a CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3001/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,invoice.payment_succeeded,charge.refunded,charge.succeeded,charge.updated,customer.subscription.deleted,customer.subscription.updated
# A CLI imprime o STRIPE_WEBHOOK_SECRET temporário — cole no .env
```

**Em produção** — registre o endpoint no dashboard do Stripe:

1. Acesse [dashboard.stripe.com → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **"Add endpoint"**
3. URL: `https://api.codaqui.dev/stripe/webhook`
4. Eventos a ouvir: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.payment_succeeded`, `charge.refunded`, `charge.succeeded`, `charge.updated`, `customer.subscription.deleted`, `customer.subscription.updated`
5. Copie o **Signing secret** (`whsec_...`) gerado e defina como `STRIPE_WEBHOOK_SECRET` no servidor de produção

---

## Full Stack (Frontend + Backend + Infra)

**Quando usar:** funcionalidades que dependem da integração entre site e backend (ex: transparência financeira, formulário de doações, login).

### Setup

```bash
make setup   # Cria .env a partir de .env.example e instala dependências
```

Edite o `.env` gerado com suas credenciais, depois:

```bash
make up   # Sobe Astro + backend + banco + Stripe CLI (captura o STRIPE_WEBHOOK_SECRET)
```

O Compose padroniza o frontend em `http://localhost:3000` e o backend em `http://localhost:3001`, com callbacks OAuth coerentes com essas URLs. O Astro roda com hot reload; o monorepo é montado no container e as dependências ficam no volume `frontend_node_modules`. Não é necessário abrir outro terminal. Para rodar o Astro fora do Compose, `make astro-dev` continua disponível em `http://localhost:4321`.

Para usar HTTPS local, rode `make setup-https` antes do `make up`. O target gera os certificados com `mkcert` e ajusta `HTTPS`, `BACKEND_URL`, `FRONTEND_URL`, `PUBLIC_API_URL` e `STRIPE_FORWARD_URL` no `.env`; o site passa para `https://localhost:3000` e a API para `https://localhost:3001`, sem editar as URLs manualmente. Atualize também o callback do GitHub OAuth App para `https://localhost:3001/auth/github/callback`: o valor cadastrado precisa corresponder ao `BACKEND_URL` ativo (HTTP ou HTTPS).

### Serviços (DEV)

| Serviço | URL |
|---------|-----|
| App Astro (Compose) | http://localhost:3000 ou https://localhost:3000 |
| Backend NestJS | http://localhost:3001 ou https://localhost:3001 |
| Backend Swagger UI | http://localhost:3001/docs ou https://localhost:3001/docs |
| PostgreSQL | localhost:5432 |
| Stripe CLI | (sem UI — use `make logs SERVICE=stripe-cli`) |

### Comandos úteis do Makefile

```bash
make up              # Sobe tudo (captura Stripe secret automaticamente)
make down            # Para e remove containers
make logs            # Logs de todos os serviços em tempo real
make logs SERVICE=backend   # Logs só do backend
make restart SERVICE=backend  # Reinicia apenas o backend
make ps              # Status dos containers
make db-shell        # Shell psql direto no container
```

---

## Migrations (TypeORM)

O nome é gerado automaticamente no formato `MigrationNNN_YYYYMMDD`. PostgreSQL precisa estar rodando.

```bash
make db-up              # Sobe o PostgreSQL (se ainda não estiver rodando)
make migration-generate # Gera uma nova migration (auto-nomeada)
make migration-run      # Executa migrations pendentes
make migration-revert   # Reverte a última migration aplicada
make migration-show     # Lista todas as migrations e seus status
```

Para validar um dump em um banco isolado, crie o banco de destino e passe `DB_NAME` explicitamente: `make db-restore-prod DUMP=pg_dump/arquivo.dmp DB_NAME=codaqui_test && make migration-run DB_NAME=codaqui_test`. A restauração recria o schema `public` do banco informado; confira o nome exibido antes de confirmar. Quando a implementação estiver numa worktree, passe `BACKEND_DIR=.worktrees/<nome>/backend` aos targets de migration para executar o código dela com as variáveis do checkout principal.

Arquivos gerados em `backend/src/migrations/`. Revise sempre antes de aplicar. `make migration-revert` executa o `down` da última migration aplicada e pode remover colunas/dados: valide reversões em um PostgreSQL descartável, nunca aponte esse teste para desenvolvimento compartilhado ou produção. Na Fase 1a, a sequência aditiva é 026 (designations), 027 (diretorias), 028 (comunidades), 029 (e-mails), 030 (auditoria/settings) e 031 (eventos 18+); após validar o `down` da 031, restaure imediatamente com `make migration-run` no mesmo banco descartável. A Fase 2 adiciona 033–035, a Fase 3 adiciona 036 (`assemblies`) e a Fase 4 adiciona 037–040. O down/up da Fase 4 foi validado em dump isolado: reversão até 036, inserção de uma assembleia sintética e reaplicação preservaram 174 membros, 6 comunidades e a assembleia, com backfill Codaqui; o down de 036 remove a tabela e os dados de assembleias, portanto não é rollback neutro para produção. O adendo adiciona 041 (`certificateGrantedAt`, `certificateGrantedByMemberId`, `certificateInvitedAt`); seu backfill usa `checkedInByMemberId::uuid` porque a coluna legada é `varchar`. Em dump isolado, down/up preservou 265 inscrições e fez backfill de 66 presenças sem divergências; o down remove somente essas três colunas e seus metadados de concessão/convite. O E2E `DB_NAME=codaqui_certificate_test npx jest --config ./test/jest-e2e.json --runInBand test/certificate-decoupling.e2e-spec.ts` cobre CSV, batch, horas exactly-once, concessão, `sent/failed/skipped`, guest claim e verificação, com fixtures sintéticas removidas ao final. A Fase 4b adiciona 042 (`cities`, vínculos de IES e validade/motivação de designations); down/up em dump isolado preservou 1 entity, 1 evento e 3 designations, e `DB_NAME=codaqui_universities_test npx jest --config ./test/jest-e2e.json --runInBand test/universities.e2e-spec.ts` validou a jornada completa com limpeza de fixtures.

---

## Variáveis de Ambiente

Baseie-se no `.env.example`. Variáveis principais:

| Variável | Usado por | Descrição |
|----------|-----------|-----------|
| `DISCORD_BOT_TOKEN` | `sync:events`, `sync:social` | Token do bot Discord (sync de eventos e membros) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Backend, Compose | Credenciais do PostgreSQL |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Backend | OAuth App do GitHub para autenticação |
| `JWT_SECRET` | Backend | Segredo para assinar tokens JWT — gere com `openssl rand -hex 64` |
| `STRIPE_SECRET_KEY` | Backend | Chave secreta Stripe (`sk_test_...` em dev, `sk_live_...` em prod) |
| `STRIPE_WEBHOOK_SECRET` | Backend | Segredo do webhook Stripe (capturado automaticamente pelo `make up`) |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Backend | Chave de 32 bytes (hex/base64) para criptografar em repouso os tokens OAuth dos membros (`members.githubAccessToken`, AES-256-GCM). Obrigatória em produção — gere com `openssl rand -hex 32`. Em dev pode ficar vazia (tokens gravados com prefixo `plain:`) |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | Backend | Repositório alvo do GitHub-as-Database (`codaqui` / `institucional`) — overrides/organizers |
| `GITHUB_BASE_BRANCH` | Backend | Branch base de leitura/escrita do GitHub-as-Database (default: `main`). Em dev use `develop` — os PRs/merges locais vão para lá, e sem a env o backend não enxerga overrides/snapshots |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Backend | E-mails transacionais via SMTP. Sem credenciais, envios viram `skipped` + `SMTP_NOT_CONFIGURED`, não contam como falha e podem ser reenviados depois por `/notifications/emails/:id/resend` |
| `AUDIT_OPERATIONAL_RETENTION_DAYS` | Backend | Fallback da retenção de logs operacionais (7–365; default 30). O setting admin vence a env; governo nunca expira |
| `TURNSTILE_SECRET` / `TURNSTILE_HOSTNAMES` | Backend | Obrigatórias para o guest claim em produção: secret do siteverify e lista de hostnames exatos, separados por vírgula. Produção sem secret falha fechada; o fallback `development` só vale fora de produção |
| `PUBLIC_TURNSTILE_SITE_KEY` | Frontend | Site key pública que renderiza `TurnstileField`. Configurar como Variable do GitHub Actions; o `deploy-astro.yml` a entrega ao build de todos os sites. Sem ela não há widget nem token simulado em produção |
| `BACKEND_URL` | Backend | URL pública do backend (default: `http://localhost:3001`; `make setup-https` ajusta para HTTPS) |
| `PUBLIC_API_URL` | Frontend | URL da API usada pelo Compose e pelas ilhas (default: `http://localhost:3001`; `make setup-https` ajusta para HTTPS) |
| `FRONTEND_URL` | Backend | URL base do frontend para redirects/links (default: `http://localhost:3000`; `make setup-https` ajusta para HTTPS) |

> **Nota (GitHub-as-Database):** a escrita no repositório usa o **token OAuth do próprio
> membro logado** — o código pede o scope `public_repo` no OAuth App existente
> (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`). Nenhuma mudança é necessária no App OAuth:
> o novo consentimento aparece automaticamente no próximo login de cada usuário, e o token
> é persistido criptografado a cada login. Sem o scope (login antigo), os endpoints de
> escrita respondem 400/403 orientando re-login. Leituras são públicas
> (`raw.githubusercontent.com`). Hoje esse fluxo legado é usado apenas pelo force-sync
> manual do snapshot interno; overrides e organizers já estão no PostgreSQL.

**Produção (apenas `compose.prod.yaml`):**

| Variável | Exemplo | Obrigatório |
|----------|---------|-------------|
| `POSTGRES_USER` | `codaqui` | Sim (default: `codaqui`) |
| `POSTGRES_PASSWORD` | senha segura | **Sim** |
| `POSTGRES_DB` | `codaqui_db` | Sim (default: `codaqui_db`) |
| `GITHUB_CLIENT_ID` | `Ov23li...` | **Sim** |
| `GITHUB_CLIENT_SECRET` | `abc123...` | **Sim** |
| `JWT_SECRET` | `openssl rand -hex 64` | **Sim** |
| `BACKEND_URL` | `https://api.codaqui.dev` | Sim (tem default) |
| `FRONTEND_URL` | `https://codaqui.dev` | Sim (tem default) |
| `STRIPE_SECRET_KEY` | `sk_live_...` | **Sim** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | **Sim** — obtido no dashboard Stripe → Webhooks |

---

## Deploy

### Sites → Cloudflare Pages (automático)

Push em `main` ou `develop` dispara [`.github/workflows/deploy-astro.yml`](.github/workflows/deploy-astro.yml):

1. Build matrix — um job por projeto: `codaqui` (build **sem** `TENANT`) + `tisocial` + `elasnocodigo` + `devparana` (cada um com `TENANT`, `SITE_URL` e `PUBLIC_API_URL` próprios).
2. Gate de URLs canônicas por tenant (`tenant-urls.mjs`) antes do upload.
3. *Direct upload* com `wrangler pages deploy` (wrangler pinado nas devDeps da raiz).

- `main` = produção (codaqui.dev + domínios próprios dos tenants, conforme a production branch de cada projeto Pages).
- Outras branches = *branch deployments* de preview (`<branch>.<projeto>.pages.dev`).
- `workflow_dispatch` com input `tenant` restringe o deploy a um único projeto.
- Sem `CLOUDFLARE_API_TOKEN` configurado, o workflow faz apenas o build e pula o deploy.

O `backend/` **nunca** é enviado para o Cloudflare Pages.

### Cutover codaqui.dev (Fase 0.6)

Migração do domínio principal `codaqui.dev` + `www.codaqui.dev` de **GitHub Pages** (branch `gh-pages`) para o projeto Pages **`codaqui`**. DNS gerido na zona Cloudflare `codaqui.dev` (id `7d25116af2182b27811d350558152f1e`, plano Free, account `70ef4d210bb380167db78da021123de9`).

**Estado (2026-10-28):** os custom domains `codaqui.dev` e `www.codaqui.dev` **já estão anexados** ao projeto Pages com status `pending` — a validação HTTP deles só completa depois que o DNS apontar (mesmo comportamento dos tenants). O GitHub Pages (source `gh-pages`, `cname: codaqui.dev`, HTTPS aprovado até 2026-12-26) **permanece intacto como rollback** até a T10 (~7 dias pós-cut).

**Janela do cut:** TTL dos registros atuais ≈ 300 s (Cloudflare "auto", DNS-only) — propagação de ~5–10 min, sem preparação de véspera. Execute em horário de baixo tráfego; o rollback (seção 4) é quase imediato.

Todos os snippets assumem:

```bash
export CLOUDFLARE_API_TOKEN=...        # ou: source /tmp/cf_codaqui_env
export CLOUDFLARE_ACCOUNT_ID=70ef4d210bb380167db78da021123de9
ZONE_ID=7d25116af2182b27811d350558152f1e
```

**1. Pré-checks**

- [ ] `make astro-verify` verde na develop (build codaqui + `astro check` + vitest + type-check da Pages Function + smoke do dist + gate `diff-urls`).
- [ ] `make astro-verify-tenants` verde (4 builds + allow-list de URLs por tenant).
- [ ] Último run de [`deploy-astro.yml`](.github/workflows/deploy-astro.yml) em `main` verde (produção do projeto `codaqui` no ar):

  ```bash
  gh run list --workflow deploy-astro.yml --branch main --limit 5
  ```

- [ ] Paridade de URLs 100% — o gate `diff-urls` roda dentro do `astro-verify`; a referência `frontend/scripts/url-reference.json` **não é regenerável**, então qualquer divergência bloqueia o cut.
- [ ] Custom domains presentes e `pending` no projeto:

  ```bash
  curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/codaqui/domains" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | python3 -m json.tool
  # "status": "pending" + "error_message": "CNAME record not set" nos dois — ESPERADO neste ponto
  ```

  (Somente se algum estiver faltando — feito pelo orquestrador em 2026-10-28 — anexe com `POST …/pages/projects/codaqui/domains` e body `{"name":"codaqui.dev"}` / `{"name":"www.codaqui.dev"}`.)

**2. Passos do cut**

**2.1 — Inventário pré-cut** (evidência para o rollback — guarde a saída):

```bash
mkdir -p /tmp/cutover-codaqui
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=A&name=codaqui.dev" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | tee /tmp/cutover-codaqui/apex-a.json | python3 -m json.tool
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=www.codaqui.dev" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | tee /tmp/cutover-codaqui/www-cname.json | python3 -m json.tool
```

Confira antes de prosseguir: **4× A** `codaqui.dev` → `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153` (DNS-only) e **1× CNAME** `www.codaqui.dev` → `codaqui.github.io` (DNS-only). Divergiu? **Pare** e reavalie.

> ⚠️ **Não toque em mais nada da zona:** `api` / `apps` / `firefox` / `ping` / `ssh` (Cloudflare Tunnel), `dados` (Streamlit), MX/SPF/DKIM/DMARC, `google-site-verification`, TXTs `_github-challenge-*` / `_gh-*` e os CNAMEs de DCV (`_5b08…comodoca.com`). O TXT `_github-pages-challenge-codaqui` **só é removido na T10** (seção 5).

**2.2 — www primeiro** (não conflita com nada): aponte para `codaqui.pages.dev`, agora **proxied**:

```bash
WWW_ID=$(python3 -c 'import json; print(json.load(open("/tmp/cutover-codaqui/www-cname.json"))["result"][0]["id"])')
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$WWW_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"www.codaqui.dev","content":"codaqui.pages.dev","proxied":true}' \
  | python3 -m json.tool
```

**2.3 — Deletar os 4 A do apex.** O CNAME do apex (2.4) conflita com A de mesmo nome, então a ordem é deletar primeiro:

```bash
for A_ID in $(python3 -c 'import json; print(" ".join(r["id"] for r in json.load(open("/tmp/cutover-codaqui/apex-a.json"))["result"]))'); do
  curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$A_ID" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  echo
done
```

**2.4 — CNAME no apex** (a Cloudflare faz flattening de CNAME em apex), **proxied**:

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"codaqui.dev","content":"codaqui.pages.dev","proxied":true}' \
  | python3 -m json.tool
```

**2.5 — Confirme no autoritativo** (resolvers públicos podem ainda mostrar o estado antigo por até ~5 min):

```bash
dig +short codaqui.dev
dig +short www.codaqui.dev
```

**3. Verificação pós-cut**

**3.1 — Validação dos custom domains** (poll até `active`; em geral 5–10 min):

```bash
while :; do
  date
  curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/codaqui/domains" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    | python3 -c 'import json,sys; [print(" ", d["name"]+":", d["status"]) for d in json.load(sys.stdin)["result"]]'
  sleep 30
done
```

**3.2 — Checklist HTTP** (`curl -4` força IPv4; se o resolver ainda servir o apex antigo, aguarde a propagação ou teste contra `https://codaqui.pages.dev` + `Host`):

```bash
B=https://codaqui.dev
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/"                                    # 200
curl -4sS "$B/" | grep -o "<title>[^<]*</title>"                                     # contém "Codaqui"
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/eventos" "$B/transparencia" "$B/comunidades/tisocial"  # 200 200 200
curl -4sS -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "$B/team"              # 301 -> https://codaqui.dev/sobre/equipe
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/blog/rss.xml" "$B/sitemap-index.xml"  # 200 200
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/@endersonmenezes"                     # 200 (perfil de membro)
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/auth/github"                          # 302 (proxy -> backend -> github.com/login/oauth)
curl -4sS -o /dev/null -w "%{http_code}\n" "$B/health"                               # 200 via proxy
curl -4sS "$B/admin" | grep -qi noindex && curl -4sS -o /dev/null -w "/admin: %{http_code}\n" "$B/admin"
```

**3.3 — Amostra da referência de URLs** — ~30 paths de `frontend/scripts/url-reference.json` sem **404** (200/301/308 ok — a referência inclui URLs que viraram redirect). O arquivo é um JSON pretty-printed, então a amostragem sai via `python3` (seed fixo = amostra reproduzível):

```bash
python3 -c 'import json,random; [print(p) for p in random.Random(42).sample(json.load(open("frontend/scripts/url-reference.json")), 30)]' \
| while read -r path; do
  code=$(curl -4sS -o /dev/null -w "%{http_code}" "https://codaqui.dev$path")
  echo "$code $path"
done | tee /tmp/cutover-codaqui/sample.txt
grep "^404" /tmp/cutover-codaqui/sample.txt || echo "amostra OK — sem 404"
```

> `shuf -n 30 frontend/scripts/url-reference.json` **não** serve: o arquivo é JSON formatado (uma string por linha, com aspas/vírgula) — o `shuf` pegaria linhas cruas, não paths.

Se algo falhar por DNS ainda não propagado, aguarde e repita. Se falhar por outra causa e não se resolver sozinho: **rollback (4)**.

**4. Rollback (DNS de volta ao GitHub Pages)**

Restaura exatamente o estado do inventário (2.1): recria os 4 A **DNS-only** (`"ttl":1` = auto ≈300 s) e devolve o www a `codaqui.github.io`. **Ordem importa**: delete o CNAME do apex antes de recriar os A.

```bash
# 4.1 — deletar o CNAME do apex
APEX_CNAME_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=codaqui.dev" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')
if [ -n "$APEX_CNAME_ID" ]; then
  curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$APEX_CNAME_ID" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  echo
fi

# 4.2 — recriar os 4 A (valores exatos do estado pré-cut)
for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"A\",\"name\":\"codaqui.dev\",\"content\":\"$ip\",\"proxied\":false,\"ttl\":1}"
  echo
done

# 4.3 — www de volta ao GitHub Pages (DNS-only)
WWW_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=www.codaqui.dev" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["id"])')
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$WWW_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"www.codaqui.dev","content":"codaqui.github.io","proxied":false,"ttl":1}'
```

Aguarde ~5 min e confirme: `dig +short codaqui.dev` volta a responder os IPs `185.199.108–111.153` e `curl -4sS https://codaqui.dev/` é servido pelo GitHub Pages de novo. O cert HTTPS do GitHub Pages continua válido — rollback por DNS não invalida nada.

**5. Pós-estável (T10 — ~7 dias após o cut)**

Critério para executar: ~7 dias de operação estável no Pages (sem rollback; verificações 3.2/3.3 verdes). Só então desmontar o GitHub Pages:

```bash
# 5.1 — desabilitar GitHub Pages (source gh-pages + cname) do repositório
gh api -X DELETE /repos/codaqui/institucional/pages

# 5.2 — remover o TXT de verificação do GitHub Pages na zona
TXT_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=_github-pages-challenge-codaqui.codaqui.dev" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')
if [ -n "$TXT_ID" ]; then
  curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$TXT_ID" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  echo
fi

# 5.3 — deletar a branch gh-pages
git push origin :gh-pages
```

### Secrets e Variáveis do GitHub Actions

Configure em **Settings → Secrets and variables → Actions** do repositório:

| Nome | Tipo | Workflow | Para quê |
|------|------|----------|----------|
| `GH_APP_PRIVATE_KEY` | **Secret** | `sync-event-snapshots`, `sync-social-stats`, `sync-analytics`, `sync-assemblies` | Chave privada do GitHub App usado para commitar os snapshots atualizados na `main`. Sem isso os syncs falham ao pushar. |
| `GH_APP_ID` | **Variable** (não secret) | Idem | App ID do mesmo GitHub App |
| `DISCORD_BOT_TOKEN` | **Secret** | `sync-event-snapshots`, `sync-social-stats` | Token do bot Discord. Opcional — sem ele os scripts preservam os snapshots existentes. |
| `DADOS_DISPATCH_TOKEN` | **Secret** | `sync-analytics` | GitHub PAT com `actions:write` no repo `codaqui/dados` — dispara o relatório mensal de analytics lá. Opcional — o fetch dos dados funciona sem ele. |
| `CLOUDFLARE_API_TOKEN` | **Secret** | `deploy-astro` | Token de API da Cloudflare com escopo mínimo *Cloudflare Pages:Edit* no account. Opcional — sem ele o workflow faz o build mas pula o deploy. |
| `CLOUDFLARE_ACCOUNT_ID` | **Secret** | `deploy-astro` | Account ID da Cloudflare (visível no dashboard → sidebar → copy ID). |
| `STRIPE_PUBLISHABLE_KEY` | **Variable** (não secret) | `deploy-astro` | Chave pública Stripe (`pk_live_...`) reexportada como `PUBLIC_STRIPE_PUBLISHABLE_KEY` no build. Sem isso o botão de doação fica desativado. |
| `PUBLIC_TURNSTILE_SITE_KEY` | **Variable** (não secret) | `deploy-astro` | Site key pública do Cloudflare Turnstile, encaminhada ao build dos quatro sites. Sem ela o guest claim não renderiza o widget e o DTO rejeita o token vazio. |
| `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` | **Variable** (não secret) | `deploy-astro` | ID da categoria Reuniões do GitHub Discussions. Sem ele as páginas mantêm link/fallback estático e a jornada Giscus permanece pendente. |

Na publicação do guest claim, configure também `TURNSTILE_SECRET` e `TURNSTILE_HOSTNAMES` no backend. Depois do deploy do backend e do frontend, abra um convite real, confirme que o widget renderiza sem erro e conclua um claim real, verificando token emitido pelo Cloudflare, hostname aceito, consentimento e QR. Testes locais com token `development` não substituem essa validação.

> **Como obter o GitHub App:**
> Crie um GitHub App em *Settings → Developer settings → GitHub Apps* com permissão de escrita em `Contents` do repositório, gere uma chave privada (`.pem`) e use seu conteúdo como valor de `GH_APP_PRIVATE_KEY`.

### Backend → Produção ARM64 (manual)

1. **Publicar a imagem:** rode o workflow manual [`.github/workflows/publish-backend.yml`](.github/workflows/publish-backend.yml) (*Actions → CD: Publish Backend & Push GHCR → Run workflow*). A tag da imagem e da release vêm do `version` de `backend/package.json` — **bump de versão obrigatório** a cada mudança no backend (feat → minor, fix → patch), senão o deploy sobrescreve a imagem anterior.
2. **Subir no servidor:**

   ```bash
   podman compose -f compose.prod.yaml pull
   podman compose -f compose.prod.yaml up -d
   ```

Sobe: PostgreSQL + Backend. As migrations são executadas automaticamente na inicialização (`migrationsRun: true` em produção).

> **Produção (Coolify):** o ambiente real do servidor ARM64 é gerenciado pelo **Coolify** — após o `publish-backend.yml` pushar a nova imagem, o redeploy do serviço é **manual** no painel do Coolify.

**Handoff da Fase 3:** backend 0.15.0, migration 036, sync inicial e frontend foram publicados. A criação de uma assembleia/Discussion real na categoria Reuniões e a validação do Giscus por `pathname` continuam como acompanhamento operacional.

**Handoff da Fase 4:** `backend/package.json` e o lock estão preparados em `0.16.0`; migrations 037–041 foram verificadas em dump isolado, com down/up e E2E PostgreSQL, mas ainda não foram aplicadas em produção. Depois do merge autorizado, publique `v0.16.0-backend`, faça redeploy no Coolify, confirme as cinco migrations, rode `npm run sync:projects` com sucesso e somente então publique o frontend. O sync diário usa `PROJECTS_API_URL` e o workflow `sync-projects.yml` (06:29 UTC + dispatch); o agregador `npm run sync` não inclui projetos. Valide a jornada real diretor → mentor → participante → finance-analyzer, a emissão idempotente e as rotas `/assembleias/<entitySlug>/<type>-<number>` com o redirect legado. Detalhes: [ADR 008](docs/adrs/008-entities-extension-projects.md).

**Adendo de certificação desacoplada:** a migration 041 e a central `/admin/eventos-checkin` (Escanear/Participantes/Certificados) seguem na mesma release 0.16.0 e PR #617. O E2E real cobriu CSV com `checkin/certificate`, batch, concessão sem presença, horas exactly-once, convite `sent/failed/skipped`, aceite guest externo e verificação. Após o deploy, valide em homologação/produção controlada: ativação `certificates` sem `checkin`, importação com presença e concessão, um convite transacional real, aceite e verificação pública. Não há campanha/open tracking; concessão e convite continuam ações explícitas com escopo no backend.

**Correção 0.16.1 — participantes importados:** `DELETE /events/external/:eventKey/participants/:registrationId` remove somente inscrições sem pedido/presença, decrementa `quantitySold` na transação e libera reimportação. Presença ou pedido retorna 409 para preservar histórico/horas. O E2E real confirmou exclusão, reimportação e contagem do ingresso; `/admin/overrides` tem confirmação e feedback. Publicar `v0.16.1-backend` junto ou depois da 0.16.0, antes de usar a ação em produção.

**Handoff da Fase 4b — Codaqui Universitário:** backend 0.17.0 e migration 042 implementados e verificados, ainda sem integração/release. O down/up em dump real preservou 1 entity, 1 evento e 3 designations; o E2E PostgreSQL cobriu gestor → cidade → IES → candidatura → confirmação admin → evento do embaixador → inscrição → check-in → certificado e uma única entrada de 2 horas. Após merge autorizado, publique `v0.17.0-backend`, faça redeploy no Coolify, confirme a 042 e execute `npm run sync:universities` (ou `sync-universities.yml`, diário 06:26 UTC + dispatch) antes do frontend. Valide candidatura, posse, primeiro evento e snapshot público sem motivação/e-mail. Detalhes: [ADR 015](docs/adrs/015-codaqui-universitario.md). A publicação 0.16.x continua pendente de forma independente.

**Fila de convites de certificado:** backend 0.18.0 e migration 043 implementados em `fix/certificate-invite-queue`, com PR própria para `develop`. O dump real preservou 28 `sent`/90 `failed`; o E2E cobriu 202, retry 421 e conclusão na segunda tentativa. Após merge autorizado, publique `v0.18.0-backend`, confirme a 043 e só então publique o frontend. `EMAIL_SEND_INTERVAL_MS` tem default 2000 ms em produção e 0 em testes. Comece com um lote pequeno; a migration não reprocessa os 90 erros nem envia e-mails automaticamente. Detalhes: [ADR 016](docs/adrs/016-certificate-invite-queue.md).

---

## Git: merge de `main` no branch de feature

A `main` recebe commits automáticos de sync de dados (`static/events/`, `static/social-stats/`, `static/analytics/`).
Ao fazer merge de `main` no branch de desenvolvimento, sempre preserve os snapshots da `main`:

```bash
git fetch origin
git merge origin/main

# Se houver conflito em static/, resolva mantendo a versão da main:
git checkout origin/main -- static/events/ static/social-stats/ static/analytics/
git add static/
git merge --continue   # ou git commit se não for um merge conflict
```

> **Por quê?** Os arquivos em `static/` são gerados automaticamente por workflows na `main`.
> A versão da `main` sempre é mais recente. Nunca resolva conflitos nesses arquivos mantendo o branch local.

---

## Convenção de Commits

```
feat: adiciona nova trilha de JavaScript
fix: corrige link quebrado na página inicial
docs: atualiza DEVELOPMENT.md
refactor: reorganiza módulo de ledger
chore: atualiza dependências
```
