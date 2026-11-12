<!-- AGENT-INDEX
purpose: Plano TDD da fase Campanhas E3 (malas diretas, segmentação, consentimento promocional, descadastro, fila persistente e logs).
audience: Implementers e revisores independentes da fase posterior a Announcements (0.26.0/047).
status: Concluído e integrado em develop pela PR #637 (11 checks + SonarCloud 0 issues); PR #638 aberta para main.
sections:
  - Global Constraints & Review Focus
  - Task 1: Migration 048, entidades, consentimento independente e descadastro
  - Task 2: Resolução de segmentos, prévia congelada, supressões e CRUD de campanhas
  - Task 3: Teste, confirmação, fila persistente (SKIP LOCKED), ritmo global, retries, cancelamento e retenção
  - Task 4: Filtros avançados, exportação CSV em /notifications/emails e proxy allow-list
  - Task 5: Frontend /descadastro, Meus dados e /admin/emails (Campanhas, Logs e Templates)
  - Task 6: Privacidade, ADR 018, E2E PostgreSQL real, revisão independente e gates
related-docs:
  - docs/superpowers/specs/2026-11-09-email-campaigns-design.md — contrato e requisitos da fase E3
  - docs/adrs/016-certificate-invite-queue.md — advisory lock global de sessão PostgreSQL e ritmo SMTP
  - docs/adrs/006-directorates-designations.md — segmentos determinísticos por designations
  - docs/modules/privacy/treatments.md — inventário de dados pessoais
agent-protocol:
  - Executar ciclo RED-GREEN em cada task, sem introduzir BullMQ, Redis, pixels, open/click tracking ou anexos.
  - Comunicação promocional exige marketingEmailOptIn independente e descadastro funcional; email_suppressions antecede qualquer segmento.
  - Realizar revisão independente da branch antes do merge.
-->

# Campanhas de E-mail E3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que administradores criem, segmentem, pré-visualizem, testem, confirmem, agendem, acompanhem e cancelem campanhas de e-mail (`transactional` ou `promotional`) em `/admin/emails`, com consentimento promocional independente em "Meus dados", descadastro público sem login (`/descadastro`), fila PostgreSQL idempotente com `FOR UPDATE SKIP LOCKED`, serialização global de SMTP, retries com backoff e filtros/exportação de logs.

