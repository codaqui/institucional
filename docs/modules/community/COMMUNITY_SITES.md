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

> ⚠️ **Atualização (2026-10-27):** a arquitetura de domínio próprio descrita neste documento (Cloudflare Worker em `workers/shared/index.js`) foi **superseda** pela Fase 0.5 — build matrix por tenant no Cloudflare Pages + Pages Function de proxy. A pasta `workers/` foi removida do repo. Ver runbook em [DEVELOPMENT.md](../../../DEVELOPMENT.md) → "Multi-tenant (Fase 0.5)" e o registro de supersessão na [ADR 004](../../adrs/004-multisite-communities.md). O conteúdo abaixo segue válido para o portal codaqui.dev (build `codaqui`).

Cada comunidade parceira tem um espaço próprio em `/comunidades/<slug>/...` com branding, navbar, blog, docs, doação e transparência próprios, no mesmo build do site Codaqui. T.I. Social foi o piloto; hoje existem também Elas no Código, DevParaná e CamposTech.

## Visão geral

- Decisão arquitetural: [docs/adrs/004-multisite-communities.md](../../adrs/004-multisite-communities.md)
- Fases pendentes: [docs/plans/multisite/README.md](../../plans/multisite/README.md)

## Onde vive cada peça

| Item | Caminho | Responsabilidade |
|------|---------|------------------|
| **Config da comunidade** | `comunidades/<slug>/community.config.ts` | Branding, slug Stripe, navMenu, features |
| **Páginas** | `comunidades/<slug>/src/pages/*.tsx` | Home, apoiar, transparência, membro |
| **Blog/docs** | `comunidades/<slug>/blog/`, `comunidades/<slug>/docs/` | Instâncias próprias de blog/docs |
| **Resolver de tenant** | `src/lib/community-context.ts` | `resolveCommunityFromPath(pathname)` |
| **Navbar whitelabel** | `src/theme/Navbar/Content/index.tsx` | Troca branding em runtime |
| **DonationFlow reusável** | `src/components/DonationFlow/index.tsx` | Fluxo de doação whitelabel |
| **SEO social por comunidade** | `comunidades/shared/components/CommunityHead.tsx` | Sobrescreve `og:*`/`twitter:*` com identidade da comunidade |

## Checklist para nova comunidade

1. Criar `comunidades/<slug>/` e `community.config.ts` (use `comunidades/tisocial/community.config.ts` como referência).
2. Preencher `socialImage` (JPG/PNG ~1200×630) para que cards sociais do domínio próprio mostrem a identidade da comunidade.
3. Criar `blog/`, `docs/` e `src/pages/{index,apoiar,transparencia}.tsx`.
4. Usar `<CommunityHead community={community} />` dentro das páginas customizadas para sobrescrever `og:image`/`twitter:image`.
5. Registrar a config em `comunidades/index.ts`.
6. Confirmar `metadata.communityId === '<slug>'` no checkout Stripe.
7. Validar com `npm run typecheck` e `npm run build`.

## Domínio próprio

Para domínio próprio, veja o runbook [DEVELOPMENT.md §Multi-tenant (Fase 0.5)](../../../DEVELOPMENT.md) — build matrix no Cloudflare Pages + Pages Function (arquitetura atual; o histórico de Worker está em [docs/plans/multisite/README.md §6](../../plans/multisite/README.md)). A whitelist de origens no backend (`backend/src/common/allowed-origins.config.ts`) e a configuração do callback OAuth continuam aplicáveis.

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode nome da comunidade em página | `community.shortName` |
| Hardcode cor da comunidade | `community.theme.primary` |
| Path literal `/comunidades/tisocial/blog` | `` `${community.basePath}/blog` `` |
| Filtrar ledger por `b.id === slug` | `b.projectKey === community.slug` (id é UUID) |
| Criar página em `src/pages/comunidades/<slug>/` | `comunidades/<slug>/src/pages/` (auto-discovery) |
| Deixar card social com imagem da Codaqui | Definir `socialImage` e usar `<CommunityHead community={community} />` |
