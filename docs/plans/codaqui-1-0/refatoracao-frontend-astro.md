<!-- AGENT-INDEX
purpose: Plano detalhado (sem código) da refatoração do frontend Docusaurus → Astro 5 + ilhas React (MUI v9 + Tailwind v4), com multi-tenant real por projeto Cloudflare Pages e fim dos Workers mantidos — executado como Fase 0, ANTES da Fase 1a do plano 1.0.0.
audience: Presidência, mantenedores, AI agents implementando a Fase 0.
status: design aprovado em 2026-10-05 (Astro monolito = Abordagem A; build matrix por tenant + Pages Function de proxy; MUI v9 + Tailwind v4) — aguardando plano de implementação da Fase 0.1 (esqueleto + POC); ampliado em 2026-10-20 com o Design System Codaqui (tokens `--cq-*` adotados na 0.1, correção de contraste WCAG do verde acionável, página pública /design-system na 0.3 — ver design-system.md).
sections:
  - Contexto e motivação
  - Decisões de design (2026-10-05)
  - Arquitetura geral e layouts
  - Mapa de rotas
  - Ilhas React e regra de hidratação
  - Camada de UI (MUI v9 + Tailwind v4)
  - Multi-tenant sem workers/
  - Contratos de dados e build (o que não muda)
  - Conteúdo, SEO e redirects
  - Fases de transição (0.1–0.6) e critérios de pronto
  - Limites Cloudflare Pages (verificados)
  - Riscos e pontos abertos
  - Fora de escopo
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (esta spec é a Fase 0; anexa oficial)
  - docs/plans/codaqui-1-0/cadastro-projeto-extensao.md — detalhamento do subsistema C (Fase 4)
  - docs/plans/multisite/README.md — plano multisite D1 (será encerrado/substituído por esta spec na Fase 0.5)
  - docs/adrs/004-multisite-communities.md — ADR do whitelabel atual (supersedida parcialmente)
  - AGENTS.md — padrões do monorepo (será reescrito na Fase 0.6 para o stack Astro)
  - docs/plans/codaqui-1-0/design-system.md — ⭐ Design System Codaqui: tokens canônicos adotados na 0.1 e página pública /design-system na 0.3 (anexo, 2026-10-20)
agent-protocol:
  - Cada subfase 0.x sai em PR isolado, com Docusaurus no ar até a 0.6 (cutover).
  - Contratos de dados (static/events, social-stats, snapshots, API) NÃO mudam — o refactor é só da camada de apresentação.
  - Todo .md criado neste repo exige header AGENT-INDEX (ver AGENTS.md).
-->

# Refatoração de Frontend — Docusaurus → Astro (Fase 0 do Codaqui 1.0.0)

> **Origem:** discussão de 2026-10-05. O Docusaurus serviu bem por ~1 ano, mas virou limitador: tudo que não é blog/trilha foi feito "puxadinho" (páginas app dentro de chrome de site de docs), o mobile sofre com o runtime SPA inteiro em toda página, e o multi-tenant depende de hacks (Navbar swizzled, resolução de branding em runtime, Worker pass-through com URL suja). Este documento é **anexo oficial** do [plano 1.0.0](README.md) e vira a **Fase 0**, executada **antes** da Fase 1a — as ~25 páginas novas do 1.0.0 nascerão direto no stack novo.

## Contexto e motivação

### Dores atuais (diagnóstico 2026-10-05)

1. **Mobile:** Docusaurus envia o runtime SPA completo + React + MUI em **toda** página — inclusive um post de blog. Páginas app (`/admin/*`, `/membro`, check-in) ficam esmagadas dentro do chrome de site de documentação (navbar de docs, breadcrumbs, sidebar). Tudo que não é blog foi "puxadinho".
2. **Multi-tenant fake:** branding resolvido em **runtime** via `resolveCommunityFromPath` + Navbar swizzled; o Worker de `tisocial.org.br` é obrigado a fazer **pass-through** (sem rewrite) porque o React Router depende de `window.location.pathname` — resultado: URL suja (`tisocial.org.br/comunidades/tisocial/...`), rewrite de `og:url` no edge e cookies que só funcionam por causa do proxy.
3. **Escalabilidade do 1.0.0:** o plano-mãe adiciona ~25 páginas admin/app (AdminLayout com sidebar, painel do mentor, filas de aprovação, central de relatórios). Construir isso sobre o chrome do Docusaurus perpetua o problema.

