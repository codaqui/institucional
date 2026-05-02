<!--
agent-context:
  related-files:
    - AGENTS.md — patterns e arquitetura do monorepo (seção "Multi-tenant communities")
    - DEVELOPMENT.md — setup de dev local
    - docusaurus.config.ts — config principal (presets, plugins, themeConfig)
    - sidebars.ts — sidebar das trilhas
    - src/theme/Root.tsx — MUI ThemeProvider (SSR-safe pattern)
    - src/theme/Navbar/Content/index.tsx — Navbar swizzled (whitelabel via resolveCommunityFromPath)
    - src/theme/muiTheme.ts — createCodaquiTheme(mode)
    - src/lib/community-context.ts — resolveCommunityFromPath
    - src/components/DonationFlow/index.tsx — fluxo de doação reusável
    - comunidades/tisocial/community.config.ts — config piloto
    - backend/src/main.ts — CORS + cookie config
    - backend/src/auth/auth.controller.ts — fluxo OAuth
    - backend/src/stripe/stripe.service.ts — checkout (success/cancel URLs)
agent-protocol:
  - Cada fase abaixo deve sair em PR isolado.
  - Fase 1 está praticamente completa; Fase 2 só inicia depois de fechar pendências.
  - Fase 3 (domínio próprio) requer mudanças coordenadas no backend + edge proxy.
-->

# MULTISITE_PLAN.md — Multi-Tenant Frontend para Comunidades Parceiras

> **Objetivo:** cada comunidade parceira tem um espaço próprio com identidade visual e conteúdo dedicados, idealmente em domínio próprio (`tisocial.org.br`, etc.), consumindo a mesma API NestJS e a mesma base de dados de Codaqui.
>
> **Restrição forte:** sem criar SPA novo. Reutilizar o Docusaurus existente.

---

## 0. TL;DR — onde estamos

- ✅ **Decidida**: Opção D1 (single Docusaurus + multi-instance + swizzle de Navbar/Layout)
- 🚧 **Em execução**: Fase 3 — login + doação cross-domain via Cloudflare Worker (~95% pronto, validado em dev local com `tisocial.localhost:8787`)
- ⏳ **Próximo**: provisionar zona `tisocial.org.br` no Cloudflare e cadastrar callback URL no GitHub OAuth App (ou broker)
- 💸 **Custo extra esperado**: R$ 0/mês (GitHub Pages free + Cloudflare Worker free, ou alternativa equivalente)

---

## 1. Estado Atual (resumo arquitetural)

| Camada | Tecnologia | Hosting | Observações |
|--------|-----------|---------|-------------|
| Site institucional | Docusaurus 3.9 (estático) | GitHub Pages — `codaqui.dev` | SSG; build no `gh-deploy.yml` |
| Backend | NestJS + TypeORM + Postgres | Servidor ARM64 (Podman + Traefik) | API REST em `api.codaqui.dev`, autenticação por GitHub OAuth + JWT (cookie httpOnly) |
| Storage | Não usado para uploads | — | Comprovantes vão para Google Drive (URL informada) |
| Pagamentos | Stripe Checkout + Webhooks | — | Per-community via `metadata.communityId` |
| Comunidades | `comunidades/<slug>/community.config.ts` | No bundle do site | Auto-discovery em build-time (resolver) |

**Stripe webhooks já são tenant-aware** (`metadata.communityId`). Ledger já segrega saldos por conta de comunidade (`/ledger/community-balances` é multi-tenant nativo). Estes pontos já funcionam — não precisam mudar para multisite.

---

## 2. Decisão arquitetural: Opção D1 (single Docusaurus)

> Exploramos três alternativas (D1, D2 e Opção A — SPA novo). **Escolhemos D1**. Resumo das outras está em §11 / Apêndice.

**D1 = Single Docusaurus + multi-instance + swizzle do Navbar/Layout.**

Cada comunidade vira:
- `comunidades/<slug>/community.config.ts` (branding, navMenu, features, slug Stripe)
- `comunidades/<slug>/blog/` (instância de `plugin-content-blog`)
- `comunidades/<slug>/docs/` (instância de `plugin-content-docs`)
- `src/pages/comunidades/<slug>/*.tsx` (páginas TSX: index, apoiar, transparencia, membro)

O **resolver** `resolveCommunityFromPath(pathname)` em `src/lib/community-context.ts` mapeia o prefixo do path → config. O **Navbar swizzled** detecta a comunidade pelo `useLocation()` e troca branding em runtime.

