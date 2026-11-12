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
  - adrs/014-assemblies.md — assembleias, Discussion manual, snapshot, Giscus e cartório da Fase 3
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
| 004 | [Multi-tenant Frontend para Comunidades](adrs/004-multisite-communities.md) | 2026 | Implementado (Fase 3; parcialmente supersedido pela ADR 011) |
| 006 | [Diretorias e Designations](adrs/006-directorates-designations.md) | 2026-11 | Implementado (Fase 1a) |
| 007 | [Registro de Comunidades](adrs/007-community-registry.md) | 2026-11 | Implementado (Fase 1a) |
| 011 | [Refatoração de Frontend para Astro + Multi-tenant por Build Matrix](adrs/011-frontend-astro-multi-tenant-pages.md) | 2026-10 | Implementado (Fases 0.1–0.6) |
| 013 | [Ledger de horas, ownership, guests e perfil público](adrs/013-hour-ledger.md) | 2026-11 | Implementado e publicado (Fase 2; backend 0.14.0) |
| 008 | [Entidades e Projetos de Extensão](adrs/008-entities-extension-projects.md) | 2026-11 | Implementado e publicado (Fase 4; backend 0.16.0) |
| 014 | [Assembleias híbridas com Discussion manual e registro fino](adrs/014-assemblies.md) | 2026-11 | Implementado e publicado; Discussion real pendente; escopo por entidade jurídica ampliado na Fase 4 |
| 015 | [Codaqui Universitário](adrs/015-codaqui-universitario.md) | 2026-11 | Implementado e publicado (Fase 4b; backend 0.19.0) |
| 016 | [Fila assíncrona de convites de certificado](adrs/016-certificate-invite-queue.md) | 2026-11 | Implementado e publicado (backend 0.19.0); serialização global ampliada em 0.23.0 |
| 017 | [Announcements](adrs/017-announcements.md) | 2026-11 | Implementado e verificado; integração e publicação pendentes (backend 0.26.0/migration 047) |
| 018 | [Campanhas de E-mail (E3)](adrs/018-email-campaigns.md) | 2026-11 | Implementado e verificado; integração e publicação pendentes (backend 0.27.0/migration 048) |
| 009 | [Mentoria no sistema](adrs/009-mentorship.md) | 2026-11 | Fase 5 publicada em 0.19.0; Mentoria Operations publicada em 0.22.0 |
| 010 | [Business tiers](adrs/010-business-tiers.md) | 2026-11 | Implementado e publicado (Fase 6; backend 0.21.0) |

### Módulos — Documentação Viva

| Módulo | Documentos |
|--------|-----------|
| Eventos, horas e guests | [Manual do Código](modules/events/CODE_MANUAL.md) · [Mapa de Papéis](modules/events/ROLES.md) · [ADR 013](adrs/013-hour-ledger.md) |
| Comunidades | [Registro, snapshot e sites whitelabel](modules/community/COMMUNITY_SITES.md) · [Mapa de papéis](modules/events/ROLES.md) |
| Diretorias e designations | [ADR 006](adrs/006-directorates-designations.md) · [Mapa de papéis](modules/events/ROLES.md) |
| Insights / Social Stats | [Estatísticas e presença digital](modules/insights/SOCIAL_STATS.md) |
| Privacidade e proteção de dados | [Visão geral](modules/privacy/README.md) · [Inventário de tratamentos](modules/privacy/treatments.md) |

### Plans — Planos e RFCs

Cada plano vive numa pasta própria (`plans/<topico>/`) com um `README.md` (e, quando o plano é executado por etapas, um `MAP.md` + design docs por camada, como em `events-sync-improvements/`).

| Pasta | Descrição |
|-------|-----------|
| [PROXIMOS_PASSOS.md](plans/PROXIMOS_PASSOS.md) | Arquivado — snapshot histórico de 2026-09-10; usar o plano-mãe e as ADRs como fonte atual. |
| [codaqui-1-0/](plans/codaqui-1-0/README.md) | Plano-mãe Codaqui 1.0.0; Fases 0–6, Mentoria Operations e Experiência do Membro publicadas; Announcements implementada e aguardando integração; próximas: Campanhas E3 e C4P. |
| [real-network/](plans/real-network/README.md) | RFC exploratório de rede social local federada. Não implementado. |
| [multisite/](plans/multisite/README.md) | Multi-tenant frontend para comunidades (Fases 1 e 2 pendentes). |
| [update/](plans/update/README.md) | Plano de upgrades majors de dependências. |
| [event-uiux-improvements/](plans/event-uiux-improvements/README.md) | Histórico parcial de UI/UX de eventos; novas melhorias seguem a spec de Experiência do Membro. |
| [events-sync-improvements/](plans/events-sync-improvements/MAP.md) | Melhorias do fluxo banco → sync → Git → site (Camadas 1–2 implementadas; Camada 3 em design). |

### Superpowers — Specs e plans do workflow de desenvolvimento

Arquivos datados gerados pelo processo de specs/plans do superpowers. Servem de histórico/arquivo; o estado corrente sempre está em `adrs/`, `modules/` ou `plans/`.

| Data | Documento |
|------|-----------|
| 2026-10-30 | [Spec — Fase E1: Aquisição Pública e Medição](superpowers/specs/2026-10-30-codaqui-experience-growth-e1-design.md) |
| 2026-08-17 | [Spec — site da comunidade DevParaná](superpowers/specs/2026-08-17-devparana-community-site-design.md) · [Plan](superpowers/plans/2026-08-17-devparana-community-site-plan.md) |

---

## Convenções

- **ADRs**: use o formato `NNNN-titulo-curto.md`, com header padronizado (contexto, decisão, consequências, data).
- **Módulos**: agrupe por domínio (`events/`, `club/`, `finance/` etc.). Um módulo pode ter `CODE_MANUAL.md`, `ROLES.md`, `ARCHITECTURE.md` etc.
- **Plans**: um diretório por tópico (`plans/<topico>/`) com `README.md` como documento principal. Mantenha o status no topo (`RFC`, `em planejamento`, `em implementação`, `congelado`). Planos grandes podem ter `MAP.md` + design docs por camada dentro da pasta.
