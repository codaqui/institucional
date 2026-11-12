<!-- AGENT-INDEX
purpose: ADR das campanhas de e-mail (E3), com segmentação, consentimento promocional independente, supressões, fila persistente e descadastro sem login.
audience: AI agents, mantenedores e operadores de release.
status: Implementado e verificado; integração e publicação pendentes.
sections:
  - Contexto e decisão
  - Consentimento, segmentos e supressões
  - Fila persistente, ritmo global e idempotência
  - APIs, frontend e privacidade
  - Verificação e rollout
related-docs:
  - ../superpowers/specs/2026-11-09-email-campaigns-design.md — design aprovado
  - ../superpowers/plans/2026-11-09-email-campaigns.md — plano TDD e evidências
  - 016-certificate-invite-queue.md — advisory lock e ritmo global de SMTP
  - 017-announcements.md — anúncios públicos (independentes de campanhas)
  - ../modules/privacy/treatments.md — inventário de tratamentos e retenção
agent-protocol:
  - Comunicação promocional exige opt-in explícito e link de descadastro sem login; nunca reutilizar consentimento transacional.
  - Não incluir pixels de abertura, rastreamento de cliques, anexos ou envio síncrono no request HTTP.
-->

# ADR 018 — Campanhas de E-mail (E3)

- **Data da decisão:** 2026-11-11
- **Status:** Implementado e verificado; integração e publicação pendentes
- **Escopo:** Backend 0.27.0, migration 048, módulo `campaigns`, consentimento promocional, descadastro público, fila persistente e aba Campanhas em `/admin/emails`

## Contexto e decisão

A associação precisava enviar comunicados institucionais e malas diretas segmentadas para membros e públicos autorizados sem bloquear requests HTTP, sem estourar limites do SMTP Gmail e respeitando estritamente a LGPD. O recorte adotado separa mensagens **transacionais** (`transactional`) e **promocionais** (`promotional`), exige prévia e confirmação explícitas antes do enfileiramento e compartilha o advisory lock global de sessão do PostgreSQL e o intervalo `EMAIL_SEND_INTERVAL_MS` já usados pelo `EmailService`.

Não há open/click tracking, pixels, anexos, construtor drag-and-drop ou automações comportamentais.

## Consentimento, segmentos e supressões

- `members.marketingEmailOptIn` (`boolean NOT NULL DEFAULT false`) controla o opt-in promocional, editável pelo próprio titular em **Meus dados** (`PATCH /members/me/marketing-consent`) e auditado em governança (`MEMBER_MARKETING_CONSENT_UPDATED`).
- `email_suppressions` armazena endereços normalizados (`emailNormalized`) com motivos `unsubscribe_promotional`, `hard_bounce`, `manual_block` e `invalid_email`.
- Supressão precede qualquer segmento:
  - `hard_bounce`, `manual_block` e `invalid_email` bloqueiam campanhas promocionais e transacionais;
  - `unsubscribe_promotional` bloqueia campanhas promocionais mesmo que um administrador tente reativar `marketingEmailOptIn` diretamente no banco. Somente o próprio titular autenticado pode reativar seu opt-in promocional em **Meus dados**, o que remove a supressão `unsubscribe_promotional`.
- Segmentos suportados:
  - `all_opted_in_members` (exclusivo para promocionais);
  - `role` (membros ativos com role ativa);
  - `designation` (membros ativos com designation ativa e dentro da vigência);
  - `community_governance` (somente membros ativos com vínculo explícito e vigente na comunidade ou em diretoria ativa da comunidade);
  - `manual` (lista explícita validada, deduplicada por `emailNormalized`, exigindo `marketingEmailOptIn = true` quando promocional).
- Apenas membros com `isActive = true` e e-mail verificado no GitHub (`githubEmailVerified = true`) entram nos segmentos de membros.

## Fila persistente, ritmo global e idempotência

- `POST /campaigns` aceita `idempotencyKey` (retornando a campanha existente quando repetida pelo mesmo ator).
- `POST /campaigns/:id/confirm` exige prévia recente para a revisão atual do rascunho, materializa `email_campaign_recipients` deduplicados por `(campaign_id, email_normalized)` e move a campanha para `queued` ou `scheduled`.
- O worker (`@Cron('*/15 * * * * *')`) promove campanhas `scheduled` vencidas, recupera recipients `sending` órfãos há mais de 2 minutos e reclama lotes curtos com `FOR UPDATE SKIP LOCKED` fora da chamada SMTP.
- O envio usa `EmailService.sendRenderedEmail`, compartilhando o advisory lock global de sessão do PostgreSQL e `EMAIL_SEND_INTERVAL_MS`.
- Erros transitórios aplicam backoff de 1 min e 5 min (máximo de 3 tentativas); respostas SMTP `421`/`454` pausam a campanha por 15 minutos (`pausedUntil`).
- `POST /campaigns/:id/recipients/:recipientId/retry` reprocessa apenas destinatários `failed`, nunca reenvia `sent`.

## APIs, frontend e privacidade

- Rotas de gestão fora de `/admin/`: `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `POST /campaigns/:id/preview`, `POST /campaigns/:id/test`, `POST /campaigns/:id/confirm`, `POST /campaigns/:id/cancel`, `POST /campaigns/:id/recipients/:recipientId/retry` e `GET/POST/DELETE /campaigns/suppressions`.
- Descadastro público sem login: `GET /campaigns/unsubscribe?token=...` e página `/descadastro?token=...` (`noindex`, fora do sitemap), que aplicam `marketingEmailOptIn = false` e supressão `unsubscribe_promotional` usando apenas o hash SHA-256 do token (`unsubscribeTokenHash`), sem expor e-mail ou outros dados pessoais.
- `/admin/emails` organiza **Campanhas**, **Logs** e **Templates**, com jornada Conteúdo → Público → Prévia e Teste → Confirmação → Acompanhamento, polling visível sem concorrência, filtros de logs por destinatário/período/status/template/campanha e exportação CSV autorizada (`GET /notifications/emails/export`). Para `finance-analyzer`, `email_normalized` nas supressões e motivos sensíveis em logs são redigidos.
- Retenção: `cleanupOldRecipients` (`@Cron('0 45 3 * * *')`) anonimiza `email`, `name`, `emailNormalized` e `unsubscribeTokenHash` em `email_campaign_recipients` após 365 dias, preservando contagens agregadas; `email_suppressions` permanecem enquanto necessário para respeitar a revogação.

## Verificação e rollout

- Backend: testes unitários cobrindo migration 048, segmentos, supressões, preview/test/confirm/cancel/retry, worker, backoff 421/454, descadastro público, anonimização 365d, filtros de logs e exportação CSV; E2E em PostgreSQL real cobrindo concorrência `SKIP LOCKED`, advisory lock compartilhado, descadastro imune a reativação indevida por admin, retenção e migration 048 `down`/`up`.
- Frontend: testes Vitest para `UnsubscribeIsland`, `MyDataTab`, `EmailsCampaignsTab`, `EmailsApp`, `api-proxy-paths` e `sitemap-filter`, mais `astro check`, `make astro-verify` e `make astro-verify-tenants`.
- Rollout: publicar backend `0.27.0` e executar migration `048`, validar campanha sintética em preview/teste e descadastro antes de autorizar o primeiro envio real.
