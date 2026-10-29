<!-- AGENT-INDEX
purpose: ADR da refatoração do frontend Docusaurus → Astro 7 (ilhas React/MUI v9 + Tailwind v4 com tokens --cq-* do Design System) e do multi-tenant real por build matrix no Cloudflare Pages (projeto Pages por domínio + Pages Function única de proxy). Registra o contexto, as decisões de design, o estado das Fases 0.1–0.6 e a supersessão parcial da ADR 004.
audience: AI agents, mantenedores
status: implementado (Fases 0.1–0.6, 2026-10-05 → 2026-10-28; cutover codaqui.dev em 2026-10-28, rollback GitHub Pages preservado ~7 dias)
sections:
  - Contexto
  - Decisão
  - Estado de implementação
  - Consequências
  - Supersessão parcial da ADR 004
  - Links relacionados
related-docs:
  - ../plans/codaqui-1-0/refatoracao-frontend-astro.md — spec da refatoração (Fase 0 do plano 1.0.0; decisões de design 1–7 e tabela de fases)
  - 004-multisite-communities.md — ADR do whitelabel D1 (superseda parcialmente por esta)
  - ../plans/multisite/README.md — plano multisite D1, substituído pela Fase 0.5 (mantido p/ histórico)
  - ../../DEVELOPMENT.md — runbook de operação multi-tenant (seção "Multi-tenant (Fase 0.5)")
-->

# ADR 011 — Refatoração de Frontend para Astro + Multi-tenant por Build Matrix

- **Data da decisão:** 2026-10-05 (design aprovado) → implementação 2026-10-20 → 2026-10-28
- **Status:** Implementado (Fases 0.1–0.6)
- **Escopo:** `frontend/`, `.github/workflows/`, `docs/`, domínios Cloudflare Pages

## Contexto

O Docusaurus serviu por ~1 ano, mas virou limitador (diagnóstico 2026-10-05):

1. **Mobile:** o runtime SPA completo + React + MUI era enviado em **toda** página — inclusive posts de blog. Páginas app (`/admin/*`, `/membro`, check-in) ficavam esmagadas no chrome de site de documentação (navbar de docs, breadcrumbs, sidebar); tudo que não era blog/trilha era "puxadinho".
2. **Multi-tenant fake:** branding resolvido em **runtime** (`resolveCommunityFromPath` + Navbar swizzled); o Worker de `tisocial.org.br` era obrigado a fazer **pass-through** (sem rewrite) porque o React Router depende de `window.location.pathname` — URL suja (`/comunidades/tisocial/...`), rewrite de `og:url` no edge e cookies que só funcionavam por causa do proxy.
3. **Escalabilidade do 1.0.0:** o plano-mãe adiciona ~25 páginas admin/app (AdminLayout, painel do mentor, filas de aprovação, central de relatórios). Construir isso sobre o chrome do Docusaurus perpetuaria o problema.

## Decisão

Adotar a **Abordagem A — Astro 7 monolito** (escolhida entre Astro monolito, strangler Astro+Docusaurus e Next.js `output: 'export'`), com as decisões de design aprovadas em 2026-10-05:

1. **Stack:** Astro 7 (`output: 'static'`) + `@astrojs/react` + MDX + Tailwind v4 + MUI v9 (upgrade v7 → v9). TypeScript strict, Node 24, mesmo monorepo. O site público sai como HTML+CSS puro (zero JS por padrão); as áreas app viram ilhas React (`client:only` em `/admin/*`, `/membro/*`, check-in).
2. **UI:** tokens do **Design System Codaqui (`--cq-*`)** como fonte única, gerando o theme Tailwind v4 e o `createCodaquiTheme` (MUI v9) — incluindo a correção de contraste WCAG da cor acionável (`#378369` claro / `#89CBB3` escuro). Regra prática: comportamento complexo → MUI na ilha; apresentação/estrutura → `.astro` + Tailwind.
3. **Timing:** refatoração **antes** da Fase 1a do 1.0.0 — as páginas novas nascem direto no stack novo, nada é escrito duas vezes.
4. **Multi-tenant:** **build matrix por tenant** — um projeto Cloudflare Pages por comunidade, domínio próprio nativo, rotas limpas em `/`, `TENANT=<slug>` trocando o `srcDir` em build-time. **Fim da pasta `workers/`**: o proxy de API virou uma **Pages Function** única (`frontend/functions/[[path]].ts`), deployada automaticamente com cada build.
5. **Hosting/deploy:** Cloudflare Pages (free), **direct upload** via GitHub Actions (`wrangler pages deploy`) — o build roda no Actions (repo público, grátis) e o Pages só recebe upload, zerando a quota de 500 builds/mês do free tier. Isolamento de falha: deploy quebrado de um tenant não afeta os outros.
6. **Contratos intocados:** backend, snapshots (`static/events/`, `static/social-stats/`), workflows de sync, Stripe, Giscus e gtag não mudaram — o refactor é só da camada de apresentação.
7. **Custo:** R$ 0/mês.

## Estado de implementação

