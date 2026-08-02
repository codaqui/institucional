<!-- AGENT-INDEX
purpose: ADR do multi-tenant frontend para comunidades parceiras. Registra a decisão de usar Docusaurus single-build + edge proxy para domínios próprios.
audience: AI agents, mantenedores
status: implementado (parcial — Fase 3 em produção)
sections:
  - Contexto
  - Decisão
  - Arquitetura D1
  - Estado de implementação
  - Consequências
  - Links relacionados
related-docs:
  - ../plans/MULTISITE_PLAN.md — detalhes das fases pendentes
  - AGENTS.md — patterns e arquitetura do monorepo
-->

# ADR 004 — Multi-Tenant Frontend para Comunidades Parceiras

- **Data da decisão:** 2026-03
- **Status:** Implementado (Fase 3 em produção)
- **Escopo:** `comunidades/<slug>/`, `src/theme/Navbar/`, `workers/`

## Contexto

As comunidades parceiras da Codaqui precisavam de espaço próprio com identidade visual, mas sem criar um novo SPA ou repositório. A solução deveria reaproveitar o Docusaurus existente e a API NestJS.

## Decisão

Adotar a **Opção D1**: single Docusaurus + multi-instance de plugins + swizzle do Navbar/Layout + edge proxy (Cloudflare Worker) para domínios próprios.

Cada comunidade ganha:

- `comunidades/<slug>/community.config.ts` — branding, navMenu, features, slug Stripe.
- `comunidades/<slug>/blog/` e `comunidades/<slug>/docs/` — instâncias de blog/docs.
- `comunidades/<slug>/src/pages/*.tsx` — páginas whitelabel (home, apoiar, transparência, membro), descobertas automaticamente pelo plugin `@docusaurus/plugin-content-pages`.
- `resolveCommunityFromPath()` em `src/lib/community-context.ts` — detecta a comunidade pelo path.
- Navbar swizzled em `src/theme/Navbar/Content/index.tsx` — troca branding em runtime.

Para domínios próprios, um **Cloudflare Worker** reutilizável (`workers/shared/index.js`) faz reverse-proxy de `https://<dominio>/*` para `https://codaqui.dev/comunidades/<slug>/*`, mantendo cookies first-party.

## Estado de implementação

| Fase | Status |
|------|--------|
| T.I. Social piloto | Em produção (`tisocial.org.br`) |
| Auto-discovery de plugins | ✅ Feito via `comunidades/index.ts` |
| Navbar whitelabel | ✅ Implementado |
| DonationFlow reusável | ✅ Implementado |
| Auth callback whitelabel | ✅ Implementado |
| Link em `/sobre/ong` | 🟡 Em andamento |
| Outras comunidades | ⏸️ Stand-by |

## Consequências

- **Positivas:** 1 build, 1 deploy; onboarding simples (criar pasta + páginas); domínio próprio sem replicar infraestrutura.
- **Negativas:** Limitada pela flexibilidade do Docusaurus; domínio próprio requer configuração coordenada de DNS, Worker e OAuth callback.

## Links relacionados

- Config piloto: `comunidades/tisocial/community.config.ts`
- Worker compartilhado: `workers/shared/index.js`
- Plano detalhado: [../plans/MULTISITE_PLAN.md](../plans/MULTISITE_PLAN.md)
