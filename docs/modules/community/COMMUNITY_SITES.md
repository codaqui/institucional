<!-- AGENT-INDEX
purpose: Documentação viva do módulo de sites whitelabel para comunidades parceiras dentro do portal Codaqui.
audience: AI agents, mantenedores, contribuidores
sections:
  - Visão geral
  - Onde vive cada peça
  - Checklist para nova comunidade
  - Domínio próprio
  - Anti-patterns
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ../../adrs/004-multisite-communities.md — decisão arquitetural do multi-tenant
  - ../../plans/multisite/README.md — fases pendentes do multisite
-->

# Sites de Comunidades Parceiras

> ⚠️ **Atualização (2026-10-28, Fase 0.6):** o app Docusaurus foi removido; os
> sites whitelabel agora são páginas Astro — builds de domínio próprio em
> `frontend/src-tenants/<slug>/` (build matrix por tenant no Cloudflare Pages +
> Pages Function de proxy) e wrappers do portal em
> `frontend/src/pages/comunidades/<slug>/`. A pasta `workers/` foi removida do
> repo. Ver runbook em [DEVELOPMENT.md](../../../DEVELOPMENT.md) → "Multi-tenant
> (Fase 0.5)" e o registro de supersessão na
> [ADR 004](../../adrs/004-multisite-communities.md). O conteúdo abaixo já reflete
> o stack Astro.

Cada comunidade parceira tem um espaço próprio em `/comunidades/<slug>/...` com branding, navbar, blog, docs, doação e transparência próprios, no mesmo build do site Codaqui. T.I. Social foi o piloto; hoje existem também Elas no Código, DevParaná e CamposTech.

## Visão geral

- Decisão arquitetural: [docs/adrs/004-multisite-communities.md](../../adrs/004-multisite-communities.md)
- Fases pendentes: [docs/plans/multisite/README.md](../../plans/multisite/README.md)

## Onde vive cada peça

| Item | Caminho | Responsabilidade |
|------|---------|------------------|
| **Config da comunidade** | `comunidades/<slug>/community.config.ts` | Branding, slug Stripe, navMenu, features (fonte canônica, READ-WRITE) |
| **Páginas (domínio próprio)** | `frontend/src-tenants/<slug>/pages/*.astro` | Build matrix do tenant — home, apoiar, transparência, equipe |
| **Páginas (wrapper do portal)** | `frontend/src/pages/comunidades/<slug>/` | Espelham o tenant em `/comunidades/<slug>` no build codaqui |
| **Componentes compartilhados** | `frontend/src/components/astro/community/` | Hero, explore, blog, docs, transparência (reuso portal + tenants) |
| **Blog/docs** | `comunidades/<slug>/blog/`, `comunidades/<slug>/docs/` | Instâncias próprias de blog/docs (lidos via symlink) |
| **Resolver de tenant** | `frontend/src/lib/community.ts` | `loadTenantConfig`, `tenantNav`, `communityBasePath` |
| **Nav whitelabel** | `community.config.ts` (`navMenu`) + `tenantNav()` | Nav do tema por build (sem swizzle de runtime) |
| **DonationFlow reusável** | `frontend/src/components/islands/DonationFlowIsland.tsx` | Fluxo de doação whitelabel (usado por `CommunityApoiarPage.astro`) |
| **SEO social por comunidade** | OG/canonical por build | `SITE_URL` do tenant em `frontend/tenants.config.mjs` + `socialImage` do config |

## Checklist para nova comunidade

1. Criar `comunidades/<slug>/` e `community.config.ts` (use `comunidades/tisocial/community.config.ts` como referência).
2. Preencher `socialImage` (JPG/PNG ~1200×630) para que cards sociais do domínio próprio mostrem a identidade da comunidade.
3. Criar `blog/` e `docs/` em `comunidades/<slug>/` (conteúdo canônico).
4. Criar as páginas `.astro` do tenant em `frontend/src-tenants/<slug>/pages/` reutilizando os componentes de `frontend/src/components/astro/community/` (espelhe com wrappers em `frontend/src/pages/comunidades/<slug>/` se a comunidade também fica no portal).
5. Registrar a config em `comunidades/index.ts`.
6. Confirmar `metadata.communityId === '<slug>'` no checkout Stripe.
7. Se houver domínio próprio: `frontend/tenants.config.mjs` + matrix dos workflows (`deploy-astro.yml`/`pr-check.yml`) + runbook do DEVELOPMENT.md.
8. Validar com `make astro-verify` e `make astro-verify-tenants`.

## Domínio próprio

Para domínio próprio, veja o runbook [DEVELOPMENT.md §Multi-tenant (Fase 0.5)](../../../DEVELOPMENT.md) — build matrix no Cloudflare Pages + Pages Function (arquitetura atual; o histórico de Worker está em [docs/plans/multisite/README.md §6](../../plans/multisite/README.md)). A whitelist de origens no backend (`backend/src/common/allowed-origins.config.ts`) e a configuração do callback OAuth continuam aplicáveis.

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode nome da comunidade em página | `community.shortName` |
| Hardcode cor da comunidade | `community.theme.primary` |
| Path literal `/comunidades/tisocial/blog` | `` `${community.basePath}/blog` `` |
| Filtrar ledger por `b.id === slug` | `b.projectKey === community.slug` (id é UUID) |
| Editar conteúdo em `frontend/src-tenants/<slug>/` | Editar em `comunidades/<slug>/` (src-tenants lê via symlink — READ-ONLY no app) |
| Deixar card social com imagem da Codaqui | Definir `socialImage` no `community.config.ts` (OG emitido por build) |