**Por que D1:**
- ✅ 1 build, 1 deploy (mantém o `gh-deploy.yml` atual)
- ✅ Sem novo SPA, sem novo repo, sem novo stack
- ✅ Onboarding ideal: criar pasta + adicionar páginas
- ✅ Domínio próprio é evolução opcional via edge proxy (Fase 3) — **não bloqueia entrega**

**Por que NÃO as alternativas:**
- D2 (build matrix com N repos): N repos pra manter, propagação cross-repo via dispatch é frágil
- Opção A (SPA Vite/React novo): contradiz a restrição de reusar Docusaurus; perde SSG/SEO

---

## 3. Status Fase 1 — T.I. Social piloto

### ✅ Implementado

| Componente | Onde | Notas |
|------------|------|-------|
| Config da comunidade | `comunidades/tisocial/community.config.ts` | Slug, theme, navMenu, features, hero, impact stats, exploreSection, channelsSection |
| Resolver de path | `src/lib/community-context.ts` | `resolveCommunityFromPath()` + array `COMMUNITIES` |
| Navbar whitelabel | `src/theme/Navbar/Content/index.tsx` | `buildCommunityItems()` substitui itens; `<CodaquiBackChip>` MUI Chip pra voltar |
| Página home | `src/pages/comunidades/tisocial/index.tsx` | Tudo derivado do config (textos, cores, cards, links) |
| Página apoiar | `src/pages/comunidades/tisocial/apoiar.tsx` | Usa `<DonationFlow lockedTargetId hideWallets authCommunitySlug>` |
| Página transparência | `src/pages/comunidades/tisocial/transparencia.tsx` | Hero + saldo card + `<TransactionTable>` real (filtros/paginação/drill-down) + CTAs |
| Página membro | `src/pages/comunidades/tisocial/membro/index.tsx` | Painel pessoal whitelabel |
| Blog | `comunidades/tisocial/blog/2026-03-26-aumigo-prestacao-de-contas.mdx` | 1 post inicial com cards MUI (impacto AUMIGO + Páscoa) |
| **DonationFlow reusável** | `src/components/DonationFlow/index.tsx` | Componente unificado entre Codaqui e comunidade. Props: `lockedTargetId`, `hideWallets`, `disableAuth`, `authCommunitySlug`, `accentColor[Dark]`, `title`, `subtitle` |
| Auth callback whitelabel | `src/pages/auth/callback.tsx` | Lê sessionStorage; renderiza logo + cor da comunidade durante spinner |
| **Login encouraged gate** | `src/components/DonationFlow` (banner + form bloqueado) | Card forte com 2 CTAs: "Entrar com GitHub" (primário) ou "Prefiro anônimo até R$ 100" (link). Form blur+disabled até escolha. Logado vira chip "Doando como @user" na cor da comunidade |
| Hooks de auth com whitelabel | `src/hooks/useAuth.ts` | `login({ returnTo, communitySlug })` e `logout(...)` salvam contexto em sessionStorage |

### 🟡 Pendente para fechar Fase 1

- [x] ~~**Auto-discovery de plugins**~~ — feito. `comunidades/index.ts` é a única fonte; `docusaurus.config.ts` faz `flatMap` sobre `COMMUNITIES_CONFIG` e gera plugins de blog/docs automaticamente respeitando `community.features.{blog,docs}`.
- [ ] **Link em `/sobre/ong`** apontando para `/comunidades/tisocial`
- [x] ~~Documentar onboarding em AGENTS.md~~ — feito (seção "Multi-tenant communities")
- [ ] `/sobre/ong` ganhar lista de comunidades com link para o portal whitelabel quando existir
- [ ] Smoke test final em build de produção (não só dev)

### 🔵 Fora do escopo da Fase 1 (decidido)

- ❌ **Página de eventos da T.I. Social** — `features.events: false`. T.I. Social não tem base de eventos próprios; reativar quando houver fonte de dados.
- ❌ **Auth dentro do navbar da comunidade** — removido pois domínio próprio é incerto na Fase 1. Login só dentro do `<DonationFlow>` (gate). Reavaliar depois da Fase 3.

---

## 4. Estrutura de diretórios (estado real do repo)