**Architecture:** Módulo NestJS `CampaignsModule` integrado a `NotificationsModule` (`EmailService` e `EmailTemplateService`), `MembersModule` e `AuditModule`. A fila de destinatários reside em `email_campaign_recipients`, processada em lotes pequenos com `FOR UPDATE SKIP LOCKED` fora da chamada SMTP e serializada pelo advisory lock global de sessão PostgreSQL do `EmailService` (`EMAIL_SEND_INTERVAL_MS`). O frontend adiciona `/descadastro`, preferência de marketing em `MyDataTab` e a aba **Campanhas** + filtros/exportação na aba **Logs** de `/admin/emails`.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30 / Supertest, Astro 7, React 19, MUI v9, Vitest 3, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-09-email-campaigns-design.md`

## Global Constraints

- Base: `develop` com backend **0.26.0** e migration **047**. Esta fase usa backend **0.27.0** e migration **048** (`1.0.0` permanece reservada à Fase 7/C4P).
- Sem provedor externo novo, Redis, BullMQ, open/click tracking, pixels (`<img>`), anexos, importação livre de CSV, SMS, bounce handling automático ou editor HTML irrestrito.
- `marketingEmailOptIn` em `members` (default `false`), independente de `eventCommsOptIn`, doações, inscrições ou guests. Somente o titular altera ou reativa seu consentimento promocional; admin recebe `403 Forbidden` se tentar ativá-lo ou remover supressão de `unsubscribe`.
- `email_suppressions` antecede qualquer segmento: `unsubscribe` e `admin` bloqueiam campanhas promocionais (mesmo que `marketingEmailOptIn` esteja `true` no banco); `complaint` e `bounce_manual` bloqueiam promocionais e transacionais.
- Rotas de gestão fora de `/admin/`: `/campaigns`, `/campaigns/:id`, `/campaigns/:id/preview`, `/campaigns/:id/test`, `/campaigns/:id/confirm`, `/campaigns/:id/cancel`, `/campaigns/:id/recipients/:recipientId/retry`, `/campaigns/suppressions`, `/campaigns/unsubscribe` e `/descadastro`.
- `admin` cria, edita, pré-visualiza, testa, confirma, cancela, faz retry e vê destinatários; `finance-analyzer` lê campanhas e logs sem PII (`name`/`email`/`handle` omitidos/mascarados).

## Review Focus

- `community_governance` seleciona apenas membros com vínculo explícito ativo (`designation` na comunidade ou `director`/`volunteer` em diretoria ativa da comunidade), excluindo membros sem vínculo ou com papel inativo.
- Dois workers/DataSources concorrentes nunca enviam duas vezes para o mesmo recipient (`FOR UPDATE SKIP LOCKED` + transição atômica para `sending` antes do SMTP).
- O token de descadastro cru aparece apenas no link enviado; banco e logs guardam exclusivamente `unsubscribeTokenHash` (SHA-256) e erros sanitizados sem segredos/stack trace.
- Descadastro impede campanhas promocionais posteriores mesmo após tentativa de reativação indevida por admin (via API ou `marketingEmailOptIn = true` direto no banco); reativação exige ação explícita do próprio titular autenticado.
- Polling de progresso no frontend ocorre apenas com `document.visibilityState === "visible"` e sem requisições concorrentes.

---

### Task 1: Migration 048, entidades, consentimento independente e auditoria

**Files:**
- Create: `backend/src/campaigns/entities/email-campaign.entity.ts`
- Create: `backend/src/campaigns/entities/email-campaign-recipient.entity.ts`
- Create: `backend/src/campaigns/entities/email-suppression.entity.ts`
- Create: `backend/src/migrations/1795100000000-Migration048_EmailCampaigns.ts`
- Create: `backend/src/campaigns/email-campaigns.migration.spec.ts`
- Modify: `backend/src/members/entities/member.entity.ts`
- Modify: `backend/src/notifications/entities/email-log.entity.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit-category.ts`
- Modify: `backend/src/audit/audit-category.spec.ts`
- Modify: `backend/src/members/members.controller.ts`
- Modify: `backend/src/members/members.service.ts`
- Modify: `backend/src/members/members.service.spec.ts`
- Modify: `backend/src/members/members.controller.spec.ts`
- Modify: `backend/package.json` e `backend/package-lock.json` (bump `0.27.0`)

**Interfaces:**
- `EmailCampaign`: `id`, `name`, `subject`, `bodyMarkdown`, `templateId?`, `purpose` (`transactional | promotional`), `status` (`draft | preview | scheduled | sending | completed | completed_with_errors | failed | canceled`), `segmentType` (`all_opted_in_members | role | designation | community_governance | manual`), `segmentConfig`, `scheduledAt?`, `startedAt?`, `completedAt?`, `createdById`, `confirmedById?`, `confirmedAt?`, `idempotencyKey`, `createdAt`, `updatedAt`.
- `EmailCampaignRecipient`: `id`, `campaignId`, `memberId?`, `email?`, `name?`, `emailNormalized?`, `status` (`pending | sending | sent | failed | skipped | suppressed`), `attempts`, `nextAttemptAt?`, `lockedAt?`, `lastError?`, `sentAt?`, `emailLogId?`, `unsubscribeTokenHash?`, `createdAt`, `updatedAt`.
- `EmailSuppression`: `id`, `emailNormalized` (unique), `reason`, `source` (`unsubscribe | admin | complaint | bounce_manual`), `createdById?`, `createdAt`.
- `PATCH /members/me/marketing-consent`: `{ marketingEmailOptIn: boolean, confirmReactivation?: boolean }`.

- [x] **Step 1: Escrever testes RED da migration 048, auditoria de governança e consentimento do titular**

Cobrir:
- SQL `up`/`down` da `Migration048EmailCampaigns1795100000000` (tabelas `email_campaigns`, `email_campaign_recipients`, `email_suppressions`, coluna `members.marketingEmailOptIn`, colunas `email_logs.campaignId` e `campaignRecipientId`, constraints `UNIQUE ("campaignId", "emailNormalized")` e checks de status/purpose/source).
- Classificação `governance` para as novas `AuditAction` de campanhas, supressões e consentimento de marketing.
- `GET /members/me/visibility` incluindo `marketingEmailOptIn` e `marketingSuppressed`; `PATCH /members/me/marketing-consent` atualizando consentimento pelo titular, exigindo `confirmReactivation: true` quando suprimido por `unsubscribe`, e bloqueio `403` em `PATCH /admin/members/:id` ao tentar alterar `marketingEmailOptIn`.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/campaigns/email-campaigns.migration.spec.ts src/audit/audit-category.spec.ts src/members/members.service.spec.ts`
Expected: arquivos/métodos inexistentes.

