# `workers/` — Cloudflare Workers para domínios próprios das comunidades

> Cada comunidade parceira que ganha **domínio próprio** (ex: `tisocial.org.br`) usa um Cloudflare Worker como reverse-proxy. Ver **docs/plans/multisite/README.md §6** para o desenho arquitetural completo.

## Estrutura

```
workers/
├── shared/
│   └── index.js              # Worker reusável — mesmo código serve qualquer comunidade
├── tisocial/
│   ├── wrangler.toml         # config produção: route + vars
│   └── wrangler.dev.toml     # config local: vars apontando pra *.localhost
├── elasnocodigo/
│   ├── wrangler.toml
│   └── wrangler.dev.toml
├── devparana/
│   ├── wrangler.toml
│   └── wrangler.dev.toml
└── README.md                 # este arquivo
```

**Regra:** o **código** do Worker (`workers/shared/index.js`) é um só. Cada comunidade tem só um `wrangler.toml` declarando suas vars (`STATIC_ORIGIN`, `API_ORIGIN`, `COMMUNITY_PREFIX`) e a route.

## O que o Worker faz

```
Browser ── tisocial.org.br/                ──301──► tisocial.org.br/comunidades/tisocial/
Browser ── tisocial.org.br/<api-path>      ──proxy──► api.codaqui.dev/<path>
Browser ── tisocial.org.br/<other>         ──proxy──► codaqui.dev/<other>   (pass-through)
```

Onde `<api-path>` é qualquer rota do backend: `/api/*`, `/auth/github|me|logout|finalize`, `/stripe/*`, `/ledger/*`, `/members/*`, `/events/*`, `/reimbursements/*`, `/companies/*`, `/club/*`, `/vendors/*`, `/account-transfers/*`, `/admin/*`, `/notifications/*` (mais `/health` e `/docs`). A lista vive em `API_PREFIXES`/`API_EXACT_PATHS` em `workers/shared/index.js` e é validada contra os controllers do backend. Nota: `/auth/callback` **não** é proxy — é página do Docusaurus que finaliza o OAuth.

**Por que pass-through (e não rewrite de path):** Docusaurus é SPA. O React Router renderiza páginas com base em `window.location.pathname`. Se reescrevêssemos `/comunidades/tisocial/foo` para `/foo` no browser, o roteador procuraria a rota `/foo` (que não existe pra T.I. Social) e renderizaria a home da Codaqui. Pass-through preserva o pathname original, garantindo que o SPA carregue a página correta. O redirect inicial em `/` dá ao usuário um entrypoint limpo (`tisocial.org.br` → home da T.I. Social).

**Reescrita de metadados sociais:** ainda no pass-through, o Worker intercepta respostas `text/html` e troca `https://codaqui.dev` por `https://tisocial.org.br` **somente** dentro de `<meta property="og:url">` e `<link rel="canonical">`. Isso faz os cards do WhatsApp/Twitter/LinkedIn mostrarem o domínio próprio da comunidade, sem alterar links de navegação, assets ou scripts.

Cookies do backend ficam **first-party** em `tisocial.org.br` automaticamente, sem cross-origin blocking.

## Comandos

> Todos rodam da raiz do repo.

| Comando | O que faz |
|---------|-----------|
| `npm run worker:dev:tisocial` | Sobe Worker localmente em `http://tisocial.localhost:8787`. **⚠️ Roda wrangler no host**, mas o `wrangler.dev.toml` aponta para os hostnames do compose (`docusaurus:3000`, `backend:3000`), que só resolvem dentro da rede Docker — ver "Testando localmente" abaixo. |
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

**Caminho suportado: via compose.** O `compose.yaml` já inclui um serviço `worker-<slug>` por comunidade (imagem `workers/Dockerfile`), que sobe o wrangler **dentro da rede Docker** — onde os hostnames `docusaurus:3000` / `backend:3000` do `wrangler.dev.toml` resolvem:

```bash
make up-build
#   → Docusaurus em localhost:3000
#   → Backend NestJS em localhost:3001
#   → Workers: tisocial.localhost:8787, elasnocodigo.localhost:8788, devparana.localhost:8789
```

Abrir `http://tisocial.localhost:8787` no browser:
- Home da T.I. Social com URL "limpa" (sem /comunidades/tisocial)
- Estáticos vêm do container `docusaurus:3000`
- Rotas de API (`/auth`, `/stripe`, `/ledger`, `/members`, `/events`, etc.) vão para `backend:3000`

**Alternativa no host:** `npm run worker:dev:<slug>` executa o wrangler fora do Docker e, com o `wrangler.dev.toml` atual, falha ao resolver `docusaurus`/`backend`. Para rodar no host, sobrescreva as vars apontando para as portas publicadas pelo compose (`3000` Docusaurus, `3001` backend — ver `compose.yaml`):

```bash
npx wrangler dev --config workers/tisocial/wrangler.dev.toml --local --port 8787 \
  --var STATIC_ORIGIN:http://localhost:3000 --var API_ORIGIN:http://localhost:3001
```

> **⚠️ Limitação atual em dev:** o backend no compose tem `FRONTEND_URL=http://localhost:3000` fixo. OAuth/Stripe callbacks caem no Docusaurus, não no Worker. Pra testar o fluxo whitelabel inteiro localmente, é necessário implementar as mudanças de backend descritas em `docs/plans/multisite/README.md §6` (OAuthState com `returnTo` + `ALLOWED_AUTH_RETURN_HOSTS`).

## Quando NÃO usar Worker

Se uma comunidade **não tem domínio próprio** (continua em `codaqui.dev/comunidades/<slug>`), **não precisa de Worker**. O Worker só faz sentido quando há um domínio externo apontando para Cloudflare.

## Anti-lock-in

A lógica do Worker (`workers/shared/index.js`) é genérica: **30 linhas de proxy HTTP com path rewrite**. Se um dia trocarmos Cloudflare por outra coisa (Caddy, Vercel Edge, Nginx, AWS Lambda@Edge), só portamos esse arquivo. As `wrangler.toml` viram config equivalente do novo runtime. Frontend Docusaurus e backend NestJS **não mudam** nada.
