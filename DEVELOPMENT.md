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
| **Frontend** (Astro) | `frontend/` | Cloudflare Pages (CI) · `make astro-dev` (dev) |
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
| Dados das listas (equipe, comunidades, projetos, timeline, social) | `frontend/src/data/` (espelho parcial versionado em `scripts/data/` na raiz) |
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
| `npm run sync` | `sync:events` + `sync:social` + `sync:analytics` em sequência |
| `npm run sync:full` | Versão completa (full) de todos os syncs |
| `npm run test:scripts` | Testes dos scripts de sync/validação (`node --test`) |

> **`make sync-events` (recomendado em dev):** igual ao `npm run sync:events`, mas exporta
> `INTERNAL_EVENTS_API_URL=http://localhost:3001` para a fonte `internal:codaqui` (eventos
> próprios publicados no Postgres) ser resolvida do backend dev — sem isso o sync cai no
> fallback do último snapshot em disco.

**Secret necessário:** `DISCORD_BOT_TOKEN` — sem ele os scripts preservam os snapshots existentes.

Pela raiz, `make sync`, `make sync-events`, `make sync-events-full`, `make sync-social` e `make sync-analytics` espelham os comandos da tabela.

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
| `LedgerModule` | `GET /ledger/community-balances` · `GET /ledger/accounts` · `GET /ledger/accounts/:id/transactions` · `POST /ledger/accounts` · `POST /ledger/transactions` | Contabilidade dupla partida. Contas criadas automaticamente por `projectKey`. |
| `StripeModule` | `POST /stripe/checkout-session` · `POST /stripe/webhook` · `GET /stripe/my-donations` · `GET /stripe/my-subscriptions` · `DELETE /stripe/subscriptions/:id` | Pagamentos. Webhook credita a carteira da comunidade no Ledger. |
| `AuthModule` | `GET /auth/github` · `GET /auth/github/callback` · `GET /auth/me` · `GET /auth/logout` | Autenticação via GitHub OAuth + JWT. |
| `MembersModule` | `GET /members` · `GET /members/:id` · `GET /members/me` · `PUT /members/me` · `GET /admin/members` · `PATCH /admin/members/:id` | Perfis de membros da Associação. |
| `ReimbursementsModule` | `POST /reimbursements` · `GET /reimbursements` · `GET /reimbursements/my` · `GET /reimbursements/public/:id` · `PATCH /reimbursements/:id/approve` · `PATCH /reimbursements/:id/reject` | Solicitações de reembolso com fluxo de aprovação. |
| `TransfersModule` | `POST /account-transfers` · `GET /account-transfers` · `PATCH /account-transfers/:id/approve` · `PATCH /account-transfers/:id/reject` | Transferências entre contas do Ledger. |
| `ExpensesModule` | `POST /expenses` · `GET /expenses` · `GET /expenses/:id` · `POST /expenses/:id/approve` · `POST /expenses/:id/pay` | Gestão de despesas organizacionais. |
| `StorageModule` | `POST /storage/validate-receipt-url` | Valida URLs de comprovante: exige HTTPS e hostname em allowlist (Google Drive/Docs, Dropbox, OneDrive/1drv.ms, Imgur). Os arquivos ficam nos serviços confiáveis (upload manual pelo time); o backend não usa S3/MinIO/disco. |
| `AuditModule` | `GET /audit/logs` · `POST /audit/cleanup` | Trilha de auditoria das ações administrativas. |

### Swagger / OpenAPI

Disponível em `http://localhost:3000/docs` (sem containers) ou `http://localhost:3001/docs` (via Compose). Desabilitado em produção por padrão — para habilitar: `SWAGGER_ENABLED=true`.

### Webhook do Stripe

**Em desenvolvimento** — o `make up` sobe o Stripe CLI como container e captura o secret automaticamente. Ou rode manualmente:

```bash
# Instale a CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3001/stripe/webhook
# A CLI imprime o STRIPE_WEBHOOK_SECRET temporário — cole no .env
```

**Em produção** — registre o endpoint no dashboard do Stripe:

1. Acesse [dashboard.stripe.com → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **"Add endpoint"**
3. URL: `https://api.codaqui.dev/stripe/webhook`
4. Eventos a ouvir: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
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
make up   # Sobe backend + banco + Stripe CLI (captura o STRIPE_WEBHOOK_SECRET)
```

O app Astro não roda no Compose — em outro terminal:

```bash
make astro-dev   # http://localhost:4321
```

> Com o site Astro em dev, aponte `FRONTEND_URL=http://localhost:4321` no `.env` da raiz:
> o backend usa essa variável nos redirects pós-autenticação/doação e nos links de e-mail
> (default `http://localhost:3000`).

### Serviços (DEV)

| Serviço | URL |
|---------|-----|
| App Astro (terminal separado: `make astro-dev`) | http://localhost:4321 |
| Backend NestJS | http://localhost:3001 |
| Backend Swagger UI | http://localhost:3001/docs |
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

Arquivos gerados em `backend/src/migrations/`. Revise sempre antes de aplicar.

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

> **Nota (GitHub-as-Database):** a escrita no repositório usa o **token OAuth do próprio
> membro logado** — o código pede o scope `public_repo` no OAuth App existente
> (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`). Nenhuma mudança é necessária no App OAuth:
> o novo consentimento aparece automaticamente no próximo login de cada usuário, e o token
> é persistido criptografado a cada login. Sem o scope (login antigo), os endpoints de
> escrita respondem 400/403 orientando re-login. Leituras são públicas
> (`raw.githubusercontent.com`).
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Backend | E-mails de eventos (confirmação, lembrete D-1, pós-evento) via SMTP Gmail. Sem credenciais, envios são logados como `failed` com `SMTP_NOT_CONFIGURED` em `email_logs` |
| `BACKEND_URL` | Backend | URL pública do backend (default: `http://localhost:3001`) |
| `FRONTEND_URL` | Backend | URL base do frontend para redirects/links (default: `http://localhost:3000`; com o Astro em dev use `http://localhost:4321`) |

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
| `GH_APP_PRIVATE_KEY` | **Secret** | `sync-event-snapshots`, `sync-social-stats`, `sync-analytics` | Chave privada do GitHub App usado para commitar os snapshots atualizados na `main`. Sem isso os syncs falham ao pushar. |
| `GH_APP_ID` | **Variable** (não secret) | Idem | App ID do mesmo GitHub App |
| `DISCORD_BOT_TOKEN` | **Secret** | `sync-event-snapshots`, `sync-social-stats` | Token do bot Discord. Opcional — sem ele os scripts preservam os snapshots existentes. |
| `DADOS_DISPATCH_TOKEN` | **Secret** | `sync-analytics` | GitHub PAT com `actions:write` no repo `codaqui/dados` — dispara o relatório mensal de analytics lá. Opcional — o fetch dos dados funciona sem ele. |
| `CLOUDFLARE_API_TOKEN` | **Secret** | `deploy-astro` | Token de API da Cloudflare com escopo mínimo *Cloudflare Pages:Edit* no account. Opcional — sem ele o workflow faz o build mas pula o deploy. |
| `CLOUDFLARE_ACCOUNT_ID` | **Secret** | `deploy-astro` | Account ID da Cloudflare (visível no dashboard → sidebar → copy ID). |
| `STRIPE_PUBLISHABLE_KEY` | **Variable** (não secret) | `deploy-astro` | Chave pública Stripe (`pk_live_...`) reexportada como `PUBLIC_STRIPE_PUBLISHABLE_KEY` no build. Sem isso o botão de doação fica desativado. |

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