- [x] **Step 3: Implementar entidades, migration 048, actions de governança, consentimento e bump 0.27.0**

Criar entidades TypeORM, migration 048 reversível, actions de auditoria e endpoints de consentimento do titular. Atualizar versão do backend para `0.27.0`.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/campaigns/email-campaigns.migration.spec.ts src/audit/audit-category.spec.ts src/members/ && npm run build`
Expected: todos os testes verdes e build limpo.

```bash
git add backend && git commit -m "feat(campanhas): adiciona migration 048 e consentimento promocional"
```

---

### Task 2: Resolução de segmentos, prévia congelada, descadastro e CRUD de campanhas

**Files:**
- Create: `backend/src/campaigns/dto/campaign.dto.ts`
- Create: `backend/src/campaigns/campaigns.service.ts`
- Create: `backend/src/campaigns/campaigns.controller.ts`
- Create: `backend/src/campaigns/campaigns.module.ts`
- Create: `backend/src/campaigns/campaigns.service.spec.ts`
- Create: `backend/src/campaigns/campaigns.controller.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- `GET/POST /campaigns` (`admin` escreve; `admin` e `finance-analyzer` leem com `{data,total,page,totalPages,limit}`).
- `GET/PATCH /campaigns/:id` (para `finance-analyzer`, oculta `name`/`email`/`handle` de recipients).
- `POST /campaigns/:id/preview` (resolve segmento parametrizado, aplica `email_suppressions` antes do segmento, deduplica por `emailNormalized`, congela recipients sem duplicar em re-execução e retorna exclusões por motivo + preview renderizado).
- `GET /campaigns/unsubscribe?token=...` e `GET /descadastro?token=...` (valida hash SHA-256 sem login, registra supressão `unsubscribe`, desativa `marketingEmailOptIn` e responde mensagem neutra em token inválido/expirado sem expor e-mail).
- `GET/POST/DELETE /campaigns/suppressions` (admin cria supressões manuais/complaint/bounce; proibido remover `source = 'unsubscribe'`).

- [x] **Step 1: Escrever testes RED de segmentos, prévia, supressões e descadastro**

Testar:
- `all_opted_in_members`, `role`, `designation`, `community_governance` (excluindo membros sem vínculo explícito ou com designation/diretoria inativa) e `manual` (exigindo `consentEvidence` e opt-in em campanhas promocionais, e e-mail verificado em `secondaryEmails`).
- Precedência de `email_suppressions` sobre qualquer segmento e sobre `marketingEmailOptIn = true`.
- Deduplicação por `emailNormalized`, contagens de exclusão por motivo (`suppressed`, `inactive_role`, `invalid_email`, `no_opt_in`, `duplicate`) e idempotência ao reprocessar `preview`.
- Idempotência de criação por `idempotencyKey`, restrição de PII para `finance-analyzer`, e descadastro por token hash sem vazar dados.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/campaigns/campaigns.service.spec.ts src/campaigns/campaigns.controller.spec.ts`
Expected: módulo/serviço inexistentes.

- [x] **Step 3: Implementar DTOs, resolução de segmentos, preview, descadastro e CRUD**

Implementar `CampaignsService` e `CampaignsController` com validação estrita e auditoria de governança.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/campaigns/ && npm run build`
Expected: todos verdes.

