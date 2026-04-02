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
npm run serve       # Serve o build локальнo para testar
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
| `npm run sync` | `sync:events` + `sync:social` em sequência |

**Secret necessário:** `DISCORD_BOT_TOKEN` — sem ele os scripts preservam os snapshots existentes.

---

## Backend (NestJS)

**Quando usar:** desenvolver ou depurar endpoints, integração Stripe, módulo de Ledger ou lógica server-side.

### Setup (sem Podman)

```bash
cd backend
npm install
npm run start:dev   # Watch mode → http://localhost:4000
```

Para ter um banco disponível sem subir tudo, suba só o Postgres:

```bash
podman compose -f compose.yaml up postgres -d
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

### Módulos

| Módulo | Endpoints principais | Descrição |
|--------|---------------------|-----------|
| `LedgerModule` | `GET /ledger/community-balances` · `GET /ledger/accounts/:id/transactions` | Contabilidade dupla partida. Contas criadas automaticamente por `projectKey`. |
| `StripeModule` | `POST /stripe/checkout-session` · `POST /stripe/webhook` | Pagamentos. Webhook credita a carteira da comunidade no Ledger. |
| `AuthModule` | — | Integração Keycloak |
| `ExpensesModule` | — | Gestão de despesas |
| `StorageModule` | — | Armazenamento MinIO |

### Testando Webhooks do Stripe localmente

```bash
# Instale a CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:4000/stripe/webhook
# A CLI imprime o STRIPE_WEBHOOK_SECRET temporário — cole no .env
```

---

## Full Stack (Frontend + Backend + Infra)

**Quando usar:** funcionalidades que dependem da integração entre frontend e backend (ex: transparência financeira, formulário de doações).

### Setup

Copie e preencha o `.env`:

```bash
cp .env.example .env
```

Adicione ao `/etc/hosts`:

```
127.0.0.1 codaqui.localhost api.localhost auth.localhost minio.localhost
```

Suba tudo:

```bash
podman compose -f compose.yaml build --no-cache && podman compose up
```

### Serviços (DEV)

| Serviço | Host | Porta direta |
|---------|------|--------------|
| Docusaurus | http://codaqui.localhost:8000 | — |
| Backend NestJS | http://api.localhost:8000 | 4000 |
| Keycloak | http://auth.localhost:8000 | 8081 |
| MinIO Console | http://minio.localhost:8000 | 9001 |
| Traefik Dashboard | http://localhost:8080 | — |
| PostgreSQL | — | 5432 |

---

## Variáveis de Ambiente

Baseie-se no `.env.example`. Variáveis principais:

| Variável | Usado por | Descrição |
|----------|-----------|-----------|
| `DISCORD_BOT_TOKEN` | `sync:events`, `sync:social` | Token do bot Discord (sync de eventos e membros) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Backend, Compose | Credenciais do PostgreSQL |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Compose | Credenciais do MinIO |
| `KC_ADMIN` / `KC_ADMIN_PASSWORD` | Compose | Admin do Keycloak |
| `STRIPE_SECRET_KEY` | Backend | Chave secreta da Stripe (obter em dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Backend | Segredo do webhook Stripe |
| `FRONTEND_URL` | Backend | URL base do frontend (redirects pós-doação) |

**Produção (apenas `compose.prod.yaml`):**

| Variável | Exemplo |
|----------|---------|
| `API_DOMAIN` | `api.intranet.codaqui.dev` |
| `AUTH_DOMAIN` | `auth.intranet.codaqui.dev` |
| `MINIO_DOMAIN` | `minio.intranet.codaqui.dev` |

---

## Deploy

### Frontend → GitHub Pages (automático)

Push em `main` ou `develop` dispara `.github/workflows/gh-deploy.yml`:
1. `npm ci`
2. `npm run build`
3. Deploy em `gh-pages` (main) ou `gh-pages/previews/develop/` (develop)

O `backend/` **nunca** é enviado para o GitHub Pages.

### Backend → Produção ARM64

```bash
# No servidor de produção
podman compose -f compose.prod.yaml pull
podman compose -f compose.prod.yaml up -d
```

Sobe: Traefik, Postgres, Keycloak, MinIO e Backend. Sem Docusaurus.

---

## Convenção de Commits

```
feat: adiciona nova trilha de JavaScript
fix: corrige link quebrado na página inicial
docs: atualiza DEVELOPMENT.md
refactor: reorganiza módulo de ledger
chore: atualiza dependências
```