```
institucional/
├── docusaurus.config.ts              # presets + N instâncias de plugin-content-{docs,blog}
├── comunidades/                      # ⭐ pasta raiz das comunidades
│   └── tisocial/
│       ├── community.config.ts       # branding + slug + features + impact + hero
│       ├── blog/
│       │   └── 2026-03-26-aumigo-prestacao-de-contas.mdx
│       ├── docs/                     # placeholder (1 index.md mínimo recomendado)
│       └── (sidebars.ts opcional)
├── src/
│   ├── pages/
│   │   ├── comunidades/
│   │   │   └── tisocial/
│   │   │       ├── index.tsx          # home da comunidade
│   │   │       ├── apoiar.tsx         # delega para <DonationFlow>
│   │   │       ├── transparencia.tsx  # saldo + <TransactionTable>
│   │   │       └── membro/index.tsx   # painel pessoal whitelabel
│   │   ├── participe/apoiar.tsx       # delega para <DonationFlow> (sem comunidade)
│   │   └── auth/callback.tsx          # callback whitelabel (logo + cor da comunidade)
│   ├── components/
│   │   ├── DonationFlow/index.tsx     # ⭐ reusável (Codaqui + comunidades)
│   │   ├── TransactionTable/          # reusada em /transparencia + /comunidades/<slug>/transparencia
│   │   ├── TransactionDetailDialog/
│   │   └── NavbarAuth/                # community-aware via useLocation
│   ├── lib/
│   │   └── community-context.ts       # resolveCommunityFromPath + COMMUNITIES[]
│   ├── hooks/
│   │   └── useAuth.ts                 # login(opts) / logout(opts) com sessionStorage whitelabel
│   └── theme/
│       ├── Navbar/Content/index.tsx   # swizzled — buildCommunityItems + CodaquiBackChip
│       ├── Root.tsx                   # MUI ThemeProvider
│       └── muiTheme.ts                # createCodaquiTheme(mode)
└── (CNAME = codaqui.dev — intocado)
```

---

## 5. Fase 2 — replicar para outras comunidades

> Só começar depois que Fase 1 estiver 100% fechada e validada em produção.

**Checklist por comunidade nova** (passo-a-passo está em `AGENTS.md` → seção "Multi-tenant communities"):

1. Criar `comunidades/<slug>/community.config.ts`
2. Adicionar config no array `COMMUNITIES` em `src/lib/community-context.ts`
3. Criar `src/pages/comunidades/<slug>/{index,apoiar,transparencia}.tsx`
4. Registrar plugins de blog/docs em `docusaurus.config.ts`
5. Criar `comunidades/<slug>/{blog,docs}/` com pelo menos 1 arquivo cada
6. Confirmar que `metadata.communityId === '<slug>'` no Stripe checkout
7. `npm run typecheck && npm run build`
8. Smoke test (navbar troca de cor, doação vai pro Stripe certo)

**Comunidades-alvo Fase 2:** DevParaná, Elas no Código, CamposTech, Cloud Native Maringá.

**Ponto de atenção:** medir tempo de build com **2 comunidades** antes de adicionar uma 3ª. Estabelecer alerta se passar de 1.5× o baseline atual.

---

## 6. Fase 3 — domínio próprio (`tisocial.org.br`)

> **Objetivo concreto:** `https://tisocial.org.br` exibe o conteúdo de `https://codaqui.dev/comunidades/tisocial`, com login, doação Stripe e transparência funcionando como first-party.

### 6.1 O problema-chave: cross-origin cookies

Quando o usuário está em `tisocial.org.br` e faz fetch direto pra `api.codaqui.dev`, **cookies httpOnly cross-origin são bloqueados** por:
- Safari ITP
- Chrome 3rd-party cookie phaseout
- SameSite=Lax/Strict default em browsers modernos

Resultado: o login JWT no cookie do backend não persiste pro usuário no domínio da comunidade.

**Solução:** o domínio da comunidade precisa **proxy** todas as chamadas de API através de si mesmo. Assim cookies viram first-party.

### 6.2 Arquitetura da Fase 3

```
                    ┌──────────────────────────┐
   Browser ──HTTPS──┤ tisocial.org.br          │   Edge proxy (Worker / Caddy / Nginx / Vercel Edge / ...)
                    │ Catch-all route /*       │
                    └────────┬─────────────────┘
                             │
              ┌──────────────┴────────────────┐
              │                                │
              ▼ Path /, /blog, /apoiar, ...    ▼ Path /api/*, /auth/*, /stripe/*, /ledger/*
   ┌────────────────────────┐         ┌────────────────────────┐
   │ codaqui.dev            │         │ api.codaqui.dev        │
   │ /comunidades/tisocial  │         │ NestJS (Podman)        │
   │ (GitHub Pages estático)│         │                        │
   └────────────────────────┘         └────────────────────────┘
```

**Princípio:** o edge proxy é um componente **fino e portável** (essencialmente um reverse-proxy HTTP com path rewrite). Não importa qual tecnologia escolhemos — a interface é a mesma.

### 6.3 Implementação como **interface portável** (anti-lock-in)