### Por que Astro (Abordagem A, escolhida entre 3)

| Critério | A. Astro monolito ✅ | B. Strangler (Astro + Docusaurus residual) | C. Next.js `output: 'export'` |
|---|---|---|---|
| Mobile (bundle/chrome) | HTML real + ilhas; post de blog sai com ~0 KB de JS | Resolve só metade | SPA-ish, bundle cheio |
| Multi-tenant limpo | HTML por rota → rewrite real ou matrix de build | Só no lado Astro | Depende de Worker igual |
| Fim dos "puxadinhos" | ✅ um framework, layout por tipo de página | ❌ dois stacks, duas navs | ✅ |
| Conteúdo (blog/trilhas/snapshots) | Content collections nativas | Intocado | Manual, sem collections |
| Esforço / risco | Alto uma vez / médio (fases + rollback) | Médio + arrasto de meses | Alto, sem ganho sobre Astro |

**Decisivos contra Next.js:** o static export castra o framework (sem middleware, sem ISR, sem rewrites) — pagaríamos a complexidade sem usar o diferencial. **Contra o strangler:** a fronteira entre os dois stacks viraria mais um puxadinho, exatamente o que se quer eliminar.

## Decisões de design (alinhadas em 2026-10-05)

1. **Stack:** Astro 5 (`output: 'static'`) + `@astrojs/react` + MDX + Tailwind v4 + MUI v9. TypeScript strict, Node 24, mesmo monorepo.
2. **UI:** MUI v7 → **v9** ([guia oficial](https://mui.com/material-ui/migration/upgrade-to-v9/) — a11y, keyboard nav, DOM mais próximo da plataforma) como sistema de componentes dos app-shells; **Tailwind v4** para layout/utilitários e componentes `.astro` ([integração oficial MUI + Tailwind v4](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/)).
3. **Timing:** refatoração **antes** da Fase 1a do 1.0.0 (as páginas novas já nascem no Astro; nada é escrito duas vezes).
4. **Multi-tenant:** **build matrix por tenant** — um projeto Cloudflare Pages por comunidade, domínio próprio nativo, rotas limpas em `/`. **Fim da pasta `workers/`**: o proxy de API vira uma **Pages Function** (`functions/api/[[path]].ts`) que entra automaticamente em todo build.
5. **Hosting:** Cloudflare Pages (free), deploy por **direct upload** via GitHub Actions (`wrangler pages deploy`) — o build roda no Actions (grátis, repo público), sem consumir a quota de 500 builds/mês do Pages.
6. **Contratos intocados:** backend, snapshots, workflows de sync, Stripe, Giscus, gtag — o refactor é só da camada de apresentação.
7. **Custo:** R$ 0/mês (Pages free: 100 projetos, 100 domínios/projeto, 20 mil arquivos/deploy — usamos ~2 mil).

## Arquitetura geral e layouts

O fim do chrome único: cada tipo de página tem o layout que precisa.

```
src/
├── layouts/
│   ├── BaseLayout.astro        # <html>, fonts, SEO/OG/JSON-LD, gtag, footer, script de tema anti-FOUC
│   ├── PublicLayout.astro      # header público + container — páginas institucionais
│   ├── AppLayout.astro         # app-shell autenticado (sidebar/topbar) — /membro, /admin/*
│   ├── CommunityLayout.astro   # branding do tenant — páginas de comunidade
│   └── ContentLayout.astro     # blog/trilhas: TOC, sidebar de docs, Giscus
├── pages/                      # rotas estáticas (mapa na próxima seção)
├── components/
│   ├── astro/                  # .astro zero-JS: cards, heroes, tabelas públicas, badges
│   └── islands/                # ilhas React: auth, admin, check-in, doação, forms
├── content/
│   ├── blog/                   # migração de blog/ (MD/MDX, slugs legados)
│   └── trilhas/                # python/, github/ com sidebar própria
├── data/                       # snapshots consumidos em build (events, members, social-stats)
├── lib/                        # auth-client, tenant-config, formatters, event-path
└── functions/
    └── api/[[path]].ts         # Pages Function: proxy de API (único "worker" que resta)
```

**Durante a transição** o app Astro pode viver em `frontend/` e ser promovido à raiz na Fase 0.6 — decisão de implementação da 0.1, registrada no plano dela.

## Mapa de rotas

Todas as URLs atuais são preservadas 1:1 — é requisito de SEO e de links indexados no Google.

| Hoje (Docusaurus) | Amanhã (Astro) | Tipo de render |
|---|---|---|
| `/`, `/contato`, `/projetos`, `/transparencia`, `/sobre/*`, `/bio` | idem | `.astro` puro + ilhas pontuais |
| `/blog` e `/blog/YYYY/MM/DD/slug` (frontmatter `slug` legado) | idem, via content collection | content + MDX |
| `/blog/category/*` (`tagsBasePath`) | idem, via rotas dinâmicas da collection | content |
| `/trilhas/*` (python, github, sidebars manuais) | idem, collection + sidebar config própria | content |
| `/eventos`, `/eventos/<slug>`, `/eventos/<source>/<sourceId>/<id>` | idem, `getStaticPaths` lendo `static/events/index.json` | `.astro` + ilha de inscrição/checkout |
| `/@<handle>` (OG/JSON-LD Person) | idem, `getStaticPaths` (fetch `GET /members` em build, falha não quebra build) | `.astro` |
| `/membro/*`, `/admin/*` | idem, com `AppLayout` real | ilhas `client:only="react"` |
| `/comunidades/<slug>/*` | **no build do tenant:** rotas limpas em `/`; no build codaqui: segue `/comunidades/<slug>/*` | `.astro` + ilhas |
| `/auth/callback` | idem — página que finaliza o OAuth | ilha |
| Redirects legados (`/quero/*`, `/team`, `/contact`, `/conduta`, `/ong`, `/timeline`, `/pais_responsaveis`, `/sobre/timeline`) | `_redirects` do Pages (limite 2.100 — usamos < 20) | edge |
| 404 custom com redirect `/@handle` | página 404 do Astro com mesma lógica | `.astro` + ilha |

**Plugins locais eliminados:** `src/plugins/event-pages.ts` e `src/plugins/member-pages.ts` viram `getStaticPaths` idiomáticos — menos código, sem API de plugin do Docusaurus. Os helpers `buildEventPath`/`buildEventJsonLd` migram para `src/lib/` quase 1:1.

## Ilhas React e regra de hidratação

A resposta para o mobile: **o padrão é zero JavaScript**.

| Diretiva | Onde | Por quê |
|---|---|---|
| (nenhuma — `.astro` puro) | Todo o site público institucional, listagens, transparência read-only, blog, trilhas | 0 KB de JS; LCP e INP muito melhores no 4G |
| `client:visible` | Abaixo da dobra ou interação tardia: Giscus, contadores, murais | Hidrata só ao entrar na viewport |
| `client:load` | Vivo no primeiro paint: NavbarAuth, toggle de tema | Interatividade imediata onde importa |
| `client:only="react"` | Páginas app que dependem de `window`/auth: `/admin/*`, `/membro/*`, check-in | SSR não se aplica; `AppLayout` mostra skeleton |

Comparativo: hoje um post do blog carrega runtime SPA + React + MUI + Emotion; no Astro sai HTML+CSS puros. A página de check-in hidrata apenas a própria ilha — e o app-shell dela é mobile-first de verdade, não uma página de docs adaptada.

**Auth nas ilhas:** `useAuth`/`authFetch` viram `src/lib/auth-client.ts` framework-agnostic (fetch com cookie httpOnly; 401 → logout + redirect), com hook React fino por cima para as ilhas. Contrato com o backend inalterado.

**Dark mode simplificado:** hoje é MutationObserver no `data-theme` do Docusaurus (com a restrição "nunca `useColorMode` no Root"). No Astro o tema é nosso: script inline no `<head>` lê `localStorage`/`prefers-color-scheme` antes do primeiro paint (anti-FOUC), e o `createCodaquiTheme(mode)` MUI consome o mesmo estado. A restrição deixa de existir.

## Camada de UI (MUI v9 + Tailwind v4)

- **Tokens do Design System Codaqui (2026-10-20):** o refactor **não copia o tema atual** — adota os tokens `--cq-*` do Design System (anexo [design-system.md](design-system.md)) como fonte única, gerando o theme do Tailwind v4 e o `createCodaquiTheme` (MUI v9). Inclui a **correção de contraste WCAG**: `#57B593` vira cor de marca/decoração e a cor acionável passa a `#378369` (claro) / `#89CBB3` (escuro). Mudança visual visível em botões/links, aprovada pela presidência.
- **MUI v9** segue como sistema de componentes dos app-shells (admin, membro, formulários, dialogs, tabelas) — preserva o investimento, o tema (`createCodaquiTheme`) e os padrões do AGENTS.md. A migração v7 → v9 segue o [guia oficial](https://mui.com/material-ui/migration/upgrade-to-v9/); atenção às mudanças de DOM/a11y nos componentes usados (Grid, Dialog, Autocomplete, Tabs).
- **Tailwind v4** entra para layout/utilitários e para os componentes `.astro` (grid, espaçamento, tipografia, responsivo) — CSS purgado por página, zero runtime. Convivência via [integração oficial](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/).
- **Regra prática:** componente com estado/comportamento complexo → MUI na ilha; apresentação/estrutura → `.astro` + Tailwind. Nunca hardcode de hex — tokens do tema (MUI) ou do Tailwind config (mesmas cores Codaqui).
- Componentes compartilhados atuais (`PageHero`, `StatCard`, `TransactionTable`, `MembersWall`, etc.) migram caso a caso: a maioria vira `.astro` puro; os interativos (dialogs, forms, check-in) viram ilhas.

## Multi-tenant sem `workers/`

### O que o Worker faz hoje × destino

| Peça atual (`workers/shared/index.js`) | Destino |
|---|---|
| Redirect `/` → `/comunidades/<slug>/` | **Eliminado** — o tenant tem projeto Pages próprio; seu conteúdo nasce em `/` |
| Pass-through de HTML + rewrite de `og:url`/canonical | **Eliminado** — HTML real por rota, gerado em build com o domínio correto |
| Redirects legados | `_redirects` estático do Pages |
| Proxy de API (`/api/*`, `/auth/*`, `/stripe/*`, ...) | **Pages Function** `functions/api/[[path]].ts` (~40 linhas), deploy automático com o site |

### Por que o proxy não pode morrer de vez

O login usa cookie httpOnly emitido por `api.codaqui.dev`. Chamadas cross-origin de `tisocial.org.br` esbarram em bloqueio de third-party cookies (Safari/ITP; direção geral dos browsers). A Pages Function mantém o cookie **first-party** no domínio do tenant. Diferença do mundo atual: é **um arquivo** dentro do projeto, sem pasta `workers/`, sem `wrangler.toml` por comunidade, sem `npm run worker:deploy:*`, sem lista `API_PREFIXES` validada à mão — um proxy genérico `/api/* → API_ORIGIN` resolve.

### Arquitetura de build e deploy

```
GitHub Actions (matrix por tenant, em paralelo)
├── TENANT=codaqui   → astro build → wrangler pages deploy → projeto "codaqui"   (codaqui.dev)
├── TENANT=tisocial  → astro build → wrangler pages deploy → projeto "tisocial"  (tisocial.org.br)
└── TENANT=<futura>  → ...
```

- **Tenant resolution em build:** `TENANT=tisocial` filtra rotas nos `getStaticPaths` e fixa o branding (config em `comunidades/<slug>/community.config.ts`, reaproveitada). Adeus resolução em runtime e Navbar swizzled.
- **Direct upload:** o build roda no GitHub Actions; o Pages só recebe upload. Isso importa porque o sync de eventos commita **de hora em hora** — pela CI do Pages estouraria os 500 builds/mês do free tier; por direct upload não há quota de build.
- **Isolamento de falha:** deploy quebrado de um tenant não afeta os outros (hoje um build quebra tudo).
- **Onboarding de comunidade:** entrada no matrix do workflow + domínio no dashboard do Pages. Sem pasta, sem Worker, sem DNS de proxy — só o apontamento do domínio ao projeto.
- **Previews:** cada push/PR vira `<hash>.<projeto>.pages.dev` nativamente (melhor que o `/previews/develop/` atual, cujo formato muda — ver Riscos).

### Relação com o plano multisite (D1)

A Fase 0.5 **substitui** a arquitetura D1 (`docs/plans/multisite/README.md`) e supersede parcialmente a ADR 004. O plano multisite deve ser marcado como "substituído pela Fase 0.5 do anexo de refatoração" quando ela mergear; o ADR 004 ganha nota de supersessão apontando para o ADR novo (ver abaixo).

## Contratos de dados e build (o que NÃO muda)

- **`static/events/`, `static/social-stats/`** e snapshots por membro seguem gerados pelos mesmos workflows e commitados no repo; o Astro os consome em **build time** (`getStaticPaths` / collections). Nenhuma mudança em `scripts/sync-*.mjs`, nos JSONs ou nos workflows de sync.
- **Backend intocado:** mesma API, mesmo OAuth, mesmos cookies, mesmo Swagger. Versionamento 0.12 → 1.0.0 do plano-mãe inalterado.
- **Stripe:** success/cancel URLs nas mesmas rotas públicas; o retorno `?status=success&session_id=` é tratado na ilha de inscrição (como hoje na página de detalhe).
- **Giscus:** mesmo repo/categoria ("Blog" e futura "Assembleias"); componente React com `client:visible`.
- **Analytics:** mesmo gtag `G-CL043JTTND` no `BaseLayout`.
- **Check-in/câmera:** a ilha usa o mesmo fluxo estabelecido no backend 0.11.x (check-in atômico, `EVENT_CHECKER`); o HTTPS local (mkcert) continua servindo para testar câmera no celular.

## Conteúdo, SEO e redirects

- **Blog:** arquivos `blog/YYYY-MM-DD-slug.md` migram para a collection `blog` com o frontmatter `slug: YYYY/MM/DD/slug` gerando a **mesma URL**. `tagsBasePath: 'category'` é reproduzido por rota dinâmica. `enableComments: false` por post é preservado.
- **Trilhas:** collections por trilha com `sidebar_position`; a sidebar manual de `sidebars.ts` vira config TS própria (mesmo conteúdo).
- **MDX:** suportado nativamente; componentes custom usados em posts/trilhas precisam de inventário e mapeamento um a um (tarefa da Fase 0.2).
- **OG/JSON-LD:** `BaseLayout` recebe props de SEO por página; eventos e membros mantêm JSON-LD `Event`/`Person` equivalentes aos atuais.
- **Sitemap:** `@astrojs/sitemap` gerando URLs idênticas às atuais; `robots.txt` preservado.
- **Redirects legados:** arquivo `_redirects` do Pages (todos os stubs de `src/pages/quero/*`, `/team`, `/contact`, etc.) — os arquivos-stub TSX deixam de existir.
- **Validação de paridade:** script de diff de URLs (build antigo × build novo) como gate das fases 0.2–0.4 — 100% das URLs públicas devem responder no novo build.

## Fases de transição (0.1–0.6) e critérios de pronto

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0.1 — Esqueleto + POC** | App Astro (em `frontend/` ou raiz), BaseLayout + PublicLayout, MUI v9 + Tailwind v4 + **tokens do Design System (`--cq-*`, nomenclatura unificada, cor acionável `#378369`) aplicados ao theme Tailwind e ao `createCodaquiTheme`**, auth-client, 3 páginas representativas: `/` (pública), `/eventos/<slug>` (snapshot + ilha), `/admin/eventos` (app-shell) | `build` + `typecheck` verdes; preview no Pages; Lighthouse mobile das 3 páginas melhor que o equivalente Docusaurus (registrar números no PR); contraste AA dos pares acionáveis verificado; tabela de tokens do AGENTS.md corrigida |
| **0.2 — Conteúdo** | Collections blog + trilhas com slugs legados, ContentLayout (TOC/sidebar/Giscus), MDX + inventário/mapeamento de componentes custom | Diff de URLs blog/trilhas 100%; posts renderizam com Giscus e tema |
| **0.3 — Site público** | Todas as páginas públicas + `/eventos/*` (getStaticPaths) + `/@handle` + transparência + doação Stripe + **página pública `/design-system` (brand book: História, Marca, Cores, Tipografia, Componentes, Acessibilidade, Tom de Voz — spec em [design-system.md](design-system.md))** | Paridade de rotas públicas; OG/JSON-LD validados; sitemap equivalente; checkout Stripe ponta a ponta no preview; `/design-system` com as 8 seções e dados reais de `timeline.ts` |
| **0.4 — App (admin/membro)** | AppLayout + todas as `/admin/*` + `/membro/*` + check-in como ilhas `client:only` | Paridade funcional; testes das ilhas (Vitest + Testing Library) verdes; fluxos authFetch/401 cobertos |
| **0.5 — Multi-tenant** | Matrix de build, projeto Pages por tenant, Pages Function de proxy, migração de `tisocial.org.br` | tisocial.org.br servindo rotas limpas em `/`; login cross-domain OK; doação Stripe cross-domain OK; pasta `workers/` deletada |
| **0.6 — Cutover** | codaqui.dev no Pages, `_redirects` legados, remoção do Docusaurus e do `gh-deploy.yml`, AGENTS.md reescrito para o stack Astro | DNS cortado com rollback ensaiado; 0 404s em amostra do Search Console; CI publicando em `main`; plano multisite marcado como substituído |

**Rollback por fase:** o Docusaurus segue no ar até a 0.6. O Astro sobe em `*.pages.dev`/preview e só assume o domínio no cutover; o rollback do cutover é reverter o DNS (TTL baixo na véspera).

**ADR a produzir:** **011 — Refatoração de frontend para Astro + multi-tenant por build matrix** (status "implementado" ao merge da 0.6), com nota de supersessão parcial da ADR 004.

## Limites Cloudflare Pages (verificados em 2026-10-05)

Fonte: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) (plano Free).

| Limite | Free | Uso projetado | Folga |
|---|---|---|---|
| Arquivos por deploy | 20.000 | ~2.000 (build atual: 1.958) | 10× |
| Tamanho máx. por arquivo | 25 MiB | nenhum > 1 MiB | — |
| Projetos por conta | 100 | 1 + 5 comunidades | ✓ |
| Domínios custom por projeto | 100 | 1–2 por projeto | ✓ |
| Builds/mês (CI do Pages) | 500 | **0** — direct upload via Actions | ✓ |
| Redirects em `_redirects` | 2.100 | < 20 | ✓ |
| Timeout de build (CI do Pages) | 20 min | n/a — build no Actions | ✓ |

## Riscos e pontos abertos

1. **Janela de cutover/DNS** — codaqui.dev sai do GitHub Pages para o Pages na 0.6. Mitigação: TTL baixo na véspera, rollback = reverter DNS, cutover em horário de baixo tráfego.
2. **SEO na troca** — URLs idênticas mitigam ~90%; risco residual em OG/canonical, sitemap e tempo de reindexação. Validar com diff de URLs + inspeção no Search Console pós-cutover.
3. **MDX com componentes custom** — posts/trilhas que usam componentes MUI/React precisam de mapeamento manual; inventário é tarefa explícita da 0.2.
4. **Bundle das ilhas admin** — MUI v9 + React nas ilhas segue pesado; mitigar com code-splitting por ilha e `client:only` (não contamina o site público). Meta: nenhuma ilha pública > 100 KB gzip de JS.
5. **Matrix × snapshots horários** — cada commit de snapshot dispara N builds (1/tenant). Com 2 tenants é tranquilo; acima de ~6, avaliar build agendado (a cada 3h) em vez de a cada push.
6. **Ponto aberto — formato dos previews**: `codaqui.dev/previews/develop/` deixa de existir; previews passam a ser `<hash>.<projeto>.pages.dev`. Links antigos de preview quebram (aceitável — não são indexados).
7. **Ponto aberto — search**: se a busca atual (Algolia) for de fato usada, precisa de equivalente; [Pagefind](https://pagefind.app/) é o padrão Astro (local, grátis, pós-build). Decidir na 0.2 com dados de uso.
8. **Ponto aberto — CNAME/legado GitHub Pages**: o arquivo `CNAME` e o branch `gh-pages` deixam de ter função após a 0.6; remover referências no AGENTS.md e no README.
9. **Divergência de tokens no protótipo do DS (2026-10-20):** os artefatos de origem usam duas gramáticas (`--cq-color-primary-*` vs `--cq-primary-*`, `--cq-action-bg` vs `--cq-action-primary-bg`). A 0.1 precisa unificar a nomenclatura **antes** de gerar Tailwind theme e MUI theme — ver [design-system.md](design-system.md).
10. **AGENTS.md desatualizado na paleta:** documenta `primary #22c55e`/`secondary #0ea5e9`, mas o código usa `#57B593`/`#87D2B7` — corrigir já na PR da 0.1 junto com a adoção dos tokens novos.

## Fora de escopo (Fase 0)

- **Qualquer mudança de backend** (API, auth, cookies, banco) — apenas consumo.
- **Rebranding / nova identidade visual** — a marca (logos, verde `#57B593`, ameixa) é preservada. **Exceção aprovada (2026-10-20):** a adoção dos tokens do Design System **está dentro do escopo**, incluindo a correção de contraste da cor acionável (`#378369`) — é migração de plataforma **com** correção de acessibilidade, não rebranding. Detalhes: [design-system.md](design-system.md).
- Novas páginas do 1.0.0 (assembleias, diretorias, mentoria...) — nascem nas fases 1a+ do plano-mãe, já sobre o Astro.
- Internacionalização (i18n) — site segue pt-BR apenas.
- PWA/app mobile — segue fora de escopo como no plano-mãe.