| Fase | Entrega | Data |
|------|---------|------|
| **0.1 — Esqueleto + POC** | App Astro em `frontend/`, tokens `--cq-*`, layouts Base/Public/App, auth-client framework-agnostic, POC: `/`, `/eventos/<slug>` (ilha), `/admin/eventos` (app-shell); Lighthouse registrado | 2026-10-20 |
| **0.2 — Conteúdo** | Content collections blog + trilhas com slugs legados, MDX, Giscus, feeds; gate de paridade de URLs (diff-urls) 100% | 2026-10-21 |
| **0.3 — Site público** | Todas as páginas públicas, `/eventos/*` (`getStaticPaths`), `/@handle`, transparência, doação Stripe, página `/design-system` | 2026-10-21 |
| **0.4 — App (admin/membro)** | AppLayout + `/admin/*` + `/membro/*` + check-in como ilhas `client:only="react"` | 2026-10-26 |
| **0.5 — Multi-tenant** | Build matrix + Pages Function; cutover dos 3 tenants (`tisocial.org.br`, `elasnocodigo.com.br`, `devparana.org`) com rotas limpas em `/`; pasta `workers/` e scripts Workers removidos | 2026-10-27 |
| **0.6 — Cutover** | `codaqui.dev` no Pages (DNS cortado em janela com rollback ensaiado), Docusaurus e `gh-deploy.yml` removidos, redirects legados em `_redirects`, AGENTS.md/README/DEVELOPMENT reescritos para o stack Astro | 2026-10-28 |

**Gates por build (ruling R7):** codaqui = build + check + test + diff-urls; tenant = build + tenant-urls. O `astro check` em modo tenant não é gate (erros pré-existentes de tipagem das páginas codaqui sob `srcDir` tenant). Detalhes no runbook do DEVELOPMENT.md.

**Rollback:** o branch `gh-pages` fica intacto como rollback por ~7 dias após o cutover (reversão = reverter o DNS, TTL baixo na véspera); remoção definitiva após estabilização observada.

## Consequências

- **Positivas:**
  - Fim dos Workers e do multi-tenant fake — sem Navbar swizzled, sem resolução de branding em runtime, sem rewrite de `og:url` no edge.
  - Domínios limpos: cada tenant serve seu conteúdo em `/` com canonical/OG corretos gerados em build.
  - Mobile: site público com ~0 KB de JS; ilhas hidratam sob demanda (`client:visible`/`client:only`).
  - Quota de builds do Pages = 0 (direct upload via Actions), mesmo com sync de snapshots de hora em hora.
  - Isolamento por tenant (build/deploy independentes) e onboarding de comunidade reduzido a config + domínio no projeto Pages — sem pasta nova, sem Worker, sem DNS de proxy.
  - Base limpa para as ~25 páginas novas do 1.0.0 (nada nasce no chrome de docs).
- **Negativas / aceitas:**
  - **Previews mudaram de formato:** `codaqui.dev/previews/develop/` deixou de existir; previews passam a ser branch deployments `<hash>.<projeto>.pages.dev`. Links antigos de preview quebram (aceitável — não são indexados).
  - **Page Rules legado invisível para a API (lição do tisocial, ruling R8):** um 301 apex→www legado na zona `tisocial.org.br` sobreviveu ao cutover dos Workers e não aparecia em Redirect Rules/Bulk Redirects/API (Page Rules rejeita tokens por restrição legada) — só foi encontrado e removido no dashboard. Verificação de redirects legado precisa incluir Page Rules manualmente.
  - **Ilhas admin pesadas:** MUI v9 + React seguem no bundle das ilhas; mitigado com code-splitting por ilha e `client:only` (não contaminam o site público). Meta: nenhuma ilha pública > 100 KB gzip.
  - **Snapshots horários disparam N builds** (1 por tenant por commit de sync): ok até ~6 tenants; acima disso, avaliar build agendado (ex.: a cada 3h).
  - **GitHub Pages mantido como rollback** até estabilizar (~7 dias pós-cutover) — DNS do apex fica sob gestão manual na janela.

## Supersessão parcial da ADR 004

A decisão **D1** da ADR 004 (single Docusaurus multi-instance + edge proxy Cloudflare Worker com pass-through) foi **substituída** por esta ADR — ver o registro de supersessão parcial em [004-multisite-communities.md](004-multisite-communities.md) e o plano multisite D1, mantido para histórico em [../plans/multisite/README.md](../plans/multisite/README.md).

**Permanece válido da ADR 004:**

- A **segregação por comunidade no ledger e no Stripe** (`metadata.communityId`, contas por comunidade, `/ledger/community-balances` multi-tenant nativo) — invariante do backend, independente do frontend.
- O **piloto de conteúdo** da T.I. Social (`comunidades/tisocial/`) como base de conteúdo e branding reaproveitada no novo stack.

## Links relacionados

- Spec da refatoração (Fase 0 do plano 1.0.0): [../plans/codaqui-1-0/refatoracao-frontend-astro.md](../plans/codaqui-1-0/refatoracao-frontend-astro.md)
- Design System Codaqui (tokens `--cq-*`): [../plans/codaqui-1-0/design-system.md](../plans/codaqui-1-0/design-system.md)
- Plano da Fase 0.6 (cutover codaqui.dev): [../superpowers/plans/2026-10-28-fase-0-6-cutover-codaqui-dev.md](../superpowers/plans/2026-10-28-fase-0-6-cutover-codaqui-dev.md)
- Plano da Fase 0.5 (multi-tenant Pages): [../superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md](../superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md)
- ADR superseda parcialmente: [004-multisite-communities.md](004-multisite-communities.md)
- Runbook de operação multi-tenant: [../../DEVELOPMENT.md](../../DEVELOPMENT.md) (seção "Multi-tenant (Fase 0.5)")