```bash
git add backend && git commit -m "feat(campanhas): resolve segmentos, previa congelada e descadastro"
```

---

### Task 3: Envio de teste, confirmação, fila persistente (`SKIP LOCKED`), retries, cancelamento e retenção

**Files:**
- Modify: `backend/src/notifications/email-template.service.ts`
- Modify: `backend/src/notifications/email-template.service.spec.ts`
- Modify: `backend/src/notifications/email.service.ts`
- Modify: `backend/src/notifications/email.service.spec.ts`
- Modify: `backend/src/campaigns/campaigns.service.ts`
- Modify: `backend/src/campaigns/campaigns.controller.ts`
- Modify: `backend/src/campaigns/campaigns.service.spec.ts`
- Modify: `backend/src/campaigns/campaigns.controller.spec.ts`

**Interfaces:**
- `POST /campaigns/:id/test`: envia teste somente para `req.user.email`.
- `POST /campaigns/:id/confirm`: exige `status === 'preview'` e `pending > 0`; grava `confirmedById` e `confirmedAt`; agenda (`scheduled`) ou inicia (`sending`).
- `POST /campaigns/:id/cancel`: cancela sem apagar logs anteriores e impede novos envios.
- `POST /campaigns/:id/recipients/:recipientId/retry`: agenda nova tentativa apenas para o recipient `failed`/`skipped` escolhido (`409` se `sent` ou `suppressed`).
- Worker `@Cron('*/10 * * * * *') processCampaignQueue()`: recupera `sending` estagnado (> 2 min), ativa `scheduled` vencidas, recarrega autorização admin de `confirmedById`, reclama lotes pequenos com `FOR UPDATE SKIP LOCKED` liberando lock da linha antes do SMTP, usa `EmailService.sendCampaignEmail` (advisory lock global + `EMAIL_SEND_INTERVAL_MS`), aplica backoff de 1 e 5 min (máx. 3 tentativas) e pausa global de 15 min em erros 421/454, finaliza em `completed` ou `completed_with_errors` (ou `failed` se SMTP ausente).
- Cron de retenção (365 dias): remove `email`, `name`, `emailNormalized` e `unsubscribeTokenHash` de `email_campaign_recipients` com mais de 365 dias, preservando contagens e trilha mínima.

- [x] **Step 1: Escrever testes RED da fila, serialização, retries, cancelamento e retenção**

Cobrir:
- Renderização Markdown segura sem `<script>` ou `<img>` e rodapé automático de descadastro em campanhas promocionais.
- Sanitização de erros operacionais (sem stack trace, credenciais SMTP ou token).
- Claim `FOR UPDATE SKIP LOCKED`, recuperação de `sending` > 2 min, recarga do ator confirmador, backoff 1m/5m, limite de 3 tentativas, pausa de 15m em 421/454, falha operacional com SMTP ausente sem apagar campanha.
- Retry manual individual (`409` para `sent`), cancelamento preservando logs e anonimização após 365 dias.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/notifications/ src/campaigns/`
Expected: novos testes falhando.

- [x] **Step 3: Implementar renderização de campanha, envio no EmailService, worker e retenção**

Integrar `EmailTemplateService.renderCampaignMarkdown`, `EmailService.sendCampaignEmail`, worker de campanhas e limpeza de 365 dias.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/notifications/ src/campaigns/ && npm run build`
Expected: todos verdes.

```bash
git add backend && git commit -m "feat(campanhas): processa fila persistente com retries e retencao"
```

---

### Task 4: Filtros avançados e exportação CSV em `/notifications/emails` + proxy allow-list

