<!-- AGENT-INDEX
purpose: Índice completo dos planos do monorepo, separando trabalho ativo, histórico implementado/superseded, planos executáveis Superpowers e visões fora do backlog.
audience: Mantenedores, presidência e AI agents escolhendo ou executando trabalho.
status: Revisado em 2026-11-18 até 1.8.0 implementado em develop; Real Network fora da revisão operacional.
sections:
  - Como ler
  - Planos ativos e propostas
  - Plano 1.0.0 e anexos históricos
  - Outros históricos e visão
  - Planos executáveis Superpowers
related-docs:
  - ../../CHANGELOG.md — releases 1.0.0–1.2.0.
  - pos-1-0/README.md — roadmap vivo posterior ao 1.0.0.
  - codaqui-1-5/README.md — propostas de agregação de painéis, não aprovadas.
agent-protocol:
  - Consultar o status atual aqui antes de executar um plano antigo; checkboxes históricos não são autorização.
  - Somente planos ativos com spec/plano ratificados podem virar implementação; revalidar o código antes de agir.
  - Não transformar real-network em tarefa ou backlog operacional.
-->

# Índice de planos

Este índice cobre todos os documentos em `docs/plans/` e todos os planos executáveis em `docs/superpowers/plans/`. O estado corrente de um contrato implementado continua nas ADRs e na documentação de módulos; o changelog registra as releases.

## Planos ativos e propostas

| Documento | Estado em 2026-11-17 | Próxima ação |
|---|---|---|
| [Pós-1.0.0](pos-1-0/README.md) | Roadmap vivo. Fases 8b e 10 implementadas em develop/1.8.0; P6/P7 concluídos; candidatos seguintes não aprovados. | Publicar/validar 1.8.0; só implementar nova fase após spec ratificada. |
| [Fase 10.1 — Home e jornadas](../superpowers/plans/2026-11-18-home-journeys.md) | Implementada em develop/1.8.0 com testes, gates e Playwright. | Publicar e validar Home/navegação reais. |
| [Fase 10.2 — Transparência e perfil](../superpowers/plans/2026-11-18-community-transparency-profile.md) | Implementada em develop/1.8.0 com APIs públicas, privacidade e jornada PostgreSQL/browser. | Publicar backend antes do frontend; validar sem mutações não autorizadas. |
| [Fase 10.3 — Robustez administrativa](../superpowers/plans/2026-11-18-admin-robustness.md) | Implementada em develop/1.8.0 com cursores Stripe e conversão isolada idempotente. | Publicar e validar operação sem conversão real não autorizada. |
| [Fase 8b.1 — cadastro assistido de extensão](../superpowers/plans/2026-11-17-extension-project-assisted.md) | Implementada em develop/1.5.0 com TDD, revisão e jornada real; release/deploy pendente. | Publicar backend, frontend e validar jornada controlada. |
| [Fase 8b.2 — vitrine open source para extensão](../superpowers/plans/2026-11-17-open-source-extension.md) | Implementada em develop/1.6.0 com diagnóstico de mentoria, testes e jornada real; release/deploy pendente. | Publicar e validar importação e disponibilidade real. |
| [Fase 8b.3 — assinatura pessoal para apoio empresarial](../superpowers/plans/2026-11-17-personal-to-business.md) | Implementada em develop/1.7.0 com migration 052, testes e jornada real; release/deploy e conversão real pendente. | Publicar e executar conversão somente com autorização. |
| [Frontend em jornadas](frontend-jornadas/README.md) | Inventário vivo. Onda 1 e reorganização da Fase 9 publicadas; demais ondas exigem revalidação. | Extrair somente itens ainda reproduzíveis para specs próprias. |
| [Roadmap 1.5](codaqui-1-5/README.md) | Proposta, não aprovada e sem data. | Desenhar agregações/backend antes de prometer painéis dinâmicos. |
| [Sync de eventos — MAP](events-sync-improvements/MAP.md) | Camadas 1–2 concluídas; Camada 3 somente em design. | Revalidar a Camada 3 antes de remover o force-sync legado. |
| Sync de eventos — [Camada 1](events-sync-improvements/layer1-quick-wins-design.md), [Camada 2](events-sync-improvements/layer2-robustez-design.md) e [Camada 3](events-sync-improvements/layer3-sem-pr-design.md) | Designs das três camadas; 1–2 concluídas e 3 não implementada. | Usar o MAP como entrada; não executar a Camada 3 sem ratificação. |
| [UI/UX de eventos](event-uiux-improvements/README.md) | Histórico parcial: Sprints 1–5 concluídas; Sprint 6 não executada e parcialmente suplantada. | Revalidar cada dor; não executar o documento inteiro. |
| [Atualização de dependências](update/README.md) | Backlog antigo com partes concluídas/bloqueadas e versões defasadas. | Regerar com `npm outdated` antes de qualquer upgrade. |