A lógica do proxy é **~25 linhas** e cabe em qualquer runtime de edge/reverse-proxy. Isso significa que se um dia quisermos mudar de Cloudflare para outro provider (Fastly, Vercel Edge, AWS Lambda@Edge, ou self-hosted Caddy/nginx), **só trocamos o runtime**. A regra de roteamento é simples:

```
SE path == "/"
  ENTÃO redirect 301 → /comunidades/<slug>/
SE path começa com /api/, /auth/, /stripe/, /ledger/, /members/
  ENTÃO proxy → https://api.codaqui.dev{path}
SENÃO
  proxy → https://codaqui.dev{path}        (pass-through, sem rewrite)
```

**Decisão importante: pass-through em vez de path-rewrite.**

A primeira versão do Worker reescrevia `/comunidades/<slug>/foo` → `/foo` no browser (URL "limpa"). Isso quebrou o roteamento no client porque Docusaurus é SPA: o React Router renderiza páginas a partir de `window.location.pathname`. Sem o prefixo, o roteador buscava `/foo` (rota inexistente para a comunidade) e caía na home da Codaqui.

Pass-through preserva o pathname original. Trade-off: a URL exibida é `tisocial.org.br/comunidades/tisocial/apoiar` (não `tisocial.org.br/apoiar`). O redirect 301 em `/` garante que o entrypoint principal (`tisocial.org.br`) caia na home da T.I. Social com um clique.

Se no futuro quisermos URLs realmente limpas, opções: (a) build separado com `baseUrl: '/'` por comunidade (volta para Opção D2 do apêndice), (b) configurar React Router runtime com basename custom via window flag injetado pelo Worker.

#### Implementação A — Cloudflare Worker (recomendado para começar)

Ver código real e atualizado em `workers/shared/index.js`. Forma esquemática:

```javascript
const API_PATHS = ['/api/', '/auth/', '/stripe/', '/ledger/', '/members/'];

export default {
  async fetch(req, env) {
    const { STATIC_ORIGIN, API_ORIGIN, COMMUNITY_PREFIX } = env;
    const url = new URL(req.url);

    if (API_PATHS.some((p) => url.pathname.startsWith(p))) {
      return fetch(new URL(url.pathname + url.search, API_ORIGIN), req);
    }
    if (url.pathname === '/') {
      return Response.redirect(`${url.protocol}//${url.host}${COMMUNITY_PREFIX}/${url.search}`, 301);
    }
    return fetch(new URL(url.pathname + url.search, STATIC_ORIGIN), req);
  },
};
```

**Custo Cloudflare:** plano gratuito = 100k req/dia. Cobre confortavelmente 3-5k pageviews/dia (cada PV ≈ 10-20 reqs entre HTML/CSS/JS/imagens). Se uma comunidade explodir de tráfego, Workers Paid é U$5/mês.

#### Implementação B — Caddy (self-hosted, sem nuvem)

Caso queiramos rodar em qualquer servidor (inclusive o próprio podman ARM64 do backend), `Caddyfile`:
```
tisocial.org.br {
    handle /api/* /auth/* /stripe/* /ledger/* /members/* {
        reverse_proxy https://api.codaqui.dev
    }
    handle {
        rewrite * /comunidades/tisocial{uri}
        reverse_proxy https://codaqui.dev
    }
}
```
TLS automático via Let's Encrypt (Caddy faz isso nativo). Equivale 1:1 ao Worker mas roda como systemd/podman service.

#### Implementação C — Vercel Edge Function

`api/_middleware.ts` num projeto Vercel apontando `tisocial.org.br`:
```typescript
export default function middleware(req: Request) {
  const url = new URL(req.url);
  const apiPaths = ['/api/', '/auth/', '/stripe/', '/ledger/', '/members/'];
  if (apiPaths.some((p) => url.pathname.startsWith(p))) {
    return Response.redirect('https://api.codaqui.dev' + url.pathname + url.search);
  }
  return rewrite(`https://codaqui.dev/comunidades/tisocial${url.pathname}`);
}
```

#### Implementação D — Nginx tradicional

```nginx
server {
    listen 443 ssl;
    server_name tisocial.org.br;

    location ~ ^/(api|auth|stripe|ledger|members)/ {
        proxy_pass https://api.codaqui.dev;
    }
    location / {
        rewrite ^(.*)$ /comunidades/tisocial$1 break;
        proxy_pass https://codaqui.dev;
        sub_filter '/comunidades/tisocial' '';
        sub_filter_once off;
    }
}
```

> **A interface do proxy é a mesma em todos.** Isso é o anti-lock-in. Começamos com Cloudflare Worker (zero infra, free), e migramos quando/se fizer sentido.

### 6.4 Backend — mudanças necessárias

Para Fase 3 funcionar, **3 ajustes** no NestJS:

1. **OAuth state com `returnTo` assinado** (`auth.controller.ts`):
   - `GET /auth/github?returnTo=https://tisocial.org.br/auth/callback`
   - Backend codifica `returnTo` em JWT state com expiração curta (5min)
   - No callback, backend valida state e redireciona para `state.returnTo` (validado contra whitelist)
   - Whitelist em env: `ALLOWED_AUTH_RETURN_HOSTS=codaqui.dev,tisocial.org.br,*.localhost,localhost:3030`

2. **Stripe `originUrl` validado** (`stripe.service.ts`):
   - `POST /stripe/checkout-session` lê header `Origin` da request
   - Valida contra whitelist (`STRIPE_ALLOWED_ORIGINS` env)
   - Usa esse origin em `success_url`/`cancel_url` em vez de `FRONTEND_URL` fixo

3. **CORS continua restritivo:** porque o Worker proxia tudo, o backend só vê requests vindo do Worker (que do ponto de vista da rede sai do datacenter da Cloudflare/etc.). Não precisa abrir CORS para `tisocial.org.br`.

> Tabela `community_sites(slug, hosts[], isActive)` no banco é a evolução natural — backend lê whitelist do banco em vez de env. Mas pode ficar pra depois; env vars são suficientes pro piloto.

### 6.5 Como testar localmente — `*.localhost` (sem editar `/etc/hosts`)

DNS RFC 6761: qualquer subdomínio de `.localhost` resolve para `127.0.0.1` automaticamente em browsers modernos (Chrome, Firefox, Safari, Edge).

**Stack local mínima:**

| Endpoint | URL | Como sobe |
|----------|-----|-----------|
| Backend | `http://api.localhost:3001` | `cd backend && npm run start:dev` (ou Podman) |
| Site Codaqui | `http://codaqui.localhost:3030` | `npm start -- --port 3030` |
| Proxy edge local | `http://tisocial.localhost:8080` | Caddy (recomendado) ou Wrangler |

**Caddy local** (mais simples, não precisa instalar nada da Cloudflare):
```bash
brew install caddy   # ou apt install caddy

# Caddyfile.local
tisocial.localhost:8080 {
    handle /api/* /auth/* /stripe/* /ledger/* /members/* {
        reverse_proxy http://api.localhost:3001
    }
    handle {
        rewrite * /comunidades/tisocial{uri}
        reverse_proxy http://codaqui.localhost:3030
    }
}

caddy run --config Caddyfile.local
```

Acesse `http://tisocial.localhost:8080` — vê a home da T.I. Social como se fosse `tisocial.org.br`. Login, doação e transparência funcionam first-party.

**Wrangler** (alternativa, testa o Worker exatamente como vai rodar em produção):
```bash
npm i -g wrangler
wrangler dev worker/tisocial.dev.js --local --port 8787
```
Onde `worker/tisocial.dev.js` é o Worker com origins apontando para `*.localhost`.

### 6.6 Deploy em produção (Cloudflare Worker)

Pré-requisito comunidade: domínio comprado (ex: `tisocial.org.br`) + acesso ao painel do registrar (registro.br/GoDaddy/etc.).

Processo:
1. **Cloudflare**: Add site → `tisocial.org.br` (free plan) → copiar nameservers
2. **Comunidade**: trocar NS no registrar para os do Cloudflare (propaga em ~1h, máx 24h)
3. **Cloudflare**: após "Active", criar Worker → colar `worker/tisocial.js` → atribuir Route `tisocial.org.br/*`
4. **Backend**: adicionar `tisocial.org.br` em `ALLOWED_AUTH_RETURN_HOSTS` e `STRIPE_ALLOWED_ORIGINS`. Reload do podman.
5. **Smoke test**: acessar `https://tisocial.org.br`, login GitHub, doação de R$ 5, conferir aparição em `/transparencia`.

### 6.7 Por que GitHub Pages **não** atrapalha

Preocupação levantada: "meu deploy é via GitHub Pages, isso afeta esse design?"

**Resposta:** Não. O Worker é uma camada de proxy **acima** do GitHub Pages. Ele faz `fetch()` HTTP comum para `codaqui.dev` (que GH Pages serve publicamente). Seu fluxo de deploy continua **idêntico**:

| Hoje | Com Fase 3 |
|------|-----------|
| `gh-deploy.yml` builda Docusaurus → publica em `codaqui.dev` | **Igual.** |
| `CNAME = codaqui.dev` no repo | **Igual.** Intocado. |
| Backend Podman ARM64 + Traefik | **Igual** + 2 env vars novas no NestJS |
| Nada de Cloudflare hoje | **Acrescenta** Cloudflare como CDN/Worker pros domínios das comunidades |

GitHub Pages não precisa nem saber que `tisocial.org.br` existe.

### 6.8 Alternativa: migrar para **Cloudflare Pages** (se 5+ comunidades)

Caso a Fase 2 prove muito bem-sucedida e tenhamos 5+ comunidades com domínio próprio, **migrar de GH Pages para Cloudflare Pages** vira atrativo:

| Critério | GH Pages + Worker | Cloudflare Pages nativo |
|----------|-------------------|------------------------|
| Multi-domínio nativo | ❌ Worker per domain | ✅ Vincula N domínios à mesma Page |
| Path rewrite | Worker (~30 linhas) | `_redirects` file (1 linha por comunidade) |
| Preview por PR | gh-pages branch | Nativo (cada PR = URL única) |
| Esforço de migração | 0 | Médio |
| Custo | R$ 0 | R$ 0 |

**Decisão atual:** ficar em GH Pages enquanto for 1-2 comunidades. Reavaliar quando atingir 5.

### 6.9 Riscos da Fase 3

| Risco | Mitigação |
|-------|-----------|
| Loop de redirect (callback OAuth → `codaqui.dev` → proxiado de volta) | OAuth state com `returnTo` resolve: backend redireciona pro domínio da comunidade direto |
| Cookies do backend setados em `Domain=codaqui.dev` não chegam em `tisocial.org.br` | Backend já seta cookie sem `Domain` explícito → Worker proxia → cookie vira first-party de `tisocial.org.br` automático |
| Stripe webhook não sabe a comunidade | Já resolvido: webhook tem `metadata.communityId` |
| HTML rewrite quebra alguma URL absoluta | Validar com Wrangler/Caddy antes de produção; rewriter é simples (substring replace) |
| Build do Docusaurus aumenta com N comunidades | Medir após 2 comunidades; alerta se > 1.5× baseline |
| Lock-in com Cloudflare | **Mitigado:** lógica do proxy é portável (Caddy/Vercel/Nginx). Ver §6.3 |

### 6.10 Checklist de implementação — Fase 3

**Backend:**
- [x] `ReturnToMiddleware` captura `?returnTo=<url>` em `/auth/github` e `/auth/logout`, valida contra whitelist e persiste em cookie httpOnly de 5min (`backend/src/auth/return-to.middleware.ts`)
- [x] `GET /auth/github/callback` resolve `returnTo` em duas camadas (state JWT primário + cookie fallback)
- [x] `GET /auth/logout` lê cookie e redireciona para a comunidade certa
- [x] `POST /stripe/checkout-session` usa headers `Origin`/`Referer` validados via `resolveOrigin()` para montar `success_url`/`cancel_url`
- [x] `POST /stripe/checkout-session` aceita `returnPath` opcional no body (sanitizado: `/...`, sem `//host`) — preserva contexto whitelabel ao voltar do Stripe
- [x] Helper compartilhado `backend/src/common/allowed-origins.ts` (`isAllowedOrigin`, `resolveReturnUrl`, `resolveOrigin`, `getDefaultOrigin`)
- [x] Whitelist em **`backend/src/common/allowed-origins.config.ts`** (arrays TS commitados — sem env var, sem I/O em runtime)
- [x] **OAuth state JWT** (`backend/src/auth/github-auth.guard.ts`) — resolve `returnTo` cross-domain, viaja na URL OAuth (não depende de cookie no domínio do backend)
- [x] **Token handoff via fragment + `POST /auth/finalize`** — backend devolve JWT efêmero (TTL 2min, `aud: auth-handoff`) no `#token=...` da URL de retorno; frontend troca pelo cookie de sessão via finalize, garantindo que o `Set-Cookie` cai no domínio whitelabel correto (passa pelo Worker)
- [x] `GET /health` (rota explícita) — sobrevive ao redirect 301 do Worker em `/` que quebraria o ApiHealthBanner em deploys whitelabel
- [x] Frontend `useAuth.login()` envia `returnTo = ${origin}/auth/callback` (página intermediária) para evitar colisão de query params (`?status=success` é interpretado pelo DonationFlow como retorno de Stripe)
- [ ] Testes unitários (whitelist, middleware, guard, finalize)

**Edge proxy — Cloudflare Worker:**
- [x] Código reusável em `workers/shared/index.js` (lê env vars `STATIC_ORIGIN`, `API_ORIGIN`, `COMMUNITY_PREFIX`)
- [x] Lista explícita de paths que vão pra API: `/api/*`, `/auth/github*`, `/auth/me`, `/auth/logout`, `/auth/finalize`, `/stripe/*`, `/ledger/*`, `/members/*`, `/health`. **`/auth/callback` é página do frontend e fica no pass-through.**
- [x] `/` faz redirect 301 para `${COMMUNITY_PREFIX}/` (entrypoint limpo)
- [x] T.I. Social: `workers/tisocial/wrangler.toml` (prod) + `wrangler.dev.toml` (local em `localhost:3000`/`:3001`)
- [x] Scripts npm: `worker:dev:tisocial`, `worker:deploy:tisocial`
- [x] Targets Make: `worker-dev-tisocial`, `worker-deploy-tisocial`
- [x] `wrangler` em devDependencies
- [x] Documentação em `workers/README.md`
- [ ] Provisionar zona Cloudflare para `tisocial.org.br` (NS troca no registrar)
- [ ] Configurar GitHub OAuth app (callback URL em `https://api.codaqui.dev/auth/github/callback`) — funciona como callback único multi-domínio porque o `returnTo` viaja no state JWT

**Frontend:**
- [x] `useAuth.login()`/`logout()` mandam `returnTo` absoluto baseado em `globalThis.location.origin`
- [x] `src/lib/api-url.ts` — `resolveApiUrl()` (detecta deploy whitelabel via origin) + `resolveCodaquiUrl()` (volta da navbar adapta entre dev/prod)
- [x] `CodaquiBackChip` na navbar usa `resolveCodaquiUrl()` (URL absoluta) — evita loop em domínio whitelabel
- [x] `/auth/callback` lê `#token=...` do fragment, POSTa para `/auth/finalize`, limpa fragment via `history.replaceState`
- [x] `DonationFlow`: envia `returnPath: location.pathname` no body do checkout (preserva URL whitelabel no retorno do Stripe)
- [x] `DonationFlow`: aviso info quando `isRecurring && isWhitelabelDeploy` — orienta usuário a administrar assinatura pelo portal da Codaqui ou Stripe
- [x] `ApiHealthBanner` chama `${apiUrl}/health` (não a raiz, que vira HTML em deploys whitelabel)
- [ ] Confirmar que sitemap por comunidade tem URL canonical correta quando há domínio próprio (custom `transformItems` em `docusaurus-plugin-sitemap`)

**Operacional:**
- [x] Onboarding documentado em `AGENTS.md` (seção "Domínio próprio via Cloudflare Worker")
- [ ] Template de email pra registrar.br (instrução de troca de NS)
- [ ] Runbook Cloudflare (Add site → Worker → Route)

**Comandos rápidos:**

```bash
# Local (após `make up-build`):
make worker-dev-tisocial
# → http://tisocial.localhost:8787

# Produção (após zona ativa no Cloudflare):
make worker-deploy-tisocial
# → tisocial.org.br/* roteia pelo Worker
```

Adicionar nova comunidade com domínio próprio:
1. Criar `workers/<slug>/wrangler.toml` + `wrangler.dev.toml` (copiar de `tisocial/`)
2. Adicionar scripts `worker:dev:<slug>` / `worker:deploy:<slug>` em `package.json`
3. Adicionar targets `worker-dev-<slug>` / `worker-deploy-<slug>` em `Makefile`
4. Adicionar a origem em `ALLOWED_ORIGINS_PROD` em `backend/src/common/allowed-origins.config.ts`
5. (Opcional) Adicionar a origem em `ALLOWED_ORIGINS_DEV` para testes locais
6. Provisionar zona Cloudflare para o domínio
7. **Não** precisa mexer no GitHub OAuth App: o callback URL `api.codaqui.dev/auth/github/callback` é único; o `returnTo` viaja no `state` JWT


---

## 7. Refinamentos não previstos no plano original (já entregues)

Durante a Fase 1 surgiram melhorias que valem ser consolidadas:

- **Auth callback whitelabel** (`/auth/callback`): logo + cor da comunidade durante spinner. Resolve UX feio do callback genérico Codaqui mesmo quando o usuário veio do `/comunidades/tisocial/apoiar`.
- **`useAuth.login(opts)` / `logout(opts)`**: aceitam `{ returnTo, communitySlug }`. Salvam contexto em sessionStorage para o callback resolver community + redirect.
- **`<CodaquiBackChip>`**: chip MUI bonito no navbar da comunidade pra voltar pra Codaqui — substitui um "voltar" genérico.
- **DonationFlow extraído**: antes `/participe/apoiar` era ~600 linhas custom; agora ~25 linhas que delegam pra `<DonationFlow>`. Mesma página rica com presets, mensal/anual, gate de login, embedded checkout — agora reusável.
- **Login encouraged gate**: form de doação fica blur+disabled até usuário escolher entre "Entrar com GitHub" (CTA grande) ou "Prefiro anônimo (até R$ 100)" (link discreto). Logado vira chip "Doando como @user" na cor da comunidade.

---

## 8. Riscos e mitigações (gerais)

| Risco | Mitigação |
|-------|-----------|
| Build cresce com N comunidades | Medir após 2; alerta se > 1.5× baseline |
| Tema por path quebra com SSR | Tema neutro no SSR + aplicar tema da comunidade após hidratação (mesmo pattern do dark mode no `Root.tsx`) |
| Conflito de slugs em plugin instances | `id` único derivado do slug da pasta; build falha se duplicado |
| Stripe success_url quebra com domínio próprio | Resolvido na Fase 3 (origin validado) |
| Membros logados em `codaqui.dev` perdem sessão em `tisocial.org.br` | Resolvido na Fase 3 via Worker proxy (cookie first-party) |
| Lock-in Cloudflare | Lógica do proxy é portável (§6.3) |

---

## 9. Onboarding rápido — referência para Fase 2

> Documentação detalhada está em `AGENTS.md` → seção "Multi-tenant communities". Aqui o resumo executivo:

**Adicionar uma comunidade nova:**
1. Criar pasta `comunidades/<slug>/` (kebab-case, igual ao `metadata.communityId` Stripe)
2. Criar `community.config.ts` (copiar de tisocial e adaptar)
3. Adicionar config no array `COMMUNITIES` em `src/lib/community-context.ts`
4. Criar páginas `src/pages/comunidades/<slug>/{index,apoiar,transparencia}.tsx` (templates da tisocial)
5. Registrar plugins blog/docs em `docusaurus.config.ts`
6. Criar `comunidades/<slug>/{blog,docs}/` com pelo menos 1 arquivo
7. `npm run typecheck && npm run build`
8. Smoke test: navbar troca de cor, doação vai pro Stripe certo, transparência mostra ledger correto

**Tempo estimado** (com toda infra atual): 1-2 horas de trabalho focado por comunidade nova.

---

## 10. O que **não** está neste plano

- ❌ Criar SPA novo (Vite/React standalone) — descartado
- ❌ Mover `codaqui.dev` para fora do Docusaurus
- ❌ Stack diferente por comunidade (continua Docusaurus pra todos)
- ❌ Renomear `src/pages/` existente
- ❌ Mexer no Docusaurus principal além de adicionar plugins e fazer swizzles do Navbar/Layout

---

## 11. Apêndice — opções alternativas (referência)

### Opção D2 — Build matrix com N repos

Cada comunidade tem repo próprio (`codaqui/site-tisocial`) que estende um template (`codaqui/community-template`). N repos = N GH Pages = N CNAMEs nativos.

**Descartado para Fase 1-2** porque: N repos pra manter, propagação cross-repo via dispatch é frágil, onboarding pesado (criar repo + permissão + DNS + env vars CI a cada comunidade nova).

**Possível upgrade path** se uma comunidade específica precisar de:
- Time de conteúdo grande (volume justifica repo dedicado)
- Independência total de calendário de releases
- Domínio próprio com SSL nativo (sem proxy)

D1 e D2 podem coexistir: a maioria fica em D1; uma ou duas que cresçam migram para D2 sem refazer trabalho.

### Opção A — SPA novo (Vite + React)

Era a recomendação inicial. **Descartada** a pedido para reaproveitar Docusaurus.

Vantagens hipotéticas: 1 deploy serve N domínios, onboarding sem rebuild.
Desvantagens reais: escrever app novo do zero, perder SSG/SEO, duplicar componentes (Hero, Cards, Forms, Theme).

---

## 12. Resumo executivo

> **Estado:** Opção D1 escolhida. Fase 1 ~95% completa (T.I. Social piloto). Fechando pendências antes de Fase 2.
>
> **Próximas decisões abertas:**
> - Fechar Fase 1 (link em /sobre/ong + smoke test prod) → Fase 2 (replicar para 2ª comunidade)
> - **OU** pular para Fase 3 (domínio próprio com edge proxy + ajustes mínimos no backend)
>
> **Custo de operação esperado:** R$ 0/mês com Cloudflare free + GH Pages free. Domínio é responsabilidade da comunidade parceira (~R$ 40/ano).
>
> **Anti-lock-in:** o edge proxy (Worker) é uma interface portável de ~30 linhas — substituível por Caddy, Vercel Edge, Nginx ou Lambda@Edge sem refazer o frontend ou o backend.
