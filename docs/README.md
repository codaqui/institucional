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

Cada plano vive numa pasta própria (`plans/<topico>/`) com um `README.md` (e, quando o plano é executado por etapas, um `MAP.md` + design docs por camada, como em `events-sync-improvements/`).

| Pasta | Descrição |
|-------|-----------|
| [PROXIMOS_PASSOS.md](plans/PROXIMOS_PASSOS.md) | ⭐ Consolidação de próximos passos de todas as áreas (snapshot 2026-09-10) — ponto de partida para coordenação. |
| [real-network/](plans/real-network/README.md) | RFC exploratório de rede social local federada. Não implementado. |
| [multisite/](plans/multisite/README.md) | Multi-tenant frontend para comunidades (Fases 1 e 2 pendentes). |
| [update/](plans/update/README.md) | Plano de upgrades majors de dependências. |
| [event-uiux-improvements/](plans/event-uiux-improvements/README.md) | Melhorias de UI/UX do módulo de eventos (em implementação). |
| [events-sync-improvements/](plans/events-sync-improvements/MAP.md) | Melhorias do fluxo banco → sync → Git → site (Camadas 1–2 implementadas; Camada 3 em design). |

### Superpowers — Specs e plans do workflow de desenvolvimento

Arquivos datados gerados pelo processo de specs/plans do superpowers. Servem de histórico/arquivo; o estado corrente sempre está em `adrs/`, `modules/` ou `plans/`.

| Data | Documento |
|------|-----------|
| 2026-08-17 | [Spec — site da comunidade DevParaná](superpowers/specs/2026-08-17-devparana-community-site-design.md) · [Plan](superpowers/plans/2026-08-17-devparana-community-site-plan.md) |

---

## Convenções

- **ADRs**: use o formato `NNNN-titulo-curto.md`, com header padronizado (contexto, decisão, consequências, data).
- **Módulos**: agrupe por domínio (`events/`, `club/`, `finance/` etc.). Um módulo pode ter `CODE_MANUAL.md`, `ROLES.md`, `ARCHITECTURE.md` etc.
- **Plans**: um diretório por tópico (`plans/<topico>/`) com `README.md` como documento principal. Mantenha o status no topo (`RFC`, `em planejamento`, `em implementação`, `congelado`). Planos grandes podem ter `MAP.md` + design docs por camada dentro da pasta.