## Plano 1.0.0 e anexos históricos

O plano 1.0.0 está tecnicamente concluído até a Fase 7. Estes documentos explicam decisões e evidências, mas não representam trabalho novo por si só.

| Documento | Classificação |
|---|---|
| [Plano-mãe 1.0.0](codaqui-1-0/README.md) | Fases 0–7 publicadas; campanha piloto do C4P e outras validações reais permanecem operacionais. |
| [C4P](codaqui-1-0/c4p.md) | Implementado em 1.0.0, hotfix de boot em 1.0.1 e hardening em 1.0.2; piloto real pendente. |
| [Fase 1a](codaqui-1-0/fase-1a.md) | Concluída e publicada. |
| [Fase 1b](codaqui-1-0/fase-1b.md) | Concluída e publicada. |
| [Fase 2](codaqui-1-0/fase-2.md) | Concluída e publicada; Discussion real de assembleia é acompanhamento operacional. |
| [Cadastro de projeto de extensão](codaqui-1-0/cadastro-projeto-extensao.md) | Base implementada na Fase 4; melhorias assistidas pertencem à proposta da Fase 8b. |
| [Refatoração Astro](codaqui-1-0/refatoracao-frontend-astro.md) | Implementada nas Fases 0.1–0.6; spec histórica. |
| [Design System](codaqui-1-0/design-system.md) | Implementado; tokens e tema atuais são as fontes canônicas. |
| [Autenticação](codaqui-1-0/auth.md) | Login centralizado e guest token implementados. |
| [RBAC](codaqui-1-0/rbac.md) | Contrato implementado; mudanças futuras exigem ADR/spec compatível. |
| [ECA/LGPD](codaqui-1-0/eca-lgpd.md) | Sinalização informativa 18+ implementada; revisões jurídicas não são inferidas. |
| [Transversais G3–G6](codaqui-1-0/transversais.md) | Turnstile, Pagefind, decisão de certificados e retenção configurável entregues nas fases correspondentes. |
| [Comunidades — plataforma](codaqui-1-0/comunidades-plataforma.md) | Extensão futura não aprovada: Autônoma, D2 e split não fazem parte do sistema atual. |

## Outros históricos e visão

| Documento | Classificação |
|---|---|
| [PRÓXIMOS_PASSOS](PROXIMOS_PASSOS.md) | Arquivado; snapshot de 2026-09-10 substituído pelo roadmap pós-1.0.0. |
| [Vulnerabilities](vulnerabilities/README.md) | Executado e encerrado em 2026-09-21. |
| [Multisite](multisite/README.md) | Superseded pela Fase 0.5/build matrix; manter apenas como histórico. |
| [Real Network](real-network/README.md) | RFC exploratório e visão de longo prazo. Fora do backlog, sem análise ou detalhamento nesta consolidação. |

## Planos executáveis Superpowers

Os documentos abaixo são registros de implementação. Seu texto pode conter comandos e checkboxes do momento da execução; o status desta tabela e as releases prevalecem para decidir trabalho futuro.

### Releases 1.x

| Plano | Estado |
|---|---|
| [Fase 10.1 — Home e jornadas](../superpowers/plans/2026-11-18-home-journeys.md) | Implementada em develop/1.8.0; gates e evidência visual concluídos. |
| [Fase 10.2 — Transparência e perfil](../superpowers/plans/2026-11-18-community-transparency-profile.md) | Implementada em develop/1.8.0; jornada PostgreSQL/browser concluída. |
| [Fase 10.3 — Robustez administrativa](../superpowers/plans/2026-11-18-admin-robustness.md) | Implementada em develop/1.8.0; jornada isolada de conversão concluída. |
| [Fase 8b.3 — assinatura pessoal para apoio empresarial](../superpowers/plans/2026-11-17-personal-to-business.md) | Implementada em develop/1.7.0 com migration 052, revisão e jornada real; release/deploy e conversão real pendente. |
| [Fase 8b.2 — vitrine open source para extensão](../superpowers/plans/2026-11-17-open-source-extension.md) | Implementada em develop/1.6.0 com diagnóstico de mentoria; release/deploy pendente. |
| [Fase 8b.1 — cadastro assistido de extensão](../superpowers/plans/2026-11-17-extension-project-assisted.md) | Implementada em develop/1.5.0 com builder check, revisão e jornada real; release/deploy pendente. |
| [Reconciliação de taxas Stripe](../superpowers/plans/2026-11-17-stripe-fee-reconciliation.md) | Implementada em develop com TDD, verificação integrada e gates; reconciliação em produção depende de deploy. |
| [Fase 8 — páginas públicas](../superpowers/plans/2026-11-17-public-pages.md) | Concluída em develop/1.3.0 com TDD e gates; integração em main pendente. |
| [Fase 9 — painéis e privacidade](../superpowers/plans/2026-11-16-fase-9-paineis.md) | Publicado em 1.2.0, migration 051, PR #654; revisão jurídica não presumida. |
| [Fase 7.2 — ciclo de mentoria](../superpowers/plans/2026-11-16-mentorship-lifecycle.md) | Publicado em 1.1.0, migration 050, PR #652. |
| [Fase 7.1 — eventos e blog](../superpowers/plans/2026-11-16-fase-7-1-eventos-blog.md) | Integrado pela PR #652 e presente na linha publicada após 1.0.2. |
| [Onda 1 — frontend e C4P](../superpowers/plans/2026-11-16-frontend-onde1.md) | Publicado em 1.0.2, PR #650. |
| [Fase 7 — C4P](../superpowers/plans/2026-11-12-c4p.md) | Publicado em 1.0.0; hotfix de DI em 1.0.1; piloto real pendente. |