**Files:**
- Modify: `backend/src/notifications/email.service.ts`
- Modify: `backend/src/notifications/notifications.controller.ts`
- Modify: `backend/src/notifications/email.service.spec.ts`
- Modify: `backend/src/notifications/notifications.controller.spec.ts`
- Modify: `frontend/src/lib/api-proxy-paths.ts`
- Modify: `frontend/src/lib/api-proxy-paths.test.ts`

**Interfaces:**
- `GET /notifications/emails`: suporta `status`, `template`, `recipient`, `from`, `to`, `campaignId`, `page`, `pageSize`/`limit`; permite `admin` e `finance-analyzer` (mascarando/omitindo `to` para `finance-analyzer` e impedindo busca por PII de e-mail para não-admin).
- `GET /notifications/emails/export`: exporta CSV UTF-8 BOM (`toCsv`) com os filtros aplicados, contendo apenas campos autorizados ao perfil.
- `api-proxy-paths.ts`: adiciona `"/campaigns/"` em `API_PREFIXES`, mantendo `/descadastro` como rota estática.

- [x] **Step 1: Escrever testes RED de filtros de logs, exportação CSV e proxy**

Cobrir filtros por destinatário, período (`from`/`to`), campanha (`campaignId`), paginação, restrição de PII para `finance-analyzer`, CSV export e roteamento no proxy.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/notifications/ && cd ../frontend && npx vitest run src/lib/api-proxy-paths.test.ts`
Expected: falhas nos novos contratos.

- [x] **Step 3: Implementar filtros, exportação CSV e entrada `/campaigns/` no proxy**

Estender `EmailService.listLogs`, `EmailService.exportLogsCsv`, `NotificationsController` e `api-proxy-paths.ts`.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/notifications/ && cd ../frontend && npx vitest run src/lib/api-proxy-paths.test.ts`
Expected: todos verdes.

```bash
git add backend frontend/src/lib/api-proxy-paths* && git commit -m "feat(emails): adiciona filtros avancados, exportacao CSV e proxy de campanhas"
```

---

### Task 5: Frontend `/descadastro`, "Meus dados" e `/admin/emails` (Campanhas, Logs e Templates)

**Files:**
- Create: `frontend/src/pages/descadastro.astro`
- Create: `frontend/src/components/islands/campaigns/UnsubscribeIsland.tsx`
- Create: `frontend/src/components/islands/campaigns/UnsubscribeIsland.test.tsx`
- Create: `frontend/src/components/islands/admin/emails/EmailsCampaignsTab.tsx`
- Create: `frontend/src/components/islands/admin/emails/__tests__/campaigns-tab.test.tsx`
- Modify: `frontend/src/lib/sitemap-filter.mjs`
- Modify: `frontend/src/components/islands/member/privacy/MyDataTab.tsx`
- Modify: `frontend/src/components/islands/member/privacy/MyDataTab.test.tsx`
- Modify: `frontend/src/components/islands/admin/emails/EmailsApp.tsx`
- Modify: `frontend/src/components/islands/admin/emails/__tests__/emails.test.tsx`

**Interfaces:**
- `/descadastro?token=...`: ilha React acessível (`role="status"`), chama `GET /campaigns/unsubscribe?token=...` sem login, apresenta confirmação ou mensagem neutra sem revelar e-mail nem pedir dados adicionais.
- `MyDataTab`: switch independente `marketingEmailOptIn` com explicação clara de que não afeta e-mails transacionais, e confirmação explícita de reativação quando houver descadastro anterior.
- `/admin/emails`: abas **Campanhas**, **Logs** e **Templates** (acessível a `admin` e, em modo leitura nas abas Campanhas/Logs, a `finance-analyzer`).
  - **Campanhas**: jornada conteúdo → público → prévia/teste → confirmação → acompanhamento (`<progress>`, `role="status"`/`aria-live="polite"`, polling a cada 5s apenas com `document.visibilityState === "visible"` e sem requests concorrentes, cancelamento e retry por recipient).
  - **Logs**: filtros por destinatário, período (`from`/`to`), status, template e campanha, paginação e botão de exportar CSV.

