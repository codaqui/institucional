<!-- AGENT-INDEX
purpose: Roadmap pós-1.0.0 do monorepo Codaqui — releases concluídas, próxima fase preparada, candidatos não aprovados e pendências operacionais.
audience: Presidência, mantenedores e AI agents planejando o pós-1.0.0.
status: Revisado em 2026-11-17 até 1.4.0 integrado em main; Fase 8b.1 implementada em develop, release pendente; P6/P7 não aprovados.
sections:
  - Estado das releases
  - Fases concluídas
  - Fase 8 concluída
  - Candidatos posteriores
  - Painéis adiados
  - Pendências operacionais
  - Como propor uma nova fase
related-docs:
  - ../../../CHANGELOG.md — ordenação completa das releases 1.0.0 em diante.
  - ../README.md — classificação de todos os planos.
  - ../codaqui-1-5/README.md — painéis que exigem agregações/backend novo.
  - ../../superpowers/specs/2026-11-17-public-pages-design.md — design da Fase 8.
  - ../../superpowers/plans/2026-11-17-public-pages.md — plano TDD concluído da Fase 8.
agent-protocol:
  - A Fase 8 está integrada em main e a Fase 8b.1 implementada em develop; P6/P7 continuam não aprovados e exigem specs próprias.
  - Fases e “1.5” são rótulos de organização, não versões garantidas; revalidar código e escopo antes de executar.
  - Real Network é visão exploratória e não integra este backlog.
-->

# Fases pós-1.0.0 — roadmap consolidado

## Estado das releases

| Versão | Entrega principal | Evidência |
|---|---|---|
| 1.0.0 | C4P integrado, migration 049 | PR #639 e `v1.0.0-backend`, 13/11. |
| 1.0.1 | Hotfix de DI do `TurnstileGuard` no boot do C4P | `v1.0.1-backend`, 13/11. |
| 1.0.2 | Onda 1 de UX e hardening do C4P | PR #650 e `v1.0.2-backend`, 16/11. |
| 1.1.0 | Ciclo de mentoria, migration 050; inclui também correções de eventos/blog | PR #652 e `v1.1.0-backend`, 16/11. |
| 1.2.0 | Painéis e autosserviço de privacidade, migration 051 | PR #654 e `v1.2.0-backend`, 17/11. |
| 1.3.0 | Fase 8 — páginas públicas conectadas às projeções | PR #655 em main; release/deploy pendente. |
| 1.4.0 | Reconciliação idempotente de taxas Stripe e guia leve de agentes | PR #655 em main; reconciliação em produção após deploy. |

O [changelog](../../../CHANGELOG.md) é a fonte ordenada das mudanças. Frontend e backend passam a compartilhar a versão de produto; a tag histórica `-backend` não implica versionamento independente do frontend.

## Fases concluídas

### Fase 7.1 — Eventos e prévia do blog

**Publicada na linha 1.1.0.** Normalização de descrições do Discord, contenção de resumos nos cards de eventos e thumbnails decorativas do blog. Spec/plano: `docs/superpowers/specs/2026-11-16-fase-7-1-eventos-blog-design.md` e `docs/superpowers/plans/2026-11-16-fase-7-1-eventos-blog.md`.

### Fase 7.2 — Consistência do fluxo de mentoria

**Publicada em 1.1.0, migration 050, PR #652.** Sincronização transacional de designation/perfil, candidatura atômica, vigência no snapshot, apresentação das sessões e vínculo manual de participantes a contas da plataforma. Spec/plano: `docs/superpowers/specs/2026-11-16-mentorship-lifecycle-design.md` e `docs/superpowers/plans/2026-11-16-mentorship-lifecycle.md`.

### Fase 9 — UX dos painéis e privacidade

**Publicada em 1.2.0, migration 051, PR #654.** Quatro seções no painel do membro, filtros por chips, consolidação financeira, seis grupos admin, prévia de privacidade, exportação JSON e solicitação revisada de exclusão. Spec/plano: `docs/superpowers/specs/2026-11-16-fase-9-paineis-design.md` e `docs/superpowers/plans/2026-11-16-fase-9-paineis.md`.

A evidência de revisão jurídica/da diretoria não foi localizada nesta consolidação e não deve ser presumida.

## Fase 8 concluída — páginas públicas conectadas ao banco

**Implementada com versão compartilhada 1.3.0 e integrada em `main` pelo PR #655; release/deploy ainda pendente.**

- **P3 — `/sobre/equipe`:** Diretoria/Membros/Alumni mantêm curadoria local e enriquecimento por GitHub handle com `loadPublicMembers()`; sem match, preservam fallback local sem criar conta. Mentores vêm somente do snapshot público ativo/vigente.
- **P4 — `/sobre/ong`:** comunidades usam `loadCommunitiesIndex()`, com nível/selo efetivo e data do snapshot; portais são a interseção do registro elegível com `TENANTS`, usando o domínio configurado.
- **Correção associada:** o loader de mentores agora encontra o snapshot após o bundling do Astro, com teste de regressão; o smoke do `dist/` confirmou o mentor real renderizado.
- **Limites preservados:** sem migration, backend, membership automático, alteração de APIs ou consolidação global de `data/communities.ts`.

