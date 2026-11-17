<!-- AGENT-INDEX
purpose: Índice central da documentação técnica do monorepo Codaqui. Aponta para ADRs, documentação viva de módulos, planos classificados e changelog.
audience: AI agents, mantenedores, contribuidores
status: Revisado em 2026-11-17 até 1.2.0 publicado e Fase 8/1.3.0 implementada em develop.
sections:
  - Estrutura de pastas
  - Índice por tipo de documento
  - Convenções
related-docs:
  - ../AGENTS.md — guia geral do monorepo e versionamento compartilhado.
  - ../CHANGELOG.md — releases 1.0.0–1.2.0.
  - ../DEVELOPMENT.md — setup, env vars, migrations e deploy.
  - plans/README.md — índice completo de planos ativos, históricos e superseded.
-->

# Documentação Técnica — Codaqui

Esta pasta centraliza a documentação técnica do monorepo. A organização segue quatro tipos:

| Tipo | Pasta/arquivo | O que guarda |
|------|---------------|--------------|
| **ADR** | `docs/adrs/` | Decisões arquiteturais tomadas e seus contratos implementados. |
| **Módulos (viva)** | `docs/modules/` | Como os módulos em produção funcionam e são operados. |
| **Planos** | `docs/plans/` | Roadmaps, RFCs, melhorias e histórico classificado. |
| **Releases** | `../CHANGELOG.md` | Mudanças publicadas, ordenadas da mais recente à mais antiga. |

> Regra prática: decisão implementada vira ADR; comportamento atual vive em `modules/`; hipótese/backlog vive em `plans/`; release publicada entra no changelog. Checkboxes de planos antigos não são autorização para reexecutar trabalho.

## ADRs — Decisões Arquiteturais

| # | Título | Data | Status |
|---|--------|------|--------|
| 001 | [Plataforma de Gestão de Eventos](adrs/001-event-platform.md) | 2024 → 2026 | Implementado |
| 002 | [Clube Codaqui — SortCoins](adrs/002-club-sortcoins.md) | 2026 | Implementado |
| 003 | [Clube Codaqui Business (PJ)](adrs/003-club-business-pj.md) | 2026 | Implementado |
| 004 | [Multi-tenant Frontend para Comunidades](adrs/004-multisite-communities.md) | 2026 | Implementado; parcialmente supersedido pela ADR 011 |
| 006 | [Diretorias e Designations](adrs/006-directorates-designations.md) | 2026-11 | Implementado (Fase 1a) |
| 007 | [Registro de Comunidades](adrs/007-community-registry.md) | 2026-11 | Implementado (Fase 1a) |
| 008 | [Entidades e Projetos de Extensão](adrs/008-entities-extension-projects.md) | 2026-11 | Publicado (Fase 4; backend 0.16.0) |
| 009 | [Mentoria no sistema](adrs/009-mentorship.md) | 2026-11 | Fases 5/Operations publicadas; ciclo de vida publicado em 1.1.0/migration 050 |
| 010 | [Business tiers](adrs/010-business-tiers.md) | 2026-11 | Publicado (Fase 6; backend 0.21.0) |
| 011 | [Frontend Astro + Multi-tenant por Build Matrix](adrs/011-frontend-astro-multi-tenant-pages.md) | 2026-10 | Implementado (Fases 0.1–0.6) |
| 012 | [C4P integrado](adrs/012-c4p.md) | 2026-11 | Publicado em 1.0.0/migration 049; hotfix 1.0.1; piloto real pendente |
| 013 | [Ledger de horas, ownership, guests e perfil público](adrs/013-hour-ledger.md) | 2026-11 | Publicado (Fase 2; backend 0.14.0) |
| 014 | [Assembleias híbridas](adrs/014-assemblies.md) | 2026-11 | Publicado; Discussion real pendente; escopo por entidade ampliado na Fase 4 |
| 015 | [Codaqui Universitário](adrs/015-codaqui-universitario.md) | 2026-11 | Publicado em 0.19.0 |
| 016 | [Fila assíncrona de convites de certificado](adrs/016-certificate-invite-queue.md) | 2026-11 | Publicado; serialização global ampliada em 0.23.0 |
| 017 | [Announcements](adrs/017-announcements.md) | 2026-11 | Publicado em 0.26.0/migration 047; aviso real é acompanhamento operacional |
| 018 | [Campanhas de E-mail (E3)](adrs/018-email-campaigns.md) | 2026-11 | Publicado em 0.27.0/migration 048 (PRs #637/#638) |
| 019 | [Autosserviço de privacidade e solicitação de exclusão](adrs/019-privacy-self-service.md) | 2026-11 | Publicado em 1.2.0/migration 051 (PR #654); revisão jurídica não presumida |

## Módulos — Documentação Viva

| Módulo | Documentos |
|--------|-----------|
| Monorepo e contribuição | [Guia operacional](modules/MONOREPO_OPERATIONS.md) · [Ponto de entrada para agentes](../AGENTS.md) |
| Eventos, horas e guests | [Manual do Código](modules/events/CODE_MANUAL.md) · [Mapa de Papéis](modules/events/ROLES.md) · [ADR 013](adrs/013-hour-ledger.md) |
| Comunidades | [Registro, snapshot e sites whitelabel](modules/community/COMMUNITY_SITES.md) · [Mapa de papéis](modules/events/ROLES.md) |
| Diretorias e designations | [ADR 006](adrs/006-directorates-designations.md) · [Mapa de papéis](modules/events/ROLES.md) |
| Insights / Social Stats | [Estatísticas e presença digital](modules/insights/SOCIAL_STATS.md) |
| Privacidade e proteção de dados | [Visão geral](modules/privacy/README.md) · [Inventário de tratamentos](modules/privacy/treatments.md) |

## Plans — índice completo

Consulte **[plans/README.md](plans/README.md)** para todos os planos de `docs/plans/` e `docs/superpowers/plans/`, separados em:

- ativos/propostas que exigem revalidação ou aprovação;
- plano 1.0.0 e anexos concluídos;
- históricos/superseded;
- Real Network, mantido somente como visão exploratória fora do backlog.

Atalhos atuais:

- [Roadmap pós-1.0.0](plans/pos-1-0/README.md) — Fases 7.1/7.2/9 publicadas; Fase 8 concluída em develop/1.3.0.
- [Roadmap proposto 1.5](plans/codaqui-1-5/README.md) — painéis agregados que exigem backend novo; não aprovado.
- [Spec da Fase 8](superpowers/specs/2026-11-17-public-pages-design.md) · [Plano TDD concluído](superpowers/plans/2026-11-17-public-pages.md).

## Convenções

- **ADRs**: `NNNN-titulo-curso.md`, com AGENT-INDEX, contexto, decisão, consequências e data.
- **Módulos**: agrupe por domínio e mantenha o comportamento atual, não o histórico de implementação.
- **Plans**: mantenha status explícito no AGENT-INDEX e classifique no índice; planos concluídos permanecem como evidência histórica.
- **Releases**: frontend/backend compartilham versão e lockfiles; toda release atualiza `CHANGELOG.md`.
