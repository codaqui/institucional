# Development Guide

> Manual técnico para desenvolvedores do monorepo Codaqui.
> Para visão geral do projeto, veja o [README.md](./README.md).
> Para padrões de código e convenções, veja o [AGENTS.md](./AGENTS.md).

---

## Arquitetura do Monorepo

| Camada | Diretório | Serve via |
|--------|-----------|-----------|
| **Frontend** (Docusaurus) | `/` (raiz) | GitHub Pages · `npm start` (dev) |
| **Backend** (NestJS) | `backend/` | Podman Compose (local + produção ARM64) |
| **Infra** | `compose.yaml` / `compose.prod.yaml` | Podman Compose |

> O GitHub Pages **nunca** publica o `backend/`.

---

## Frontend (Docusaurus)

**Quando usar:** editar blog, trilhas, páginas, componentes React, dados ou estilos. Não precisa de Podman nem do backend.

### Setup

```bash
npm install   # apenas na primeira vez
npm start     # → http://localhost:3000
```

As páginas `/transparencia` e `/participe/apoiar` exibem mensagem de fallback quando o backend está offline — comportamento esperado.

### Comandos

```bash
npm run build       # Gera ./build/ (mesmo que o CI)
npm run serve       # Serve o build localmente para testar
npm run typecheck   # TypeScript (exclui /backend automaticamente)
```

> Rode `npm run typecheck` antes de abrir qualquer PR.

### O que editar sem o backend

| O que | Onde |
|-------|------|
| Blog posts | `blog/YYYY-MM-DD-slug.md` |
| Trilhas | `trilhas/python/` ou `trilhas/github/` |
| Equipe | `src/data/team.ts` |
| Comunidades parceiras | `src/data/communities.ts` |
| Projetos open-source | `src/data/projects.ts` |
| Timeline | `src/data/timeline.ts` |
| Links sociais | `src/data/social.ts` |
| Páginas | `src/pages/*.tsx` |
| Componentes React | `src/components/` |
| Estilos globais | `src/css/custom.css` |

### Sync de dados estáticos

Scripts que buscam dados externos e gravam snapshots em `static/` — sem expor chaves ao browser.

| Comando | O que faz |
|---------|-----------|
| `npm run sync:events` | Eventos (Discord + Meetup) → `static/events/` |
| `npm run sync:events:full` | Re-pagina todos os eventos passados |
| `npm run sync:social` | Contagens de membros/seguidores → `static/social-stats/index.json` |
| `npm run sync:analytics` | Analytics → `static/analytics/` |
| `npm run sync:analytics:full` | Re-pagina todo o histórico de analytics |
| `npm run sync` | `sync:events` + `sync:social` + `sync:analytics` em sequência |
| `npm run sync:full` | Versão completa (full) de todos os syncs |

**Secret necessário:** `DISCORD_BOT_TOKEN` — sem ele os scripts preservam os snapshots existentes.

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
| `StorageModule` | `POST /storage/validate-receipt-url` | Validação de URLs de comprovantes (MinIO). |
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
4. Eventos a escutar: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. Copie o **Signing secret** (`whsec_...`) gerado e defina como `STRIPE_WEBHOOK_SECRET` no servidor de produção

---

## Full Stack (Frontend + Backend + Infra)

**Quando usar:** funcionalidades que dependem da integração entre frontend e backend (ex: transparência financeira, formulário de doações).

### Setup

```bash
make setup   # Cria .env a partir de .env.example e instala dependências
```

Edite o `.env` gerado com suas credenciais, depois:

```bash
make up   # Sobe todos os serviços e captura o STRIPE_WEBHOOK_SECRET automaticamente
```

### Serviços (DEV)

| Serviço | URL |
|---------|-----|
| Docusaurus | http://localhost:3000 |
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
| `BACKEND_URL` | Backend | URL pública do backend (default: `http://localhost:3001`) |
| `FRONTEND_URL` | Backend | URL base do frontend (default: `http://localhost:3000`) |

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

### Frontend → GitHub Pages (automático)

Push em `main` ou `develop` dispara `.github/workflows/gh-deploy.yml`:
1. `npm ci`
2. `npm run build` (com `STRIPE_PUBLISHABLE_KEY` injetada via GitHub Variable)
3. Deploy em `gh-pages` (main) ou `gh-pages/previews/develop/` (develop)

O `backend/` **nunca** é enviado para o GitHub Pages.

### Secrets e Variáveis do GitHub Actions

Configure em **Settings → Secrets and variables → Actions** do repositório:

| Nome | Tipo | Workflow | Para quê |
|------|------|----------|----------|
| `GH_APP_PRIVATE_KEY` | **Secret** | `gh-deploy`, `pr-preview-deploy`, `pr-preview-cleanup` | Chave privada do GitHub App que faz push no branch `gh-pages`. Sem isso o deploy falha. |
| `GH_APP_ID` | **Variable** (não secret) | Idem | App ID do mesmo GitHub App |
| `STRIPE_PUBLISHABLE_KEY` | **Variable** (não secret) | `gh-deploy`, `pr-check` | Chave pública Stripe (`pk_live_...`) injetada no build do Docusaurus. Sem isso o botão de doação fica desativado. |
| `DISCORD_BOT_TOKEN` | **Secret** | `sync-event-snapshots`, `sync-social-stats` | Token do bot Discord. Opcional — sem ele os scripts preservam os snapshots existentes. |

> **Como obter o GitHub App:**
> Crie um GitHub App em *Settings → Developer settings → GitHub Apps* com permissão de escrita em `Contents` do repositório, gere uma chave privada (`.pem`) e use seu conteúdo como valor de `GH_APP_PRIVATE_KEY`.

### Backend → Produção ARM64

```bash
# No servidor de produção
podman compose -f compose.prod.yaml pull
podman compose -f compose.prod.yaml up -d
```

Sobe: PostgreSQL + Backend. Sem Docusaurus, sem Stripe CLI.

As migrations são executadas automaticamente na inicialização (`migrationsRun: true` em produção).

---

## Convenção de Commits

```
feat: adiciona nova trilha de JavaScript
fix: corrige link quebrado na página inicial
docs: atualiza DEVELOPMENT.md
refactor: reorganiza módulo de ledger
chore: atualiza dependências
```