Documentos: [design](../../superpowers/specs/2026-11-17-public-pages-design.md) e [plano TDD](../../superpowers/plans/2026-11-17-public-pages.md). A próxima candidata é a Fase 8b, ainda não aprovada.

## Candidatos posteriores

### Fase 8b — Projetos de extensão e patrocínio PJ (P12 planejado; P6/P7 não aprovados)

P12 foi recortado como **Fase 8b.1 — cadastro assistido de extensão**, com [spec](../../superpowers/specs/2026-11-17-extension-project-assisted-design.md) e [plano TDD](../../superpowers/plans/2026-11-17-extension-project-assisted.md) revisados por builder check. A implementação em `develop` inclui busca/preservação de mentores, sincronização por delta, ODS, parceiros, orçamento e anexos, com jornada real validada em banco isolado. P6 e P7 continuam sem aprovação e exigem specs próprias.

| Item | Escopo a revalidar |
|---|---|
| P12 Cadastro assistido de extensão | Busca de mentores/coMentores sem UUID digitado, ODS com nomes, metodologia pré-preenchida, validações no formulário e campos já modelados que não aparecem na UI. Área CNPq exige decisão de produto/backend antes de promessa. |
| P6 Projetos atuais → extensão | Repositórios open source permanecem vitrine separada, salvo se receberem entidade jurídica, ODS, datas, mentor e demais dados obrigatórios; não converter automaticamente. |
| P7 Assinatura pessoal → apoio empresarial | Fluxo administrativo auditado para vincular/criar empresa sem apagar histórico Stripe; revalidar o caso real em dump isolado antes da spec. |

A divisão entre projetos e patrocínio pode virar specs/PRs independentes. Não usar dados reais do dump em fixtures ou documentação.

### Candidatos anteriores, sem aprovação

| Candidato | Estado |
|---|---|
| Camada 3 do sync de eventos | Design em `events-sync-improvements/`; revalidar blast radius e o force-sync legado antes de implementar. |
| Sprint 6 — hub unificado de eventos | Histórico parcial; diversas dores foram suplantadas, revalidar item a item. |
| Hardening financeiro | Backlog antigo de maior risco; confirmar atomicidade, saldos, idempotência, limites e taxas diretamente no código atual. |
| Atualização de dependências | Plano defasado; regerar com `npm outdated`, sem assumir que os majors listados continuam atuais. |
| Votação eletrônica formal | Somente conceito; exige quórum, auditoria, LGPD e governança próprios. |
| Consolidação de frontend — ondas 2/3 | Revalidar o inventário após 1.0.2 e 1.2.0; não repetir itens já entregues. |
| Multisite — onboarding de novas comunidades | Requisito operacional e de conteúdo; atualizar tenants/workflows/DNS somente quando houver comunidade aprovada. |

## Painéis adiados para a proposta 1.5

Os seguintes itens **não foram implementados** na Fase 9 porque exigem novas agregações de backend e fluxos completos:

1. “Próximos passos” dinâmicos no Início do membro, agregando eventos, mentoria, horas e demais domínios.
2. Contadores de pendências na sidebar/admin por papel e escopo.
3. Dashboard unificado de pendências por papel, com autorização, paginação e ações completas.

Detalhes e dependências: [roadmap proposto 1.5](../codaqui-1-5/README.md). O rótulo não é promessa de versão nem autorização de implementação.

## Pendências operacionais — não são fases de código

1. Campanha piloto real do C4P, incluindo submissão, curadoria, PDF e e-mails.
2. Discussion e assembleia reais, com validação do Giscus por pathname.
3. Validação visual real da Experiência do Membro e aviso real de Announcements.
4. CI com boot real do backend e PostgreSQL de serviço, sem overrides de guards, para cobrir a falha que motivou 1.0.1.
5. Revisão jurídica/da diretoria dos fluxos de privacidade quando aplicável; merge/release não substituem essa evidência.

## Como propor uma nova fase

1. Investigar o estado atual e registrar evidências.
2. Criar spec executável com escopo, não objetivos e pontos de revisão humana.
3. Fazer builder check e elaborar plano TDD.
4. Obter ratificação antes de implementar.
5. Implementar em `develop` com PR de acompanhamento e revisão independente.
6. Produzir ADR somente se houver contrato novo; atualizar índice, roadmap e `CHANGELOG.md`.
7. Alinhar frontend/backend e lockfiles na mesma versão de release (feat → minor, fix → patch).
