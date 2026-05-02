# `workers/` — Cloudflare Workers para domínios próprios das comunidades

> Cada comunidade parceira que ganha **domínio próprio** (ex: `tisocial.org.br`) usa um Cloudflare Worker como reverse-proxy. Ver **MULTISITE_PLAN.md §6** para o desenho arquitetural completo.

## Estrutura

```
workers/
├── shared/
│   └── index.js              # Worker reusável — mesmo código serve qualquer comunidade
├── tisocial/
│   ├── wrangler.toml         # config produção: route + vars
│   └── wrangler.dev.toml     # config local: vars apontando pra *.localhost
└── README.md                 # este arquivo
```

**Regra:** o **código** do Worker (`workers/shared/index.js`) é um só. Cada comunidade tem só um `wrangler.toml` declarando suas vars (`STATIC_ORIGIN`, `API_ORIGIN`, `COMMUNITY_PREFIX`) e a route.

## O que o Worker faz

```
Browser ── tisocial.org.br/                ──301──► tisocial.org.br/comunidades/tisocial/
Browser ── tisocial.org.br/<api-path>      ──proxy──► api.codaqui.dev/<path>
Browser ── tisocial.org.br/<other>         ──proxy──► codaqui.dev/<other>   (pass-through)
```

Onde `<api-path>` é `/api/*`, `/auth/*`, `/stripe/*`, `/ledger/*`, `/members/*`.

**Por que pass-through (e não rewrite de path):** Docusaurus é SPA. O React Router renderiza páginas com base em `window.location.pathname`. Se reescrevêssemos `/comunidades/tisocial/foo` para `/foo` no browser, o roteador procuraria a rota `/foo` (que não existe pra T.I. Social) e renderizaria a home da Codaqui. Pass-through preserva o pathname original, garantindo que o SPA carregue a página correta. O redirect inicial em `/` dá ao usuário um entrypoint limpo (`tisocial.org.br` → home da T.I. Social).

Cookies do backend ficam **first-party** em `tisocial.org.br` automaticamente, sem cross-origin blocking.

## Comandos

> Todos rodam da raiz do repo.

| Comando | O que faz |
|---------|-----------|
| `npm run worker:dev:tisocial` | Sobe Worker localmente em `http://tisocial.localhost:8787`. Requer Docusaurus em `:3030` e backend em `:3001`. |
| `npm run worker:deploy:tisocial` | Faz deploy do Worker em produção (route `tisocial.org.br/*`). Requer credenciais Cloudflare configuradas. |

## Setup de credenciais Cloudflare

```bash
# Login interativo (abre browser)
npx wrangler login

# OU via API token (CI/CD):
export CLOUDFLARE_API_TOKEN=seu-token
```

Token mínimo: `Account → Workers Scripts → Edit` + `Zone → DNS → Edit` (na zona da comunidade).

## Adicionar nova comunidade

1. Criar `workers/<slug>/wrangler.toml` (copiar de `tisocial/wrangler.toml` e trocar):
   - `name` → `<slug>-proxy`
   - `routes[].pattern` e `zone_name` → domínio da comunidade
   - `[vars].COMMUNITY_PREFIX` → `/comunidades/<slug>`
2. Criar `workers/<slug>/wrangler.dev.toml` análogo
3. Adicionar scripts em `package.json`:
   ```json
   "worker:dev:<slug>": "wrangler dev --config workers/<slug>/wrangler.dev.toml --local --port 8788",
   "worker:deploy:<slug>": "wrangler deploy --config workers/<slug>/wrangler.toml"
   ```
4. Setup DNS: comunidade troca NS no registrar para os do Cloudflare → ativa zona → run `npm run worker:deploy:<slug>`

## Testando localmente — fluxo completo

```bash
# Terminal 1: stack inteira via Podman Compose
make up-build
#   → Docusaurus em localhost:3000
#   → Backend NestJS em localhost:3001
#   → Postgres + Stripe CLI etc.

# Terminal 2: Worker (proxy reverso)
npm run worker:dev:tisocial
#   → http://tisocial.localhost:8787

# Abrir http://tisocial.localhost:8787 no browser:
# - Home da T.I. Social com URL "limpa" (sem /comunidades/tisocial)
# - Estáticos vêm de localhost:3000
# - /api, /auth, /stripe, /ledger, /members vão pra localhost:3001
```

> **⚠️ Limitação atual em dev:** o backend no compose tem `FRONTEND_URL=http://localhost:3000` fixo. OAuth/Stripe callbacks caem no Docusaurus, não no Worker. Pra testar o fluxo whitelabel inteiro localmente, é necessário implementar as mudanças de backend descritas em `MULTISITE_PLAN.md §6` (OAuthState com `returnTo` + `ALLOWED_AUTH_RETURN_HOSTS`).

## Quando NÃO usar Worker

Se uma comunidade **não tem domínio próprio** (continua em `codaqui.dev/comunidades/<slug>`), **não precisa de Worker**. O Worker só faz sentido quando há um domínio externo apontando para Cloudflare.

## Anti-lock-in

A lógica do Worker (`workers/shared/index.js`) é genérica: **30 linhas de proxy HTTP com path rewrite**. Se um dia trocarmos Cloudflare por outra coisa (Caddy, Vercel Edge, Nginx, AWS Lambda@Edge), só portamos esse arquivo. As `wrangler.toml` viram config equivalente do novo runtime. Frontend Docusaurus e backend NestJS **não mudam** nada.