### Releases 0.19.0–0.27.0 e operações associadas

| Plano | Estado |
|---|---|
| [Campanhas de e-mail](../superpowers/plans/2026-11-09-email-campaigns.md) | Publicado em 0.27.0; PR #638 não deve mais ser descrita como aberta. |
| [Announcements](../superpowers/plans/2026-11-11-announcements.md) | Publicado em 0.26.0; aviso real permanece acompanhamento operacional. |
| [Comprovantes de doação](../superpowers/plans/2026-11-11-donation-receipts.md) | Publicado em 0.26.0. |
| [Experiência do membro](../superpowers/plans/2026-11-11-member-experience.md) | Publicado em 0.25.0; validação visual real é acompanhamento. |
| [Mentoria Operations](../superpowers/plans/2026-11-10-mentorship-operations.md) | Publicado em 0.22.0; ciclo de vida ampliado em 1.1.0. |
| [Business tiers](../superpowers/plans/2026-11-10-business-tiers.md) | Publicado em 0.21.0. |
| [Vínculo de conta e certificado](../superpowers/plans/2026-11-10-certificate-account-link.md) | Publicado em 0.20.0. |
| [Mentoria — Fase 5](../superpowers/plans/2026-11-09-mentorship-phase5.md) | Publicado em 0.19.0. |
| [Codaqui Universitário](../superpowers/plans/2026-11-09-codaqui-universitario.md) | Publicado em 0.19.0, com administração ampliada em 0.24.0. |
| [Fila de convites de certificado](../superpowers/plans/2026-11-09-certificate-invite-queue.md) | Publicado; serialização SMTP ampliada em 0.23.0. |
| [Certificação desacoplada](../superpowers/plans/2026-11-09-checkin-certificate-decoupling.md) | Concluído; jornada do membro ampliada em 0.24.0. |
| [Entidades e extensão](../superpowers/plans/2026-11-07-entities-extension.md) | Publicado em 0.16.0; proteções administrativas ampliadas em 0.24.0. |
| [Assembleias](../superpowers/plans/2026-11-05-assembleias.md) | Rollout concluído em 0.15.0; Discussion real pendente. |

### Fase 0 e planos anteriores

| Plano | Estado |
|---|---|
| [Fase 0.6 — cutover](../superpowers/plans/2026-10-28-fase-0-6-cutover-codaqui-dev.md) | Concluído e publicado em 2026-10-29. |
| [Fase 0.5 — multi-tenant](../superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md) | Concluído. |
| [Fase 0.4 — app/admin/membro](../superpowers/plans/2026-10-26-fase-0-4-app-admin-membro.md) | Concluído. |
| [Fase 0.3 — site público](../superpowers/plans/2026-10-21-fase-0-3-site-publico.md) | Concluído. |
| [Fase 0.2 — conteúdo](../superpowers/plans/2026-10-21-fase-0-2-conteudo-blog-trilhas.md) | Concluído. |
| [Fase 0.1 — esqueleto Astro](../superpowers/plans/2026-10-20-fase-0-1-astro-esqueleto-poc.md) | Concluído. |
| [Templates de e-mail](../superpowers/plans/2026-09-25-email-templates.md) | Concluído. |
| [Site DevParaná](../superpowers/plans/2026-08-17-devparana-community-site-plan.md) | Superseded; entregue pela Fase 0.5/build matrix. |
