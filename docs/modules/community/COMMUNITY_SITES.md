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
  - ../../plans/MULTISITE_PLAN.md — fases pendentes do multisite
-->

# Sites de Comunidades Parceiras

Cada comunidade parceira tem um espaço próprio em `/comunidades/<slug>/...` com branding, navbar, blog, docs, doação e transparência próprios, no mesmo build do site Codaqui. T.I. Social é o piloto.

## Visão geral

- Decisão arquitetural: [docs/adrs/004-multisite-communities.md](../../adrs/004-multisite-communities.md)
- Fases pendentes: [docs/plans/MULTISITE_PLAN.md](../../plans/MULTISITE_PLAN.md)

## Onde vive cada peça

| Item | Caminho | Responsabilidade |
|------|---------|------------------|
| **Config da comunidade** | `comunidades/<slug>/community.config.ts` | Branding, slug Stripe, navMenu, features |
| **Páginas** | `comunidades/<slug>/src/pages/*.tsx` | Home, apoiar, transparência, membro |
| **Blog/docs** | `comunidades/<slug>/blog/`, `comunidades/<slug>/docs/` | Instâncias próprias de blog/docs |
| **Resolver de tenant** | `src/lib/community-context.ts` | `resolveCommunityFromPath(pathname)` |
| **Navbar whitelabel** | `src/theme/Navbar/Content/index.tsx` | Troca branding em runtime |
| **DonationFlow reusável** | `src/components/DonationFlow/index.tsx` | Fluxo de doação whitelabel |

## Checklist para nova comunidade

1. Criar `comunidades/<slug>/` e `community.config.ts` (use `comunidades/tisocial/community.config.ts` como referência).
2. Criar `blog/`, `docs/` e `src/pages/{index,apoiar,transparencia}.tsx`.
3. Registrar a config em `comunidades/index.ts`.
4. Confirmar `metadata.communityId === '<slug>'` no checkout Stripe.
5. Validar com `npm run typecheck` e `npm run build`.

## Domínio próprio

Para domínio próprio, veja [docs/plans/MULTISITE_PLAN.md §6](../../plans/MULTISITE_PLAN.md) — envolve Cloudflare Worker (`workers/shared/index.js`), whitelist de origens no backend (`backend/src/common/allowed-origins.config.ts`) e configuração do callback OAuth.

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode nome da comunidade em página | `community.shortName` |
| Hardcode cor da comunidade | `community.theme.primary` |
| Path literal `/comunidades/tisocial/blog` | `` `${community.basePath}/blog` `` |
| Filtrar ledger por `b.id === slug` | `b.projectKey === community.slug` (id é UUID) |
| Criar página em `src/pages/comunidades/<slug>/` | `comunidades/<slug>/src/pages/` (auto-discovery) |
