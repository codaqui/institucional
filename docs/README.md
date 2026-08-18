<!-- AGENT-INDEX
purpose: Índice central da documentação técnica do monorepo Codaqui. Aponta para ADRs (decisões tomadas), documentação viva de módulos e planos futuros.
audience: AI agents, mantenedores, contribuidores
sections:
  - Estrutura de pastas
  - Índice por tipo de documento
  - Como usar este índice
related-docs:
  - AGENTS.md — guia geral do monorepo
  - DEVELOPMENT.md — setup, env vars, migrations, deploy
-->

# Documentação Técnica — Codaqui

Esta pasta centraliza a documentação técnica do monorepo. A organização segue três tipos:

| Tipo | Pasta | O que guarda |
|------|-------|--------------|
| **ADR** | `docs/adrs/` | Decisões arquiteturais já tomadas e implementadas. Contêm contexto, decisão, consequências e data. |
| **Módulos (viva)** | `docs/modules/` | Documentação operacional dos módulos em produção: manual do código, mapa de papéis, guias de uso. |
| **Planos** | `docs/plans/` | RFCs, melhorias em andamento e planos futuros ainda não implementados. |

> Regra prática: se uma decisão já foi implementada, ela vira ADR; se um documento descreve como o código funciona hoje, vive em `modules/`; se ainda é hipótese ou backlog, vive em `plans/`.

---

## Índice

### ADRs — Decisões Arquiteturais

| # | Título | Data | Status |
|---|--------|------|--------|
| 001 | [Plataforma de Gestão de Eventos](adrs/001-event-platform.md) | 2024 → 2026 | Implementado |
| 002 | [Clube Codaqui — SortCoins](adrs/002-club-sortcoins.md) | 2026 | Implementado |
| 003 | [Clube Codaqui Business (PJ)](adrs/003-club-business-pj.md) | 2026 | Implementado |
| 004 | [Multi-tenant Frontend para Comunidades](adrs/004-multisite-communities.md) | 2026 | Implementado (Fase 3) |

### Módulos — Documentação Viva

| Módulo | Documentos |
|--------|-----------|
| Eventos | [Manual do Código](modules/events/CODE_MANUAL.md) · [Mapa de Papéis](modules/events/ROLES.md) |
| Comunidades parceiras | [Sites whitelabel](modules/community/COMMUNITY_SITES.md) |
| Insights / Social Stats | [Estatísticas e presença digital](modules/insights/SOCIAL_STATS.md) |

### Plans — Planos e RFCs

| Documento | Descrição |
|-----------|-----------|
| [REAL_NETWORK_PLAN.md](plans/REAL_NETWORK_PLAN.md) | RFC exploratório de rede social local federada. Não implementado. |
| [MULTISITE_PLAN.md](plans/MULTISITE_PLAN.md) | Multi-tenant frontend para comunidades (Fases 1 e 2 pendentes). |
| [UPDATE_PLAN.md](plans/UPDATE_PLAN.md) | Plano de upgrades majors de dependências. |
| [EVENT_UIUX_IMPROVEMENTS_PLAN.md](plans/EVENT_UIUX_IMPROVEMENTS_PLAN.md) | Melhorias de UI/UX do módulo de eventos (em implementação). |

---

## Convenções

- **ADRs**: use o formato `NNNN-titulo-curto.md`, com header padronizado (contexto, decisão, consequências, data).
- **Módulos**: agrupe por domínio (`events/`, `club/`, `finance/` etc.). Um módulo pode ter `CODE_MANUAL.md`, `ROLES.md`, `ARCHITECTURE.md` etc.
- **Plans**: mantenha o status no topo (`RFC`, `em planejamento`, `em implementação`, `congelado`).