- [x] **Step 1: Consultar `modern-web-guidance` e escrever testes RED**

Executar `modern-web-guidance` para forms/tabs/dialogs/accessibility. Escrever testes cobrindo `/descadastro` (token válido, inválido/expirado, ausente), `MyDataTab` (opt-in promocional independente e reativação), `EmailsCampaignsTab` (jornada completa, prévia com exclusões, teste, confirmação, polling visível sem concorrência, cancelamento e retry) e `EmailsApp` (novos filtros e exportação CSV).

- [x] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/campaigns src/components/islands/member/privacy src/components/islands/admin/emails`
Expected: componentes/comportamentos novos ausentes.

- [x] **Step 3: Implementar páginas e ilhas**

Usar tokens `--cq-*` e tema MUI, sem hex solto, preservando acessibilidade por teclado e dark mode.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/campaigns src/components/islands/member/privacy src/components/islands/admin/emails && npm run check`
Expected: zero erros de tipos e todos os testes verdes.

```bash
git add frontend && git commit -m "feat(frontend): adiciona descadastro, opt-in promocional e gestao de campanhas"
```

---

### Task 6: Privacidade, ADR 018, E2E PostgreSQL real, revisão independente e gates

**Files:**
- Create: `docs/adrs/018-email-campaigns.md`
- Create: `backend/test/email-campaigns.e2e-spec.ts`
- Modify: `frontend/src/pages/sobre/privacidade.astro`
- Modify: `docs/modules/privacy/treatments.md`
- Modify: `docs/README.md`
- Modify: `docs/plans/codaqui-1-0/README.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Atualizar página de privacidade, inventário de tratamentos e ADR 018**

Registrar finalidade (`transactional` vs `promotional`), base legal, segmentos, operadores, retenção de 365 dias com anonimização de recipients, preservação de supressões e canal de revogação (`/descadastro` e "Meus dados"). Documentar a decisão arquitetural em `docs/adrs/018-email-campaigns.md`.

- [x] **Step 2: Implementar e rodar E2E PostgreSQL real + migration 048 down/up em dump real**

Em `backend/test/email-campaigns.e2e-spec.ts`, validar contra PostgreSQL real:
1. Segmentos (`all_opted_in_members`, `role`, `designation`, `community_governance` sem membros sem vínculo explícito, `manual`), opt-in independente, supressão, deduplicação, retenção e anonimização (>365 dias).
2. Dois workers/DataSources concorrentes processando a mesma campanha sem envio duplicado para o mesmo recipient.
3. Advisory lock global e intervalo `EMAIL_SEND_INTERVAL_MS` compartilhados entre campanhas e demais fluxos do `EmailService`.
4. Retry manual sem reenviar `sent`; mesma `idempotencyKey` sem duplicar campanha; cancelamento, agendamento e pausa de 15 minutos em erro 421/454.
5. Descadastro impedindo campanha promocional posterior, inclusive após tentativa de reativação indevida pelo admin (403 na API e bloqueio por `email_suppressions` mesmo com `marketingEmailOptIn = true` no banco), e reativação explícita pelo próprio titular.
6. Migration 048 `down`/`up` em dump real preservando campanhas e logs históricos sem reprocessamento automático.

- [x] **Step 3: Executar todos os gates obrigatórios**

```bash
cd backend && npm run build && npx jest --silent
cd backend && DB_NAME=operations_patch_test NODE_ENV=test npm run test:e2e -- --runInBand test/email-campaigns.e2e-spec.ts
cd frontend && npm run check && npm run test
npm run test:scripts
make astro-verify
make astro-verify-tenants
```

- [x] **Step 4: Realizar revisão independente da branch via subagente e tratar apontamentos**

Invocar subagente revisor independente para inspecionar o diff completo da branch contra a spec E3, corrigir qualquer achado e reexecutar os gates antes do handoff para merge.

