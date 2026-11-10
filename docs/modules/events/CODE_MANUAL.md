<!-- AGENT-INDEX
purpose: Manual prático do código para futuros agents trabalharem em eventos, horas, ownership e guests.
audience: AI agents, mantenedores
sections:
  - Onde vive cada funcionalidade
  - Fluxos principais (criar evento, vender ingresso, check-in em lote, certificado independente, reconciliação de quota)
  - Certificação desacoplada, CSV com presença/concessão e convites guest externos
  - Páginas estáticas por evento (SEO/OG)
  - Horas, ownership, guests, declarações e badges
  - E1 — e-mails skipped/resend/summary
  - R1 — filtros e exportação CSV server-side
  - G6, Turnstile e classificação informativa 18+
  - Convenções, testes e debug
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ./ROLES.md — mapa de papéis
  - ../../adrs/001-event-platform.md — plataforma de eventos
  - ../../adrs/013-hour-ledger.md — horas, ownership, guests e badges
-->

# Manual do Código — Módulo de Eventos

## 1. Onde vive cada funcionalidade

### Backend (`backend/src/`)

| Funcionalidade | Arquivo(s) principais |
|----------------|-----------------------|
| Entidades (eventos, ingressos, orders, registrations, staff, ativações) | `events/entities/*.entity.ts` |
| Regras de negócio + permissões | `events/events.service.ts` |
| Endpoints HTTP | `events/events.controller.ts` |
| Ledger de horas e declarações | `hours/hours.service.ts`, `hours/hours.controller.ts`, `hours/entities/` |
| Carga e crédito no check-in | `hours/event-hours.ts`, `hours/hours.service.ts`, `events/events.service.ts` |
| Webhook Stripe para ingressos | `stripe/stripe.service.ts` (`handleEventTicketCheckoutCompleted`) |
| Ledger financeira / transparência | `ledger/ledger.service.ts`, `ledger/ledger.controller.ts` |
| E-mails transacionais | `notifications/email.service.ts` |
| Overrides de eventos (persistidos no PostgreSQL) | `events/event-overrides.service.ts`, `events/event-overrides.controller.ts` |
| GitHub-as-Database (apenas snapshots internal:codaqui) | `github-db/github-db.service.ts` |
| Ownership canônico + dual-write legado | `event-organizer/event-organizer-ownership.service.ts`, `event-organizer/ownership-reconciliation.ts` |
| Match de participantes CSV | `events/events.service.ts` (`importParticipants`, `findMemberByIdentifier`) |
| Reembolsos vinculados a evento | `reimbursements/reimbursements.service.ts`, `events/events.service.ts` |
| Papéis e permissões | `members/entities/member.entity.ts`, `auth/guards/roles.guard.ts` |

### Frontend (`frontend/src/`)

| Funcionalidade | Arquivo(s) principais |
|----------------|-----------------------|
| Listagem pública de eventos | `pages/eventos/index.astro`, `lib/events.ts`, `lib/events-api.ts` |
| Detalhe do evento | `pages/eventos/detalhe.astro` (redirect para a estática) + `pages/eventos/[...path].astro` (página estática SEO/OG por evento) |
| Convite e claim guest | `pages/eventos/convite.astro`, `components/islands/events/GuestClaimIsland.tsx` |
| Hub admin de eventos | `pages/admin/eventos.astro` (`components/islands/admin/eventos/EventosAdminApp.tsx`) |
| Check-in | `pages/admin/eventos-checkin.astro` (`components/islands/admin/checkin/CheckinApp.tsx`) |
| Perfil do membro (inscrições/certificados) | `pages/membro/index.astro` (`components/islands/member/`) |
| Horas do membro e declaração | `pages/membro/horas.astro`, `components/islands/member/hours/MemberHoursApp.tsx` |
| Aprovação de horas | `pages/admin/horas.astro`, `components/islands/admin/hours/HoursApprovalsApp.tsx` |
| Perfil público, horas, timeline e selo | `pages/membros/perfil.astro`, `pages/[...handle].astro`, `components/islands/member/profile/` |
| Overrides e ativações | `pages/admin/overrides.astro` (`components/islands/admin/overrides/`) |
| Componente de pedidos | `components/islands/admin/events/EventOrdersDialog.tsx` |
| Componente de lançar despesa de evento | `components/islands/admin/events/EventReimbursementDialog.tsx` |
| Checkout embedded de ingressos | `components/islands/EventRegistrationIsland.tsx` + `components/islands/StripeCheckoutDialog.tsx` |
| Categorização de transações | `lib/transaction.ts` |
| Termos de compra | `pages/termos-de-compra.astro` |

## 1.1 Mapa rápido de papéis

| Papel (role) | Onde é verificado | O que pode fazer no módulo de eventos |
|---|---|---|
| `admin` | `RolesGuard` | Tudo em todos os eventos; aprova/rejeita horas e reconcilia ownership. |
| `finance-analyzer` | `RolesGuard` + service de horas | Aprova/rejeita horas pendentes, sem acesso financeiro adicional por isso. |
| `event_organizer` | `EventsService.canManageAll`, `organizer @ event` | Criar/editar/publicar eventos próprios; criar overrides e ativar features em eventos externos que possui; gerenciar staff; ver relatórios; lançar despesas. |
| `event_finance` | `RolesGuard` | Aprovar reembolsos; ver relatórios financeiros; exportar pedidos. |
| `event_host` | `event_staff.staffRole === 'host'` | Editar próprio evento; ver inscritos/pedidos; check-in; certificados; convites guest; despesa. |
| `event_checker` | `event_staff.staffRole === 'checker'` | **Apenas** check-in (scanner + busca mínima). |
| `membro` | `JwtAuthGuard` | Comprar/reservar ingressos; ver próprias inscrições; emitir certificado e declaração de horas. |

> Para eventos externos, o organizer precisa da role global **e** de designation `organizer @ event` compatível com o scope. A tabela legada continua sem drop e em dual-write.
> Para eventos próprios, o organizer/admin usa `event_staff` para delegar `host`/`checker`.

## 2. Fluxos principais

### 2.1 Criar e publicar um evento próprio

1. `POST /events` (organizer/admin) → `ManagedEvent` status `draft`.
   Campos: `slug`, `title`, `summary` (texto curto), `description` (opcional,
   texto longo simples com quebras de linha, máx. 10000 chars), `imageUrl`,
   `location`, `startAt`/`endAt`, `timezone`, `communityProjectKey`, `capacity` e
   `workloadMinutes`. A criação exige carga explícita positiva ou duração válida;
   uma edição não pode deixar sem carga um evento que já a possuía.
   `description` vai junto no snapshot (`toEventItem`) e no detalhe público
   (`serializeEvent`) quando preenchida.
2. `POST /events/:id/ticket-types` → cria lotes.
3. `POST /events/:id/publish` → status `published`.
4. Snapshot: workflow horário ou `POST /events/internal/snapshot` gera arquivos em
   `static/events/internal/codaqui/` e abre PR auto-mergeado.

### 2.2 Vender um ingresso pago

1. Frontend `eventos/detalhe.astro` chama `POST /events/:id/checkout`.
2. Backend reserva quota (`reserveQuota`) e cria `EventOrder` `pending`.
3. Stripe Checkout Session é criada com metadata `entityType: event-ticket`.
4. Webhook `checkout.session.completed` marca order `paid`, gera registrations e
   registra no ledger financeiro (`event-ticket:<orderId>`).
5. Receita cai na conta da comunidade (`communityProjectKey`).

### 2.3 Check-in e horas automáticas

1. Participante vê QR em `/membro` (aba Eventos), no e-mail ou na página pública do convite guest após o claim.
2. Organizador acessa `/admin/eventos-checkin?event=<id>` e usa as abas **Escanear**, **Participantes** e **Certificados**. A lista tem filtros, seleção múltipla/todos os filtrados e cards responsivos; o scanner individual permanece disponível.
3. Scanner lê o token e chama `POST /events/:id/checkin` ou `POST /events/external/:eventKey/checkin`. Ações em lote usam `POST /events/:id/checkin/batch` ou `POST /events/external/:eventKey/checkin/batch` com até 100 tokens e resultado por inscrição.
4. Resposta idempotente: `checked_in`, `already_checked_in` ou `invalid` no lote. `pending_match`/`pending_guest` não passa no scanner.
5. Somente a transição atômica `checkedInAt null → valor` com `status=confirmed` pode gerar `event_checkin`, na mesma transação. Se o update perder a corrida, a releitura diferencia `already_checked_in` de cancelamento/outro estado recusado. O crédito exige `memberId` e carga válida, nasce `approved` e usa `INSERT ... ON CONFLICT DO NOTHING`: hora preexistente não aborta o check-in nem duplica. Guests sem conta não geram horas.
6. O CSV externo aceita `checkin` e `certificate` (`true/false` ou `1/0`). Presença importada também concede certificado; concessão isolada não gera horas. Reupload mantém dedupe e não recredita. O relatório inclui `checkedIn` e `certificatesGranted`.
7. A carga vem de `workloadMinutes`; managed events podem usar `endAt - startAt` como fallback. Externos usam o override persistido e exigem carga ao ativar check-in. Legados sem carga seguem o check-in com warning, sem crédito ou backfill.
8. Para corrigir importações, `DELETE /events/external/:eventKey/participants/:registrationId` exclui apenas participantes sem `orderId` e sem `checkedInAt`, decrementa `quantitySold` na mesma transação e libera reimportação. Presença e pedidos retornam 409 para preservar o histórico; `/admin/overrides` mostra confirmação e feedback.

### 2.4 Certificado

1. O check-in preenche `checkedInAt` e, se ausente, `certificateGrantedAt`. Organizer/admin também pode conceder sem presença em `POST /events/registrations/:id/certificate/grant`; update condicional preserva a primeira concessão.
2. Participante com concessão e status `confirmed` clica "Emitir certificado" em `/membro`; `GET /events/registrations/:id/certificate` e a verificação pública não dependem mais de `checkedInAt`.
3. Frontend renderiza cartão com QR para `/certificado/verificar?codigo=`. O código `CRT-<checkinToken>` permanece estável.
4. Para `pending_match`, a aba Certificados permite `POST /events/certificate-invites/batch`. O template `certificate-pending-registration` aponta para `/eventos/convite?token=...`; o aceite exige login GitHub e e-mail verificado via `POST /events/public/guest-claim/github`, que confirma e vincula a inscrição sem conceder certificado automaticamente. O guest claim comum responde 409 para esses convites. `certificateInvitedAt` só é gravado com `sent`, e cada tentativa gera `email_logs` (`sent/failed/skipped`).
5. Carga horária (`workloadMinutes`) vem do override (`extendData.workloadMinutes`) para eventos externos. Managed events usam `workloadMinutes` explícito ou, na ausência dele, `endAt - startAt`. Certificado isolado não exige carga nem cria horas.

### 2.5 Lançar despesa/reembolso vinculado a evento

1. Organizador/admin clica "Lançar despesa" na página `/admin/eventos` (evento próprio) ou
   na aba de ativação de `/admin/overrides` (evento externo).
2. Frontend abre `<EventReimbursementDialog>`, que busca contas em
   `GET /ledger/community-balances` e pré-seleciona a conta da comunidade do evento.
3. `POST /events/:id/reimbursements` (próprio) ou `POST /events/external/:eventKey/reimbursements`
   (externo) cria um `ReimbursementRequest` vinculado ao evento.
4. Após aprovação (`finance-analyzer`/admin), o pagamento registra no ledger com
   `referenceId: reimbursement:<id>:<ts>` e `eventMetadata` descrevendo o evento.
5. A transação aparece na transparência geral filtrada pela comunidade.

### 2.6 Overrides de metadados (novo: API REST + PostgreSQL)

1. Organizer/admin edita metadados em `/admin/overrides`.
2. Frontend chama `POST /events/overrides` (criar) ou `PUT /events/overrides/:id`
   (atualizar) enviando `sourceKey`, `eventId`, `payload.extendData`, `reason` e
   `ownerMemberId`.
3. `EventOverridesService` persiste na tabela `event_override` com audit
   (`createdBy`, `updatedBy`, timestamps).
4. `scripts/sync-events.mjs` consome `GET /events/overrides/public`, aplica
   `payload.extendData` nos eventos e marca `hasOverride: true`.
5. Páginas públicas (`/eventos`, `/eventos/detalhe`) leem o snapshot já mesclado;
   não fazem mais fetch de `overrides-index.json`.

### 2.7 Checkout embedded de ingressos

1. Na página pública de detalhe (`/eventos/detalhe`), usuário escolhe lote e clica
   "Comprar ingresso".
2. Frontend chama `POST /events/:id/checkout` (ou `/events/external/:eventKey/checkout`)
   com `uiMode: 'embedded'`.
3. Backend reserva quota, cria `EventOrder` `pending` e devolve `clientSecret` do Stripe.
4. `<StripeEmbeddedCheckoutDialog>` monta o Stripe Embedded Checkout dentro da página da
   Codaqui (não redireciona para fora).
5. Após pagamento, Stripe redireciona de volta para a mesma página do evento
   (`/eventos/detalhe?source=...&id=...`), onde o webhook já terá processado a order.
6. Fallback: se o frontend não conseguir usar embedded, `uiMode: 'hosted'` devolve `url` e
   redireciona para a página hospedada do Stripe.

### 2.8 Páginas estáticas por evento (SEO/OG)

Crawlers de preview (WhatsApp, LinkedIn, Twitter) não executam JS, então a
página `/eventos/detalhe?source=...&id=...` (client-side) gerava OG genérico.
Agora cada evento tem uma página estática gerada em build time:

1. A rota estática `src/pages/eventos/[...path].astro` (Astro) emite uma página
   por evento em build time via `getStaticPaths`: lê o snapshot
   (`loadEventsIndex()` → `static/events/index.json`, copiado para o app no
   prebuild) e mapeia cada evento em `params: { path: eventRouteParam(event) }`
   com o `EventSummary` inteiro em `props` (zero fetch no render).
2. URL canônica: `/eventos/<slug>` para eventos internos (slug única da
   `managed_events`, montada por `buildEventSlugPath`) e
   `/eventos/<source>/<sourceId>/<id>` para externos e internos legados sem
   slug (`buildEventPath`). Ambas vivem em `src/lib/event-path.ts` (cada
   segmento passa por `encodeURIComponent`); `buildEventPublicPath` escolhe o
   formato pela regra `source === "internal" && slug`. Slugs que colidirem com
   páginas estáticas de `src/pages/eventos/` (`detalhe`, `comprovante`) e
   colisões de path são logadas e o evento é pulado.
3. O template da rota estática recebe OG/JSON-LD pelo `PublicLayout`
   (`og:title/description/image/url`, `twitter:card=summary_large_image`,
   canonical e JSON-LD `schema.org/Event` via helper puro `buildEventJsonLd` em
   `src/lib/event-path.ts`) e renderiza o conteúdo do evento server-side, com
   `<EventRegistrationIsland>` para inscrição/checkout dos eventos internos.
4. A URL legada com query continua existindo: `src/pages/eventos/detalhe.astro`
   roda um script inline que resolve o caminho público do evento em
   `/events/index.json` (mesma regra de `buildEventPublicPath`) e redireciona
   para a rota estática — sem `status`/`session_id` e com params válidos, o
   redirect acontece **se a página existir no snapshot do build** (evento interno
   recém-publicado, ainda sem sync/build, cai no aviso "tente novamente em
   instantes"). O retorno do Stripe (`status=success&session_id=...`) **preserva
   os params** ao ir para a rota estática (a ilha de inscrição exibe a
   confirmação inline) — as URLs de retorno do checkout
   (`buildEventReturnPath` em `events.service.ts`) permanecem com query.
5. Todos os geradores de link usam `buildEventPublicPath`: listagem `/eventos`
   (`EventCard.astro`), `pages/membros/perfil`, `MemberProfileIsland`,
   aba Eventos do dashboard (`member/dashboard/EventsTab.tsx`),
   `TransactionDetailDialog`, seções "Próximos eventos" das comunidades
   (CamposTech/DevParaná) e o `href` do snapshot interno no backend
   (`toEventItem` em `events.service.ts`). `pages/admin/eventos` linka direto
   pela slug (`buildEventSlugPath`), pois tem o `ManagedEvent` completo.

### 2.9 RSVP gratuito, reconciliação de quota e organizers

1. RSVP gratuito (`register`) e cancelamento (`cancelRegistration`) executam
   reserva/liberação de quota e o save da registration **na mesma transação**
   (`registrationRepo.manager.transaction`), eliminando drifts de
   `quantitySold` por falhas intermediárias.
2. Se houver drift histórico, `POST /events/:id/reconcile-quota`
   (`event_organizer | admin`) rederiva `quantitySold` de cada lote
   (registrations `confirmed` + orders `pending`) e corrige, com audit
   (`event.quota_reconciled`). Idempotente.
3. Os payloads públicos (`getPublicManagedEvents` e `getPublicManagedEvent`)
   incluem `organizers: [{ name, id, photoUrl? }]` (staff HOST → nome, handle
   GitHub e avatar do membro; **nunca e-mail**), carregados com 2 queries (sem
   N+1). O campo é omitido quando o evento não tem hosts.

### 2.10 E-mails operacionais (E1)

1. `EmailService.sendTemplate` registra `skipped` + `SMTP_NOT_CONFIGURED` quando o provider
   não está configurado; esse estado não conta como `failed` e não impede a operação principal.
2. `GET /notifications/status` informa `configured`; `GET /notifications/emails` aceita
   `status`, `template`, `page` e `pageSize`, retornando `items`, `total` e `summary` com
   `sent`, `failed`, `skipped` e agregação por template.
3. `POST /notifications/emails/:id/resend` exige SMTP configurado e log ligado a uma inscrição.
   Reenvio atualiza o mesmo registro e seu timestamp; com SMTP desligado responde 409.
4. Apenas `sent` e `failed` deduplicam os crons, permitindo que um `skipped` seja entregue após
   configurar SMTP. Logs de e-mail expiram após 365 dias. O template
   `event-registration-cancelled` usa o contexto real da inscrição/evento.

### 2.11 Filtros e CSV de transações (R1)

1. `GetTransactionsQueryDto` aceita `from`/`to` ISO além dos filtros anteriores; `from > to` é
   inválido e `to` inclui o dia inteiro. Listagem e exportação usam o mesmo `TransactionFilters`.
2. `GET /ledger/accounts/:id/transactions/export` exporta publicamente as transações visíveis
   da conta. `GET /ledger/transactions/export` exporta todas as contas para admin ou
   finance-analyzer. Ambos exportam o range inteiro, não a página corrente.
3. `src/common/csv.ts` produz UTF-8 com BOM, CRLF e campos citados. Valores iniciados por
   fórmula ou caracteres de controle recebem apóstrofo antes da serialização. No frontend,
   `DateRangeControls` e `TransactionTable` reutilizam os mesmos filtros na URL server-side.

### 2.12 Retenção, Turnstile e classificação 18+

- **G6:** `auditCategory()` classifica cada ação como `governance` ou `operational`.
  `GET/PUT /settings/audit-retention` lê/configura 7–365 dias (admin), com precedência sobre
  `AUDIT_OPERATIONAL_RETENTION_DAYS`. `POST /audit/cleanup`, o cron diário e a limpeza no
  startup removem somente operacionais expirados; governo é permanente e tem `ipAddress=null`.
- **Turnstile:** `src/common/turnstile/` e `TurnstileField.tsx` validam `success`, hostname
  exato e ação `guest_claim`, aplicam timeout de 5 s e cache anti-reuso de token por 5 min.
  Desde a Fase 2, `POST /events/public/guest-claim` usa `TurnstileGuard`; produção sem secret
  falha fechada. O widget só renderiza com `PUBLIC_TURNSTILE_SITE_KEY`, alimentada por
  `TURNSTILE_SITE_KEY` ou pelo alias público, e é resetado após recusa para permitir retry.
  `TURNSTILE_SECRET`/`TURNSTILE_HOSTNAMES` são canônicos; `TURNSTILE_SECRET_KEY` e
  `TURNSTILE_ALLOWED_HOSTNAMES` permanecem como fallback legado. O token `development` existe
  apenas no ambiente de desenvolvimento previsto.
- **ECA:** `ManagedEvent.adultOnly` e `venueType` chegam ao snapshot por `toEventItem`.
  Overrides externos aceitam `payload.adultOnly` boolean. `adult-content.ts` apenas sugere
  18+ para bar/restaurante às 18h ou depois; não salva automaticamente. `EventCard.astro` e
  `AdultContentNotice.astro` mostram badge/aviso estático sem bloquear inscrição ou indexação.
  Mudança pós-publicação de `adultOnly` registra antes/depois em auditoria de governo.

### 2.13 Horas e declarações

`hour_ledger` é separada da ledger financeira: horas decimais, sem contas, BRL ou double-entry. As fontes são `event_checkin`, `directorate_activity`, `extension_project` e `mentorship_session`. Lançamentos manuais ficam pendentes e usam `(memberId,idempotencyKey)` para deduplicar; sessões concluídas criam uma entrada pendente única por membro/tipo/sessão com `hours = durationMin / 60`. Aprovação/rejeição exige admin ou `finance-analyzer`, faz update condicional de `pending` e grava audit de governo.

| API | Uso corrente |
|---|---|
| `POST /hours` | Admin ou diretor da diretoria em `sourceId`; somente `directorate_activity`, para si e com `idempotencyKey`. |
| `GET /hours/pending?page&limit` | Fila admin/finance-analyzer; envelope `{data,total,page,totalPages,limit}`, default 50, cap 100. |
| `POST /hours/:id/approve` / `POST /hours/:id/reject` | Revisa uma entrada pendente; rejeição exige motivo. |
| `GET /hours/me` | Até 100 lançamentos recentes do próprio membro. |
| `GET /hours/me/summary` | Soma **todas** as horas aprovadas do próprio membro, sem o limite do extrato. |
| `GET /hours/members/:memberId/statement?from&to` | Somente o próprio membro; grava snapshot de aprovadas, com `to` incluindo o dia inteiro. |
| `GET /hours/verify/:code` | Verifica `HRS-<uuid>` sem expor nome; com horas ocultas ou membro inativo retorna somente `{valid:false}`. |
| `GET /hours/members/:memberId/summary` | Total e até 50 entradas aprovadas quando `hours=true`; caso contrário, zero e lista vazia. |
| `GET /hours/public` | Totais aprovados e permissões de selo; `totalHours` e `joinedAt` só aparecem com suas chaves de visibilidade. |

A declaração em `/membro/horas` usa o snapshot persistido, não muda com lançamentos posteriores e **não tem prazo de validade**. A impressão/PDF é nativa do navegador, sem biblioteca nova. `/admin/horas` implementa a fila com `PaginationControls`; ambas as páginas são noindex e as APIs ficam fora do prefixo `/admin/`.

### 2.14 Ownership e reconciliação sem drop

- `GET /events/organizers` preserva o shape `OrganizersFile`, mas lê designations ativas `organizer @ event`, resolvendo `targetId` pela ativação ou usando `targetKey` para wildcard/não ativado.
- Upsert/remoção pelos endpoints existentes atualiza `event_organizer_ownerships` e somente as designations de organizer do membro na mesma transação. Outras designations não são revogadas.
- `POST /events/organizers/reconcile` (admin) repete o seed da migration 034 e retorna `{inserted,alreadyPresent,orphanedActivations}`. Só encerra `targetKey` quando o par `memberId + scope` está no legado e ganhou activation; canonical-only não é revogado. `orphanedActivations` conta designations ativas por `targetId` sem o par correspondente `memberId + activation.eventKey` no legado, como divergência informativa, sem revogar.
- A migration 034 não faz drop da tabela antiga e seu `down` é não destrutivo. A 035 valida os dados e adiciona CHECK de identidade: nome/e-mail são obrigatórios para não-guests e guests vinculados; `pending_guest` e guests sem `memberId` podem ter nulos para convite/anonimização. O índice de vínculo é `(isGuest,lower(attendeeEmail))`. O `down` da 035 remove guests antes de restaurar `attendeeName/Email` obrigatórios; rollback em produção exige avaliação de dados.

### 2.15 Convites guest, vínculo e retenção

1. `POST /events/:id/guest-invites` exige actor que pode editar o evento, managed event publicado/gratuito e lote gratuito ativo. Retorna token e `/eventos/convite?token=<uuid>`; o admin também mostra o QR do convite.
2. `GET /events/public/guest-invites/:token` retorna somente projeção mínima. Antes do claim não devolve QR nem nome/e-mail; depois, devolve e-mail mascarado e token para check-in. `requiresAccount` identifica convites de certificado, inclusive já confirmados.
3. `POST /events/public/guest-claim` valida consentimento e Turnstile somente para convites comuns. A transação bloqueia o evento, confere capacidade, reserva quota e faz update condicional `pending_guest → confirmed`; segunda tentativa responde 409. Para convites com `certificateInvitedAt`, a rota responde 409 exigindo GitHub. `pending_guest` não passa no check-in.
4. `/eventos/convite` é noindex e reutiliza `GuestClaimIsland`; confirmação e D-1 apontam para essa página quando `isGuest=true`.
5. No próximo `upsertByGithub`, somente e-mails verificados vindos de `GET /user/emails` podem vincular. Se o membro já tiver inscrição confirmada no evento, o guest vira `cancelled`, devolve quota uma única vez e grava audit. Não há horas retroativas nem escrita financeira.
6. O cron diário das 03:00 anonimiza nome/e-mail de guests sem `memberId` quando `managed_events.startAt` ou `external_event_activations.startAt` é anterior a 365 dias. Token, consentimento, concessão e presença permanecem; registros vinculados não entram no job.
7. `POST /events/certificate-invites/batch` responde **202** e cria jobs em `certificate_invite_jobs`; não envia mais emails em `Promise.all`. O worker processa um job a cada 10 segundos com `FOR UPDATE SKIP LOCKED`, repete a autorização e reutiliza a mesma jornada autenticada. `certificateInvitedAt` só é preenchido com envio `sent`; um log `sent` preexistente sem essa marcação é reconciliado pela data do log e impede reenvio.
8. `POST /events/public/guest-claim/github` exige `JwtAuthGuard`, consentimento e correspondência do e-mail do convite com `secondaryEmails` verificados. A transação usa `pessimistic_write`, confirma e vincula a inscrição, aceita replay do mesmo membro e rejeita outra conta. Certificado, presença e concessão são preservados; nenhum deles é criado pelo claim.
9. O progresso fica em `GET /events/certificate-invites/batches/:batchId`, restrito ao admin/solicitante. `EmailService` serializa SMTP e aplica `EMAIL_SEND_INTERVAL_MS` (default 2000 ms em produção, 0 em testes). Falhas temporárias usam 1/5 minutos, terceira falha é definitiva e 421/454 pausa pendentes por 15 minutos. Não há reprocessamento automático de erros antigos nem exactly-once absoluto se o SMTP aceitar e a conexão falhar antes da confirmação.
10. As listagens aceitam `page`, `limit`, `search` e `certificateFilter`; com página+limite retornam o envelope compartilhado e sem eles preservam o array legado. A Central usa 25 por página, seleção somente da página atual e polling a cada 5 segundos somente quando a aba está visível.

### 2.16 Perfil público e badges

O perfil consulta `GET /hours/public` antes de buscar o extrato. Sem `totalHours` permitido, não renderiza horas nem timeline; não transforma campo oculto em zero visível. `badge=false` oculta o selo. `badge=true&hours=false` mantém o selo sem horas e `memberSince=false` remove somente o ano. Bio, roles, LinkedIn, eventos, certificados, doações e SortCoins continuam nas suas projeções existentes e não reaparecem por defaults dos componentes novos.

`scripts/sync-member-badges.mjs` (`npm run sync:badges`) gera `static/badges/<handle>.svg`: valida a resposta inteira, escapa XML, usa arquivo temporário + rename, apaga obsoletos só após sucesso e restaura o estado anterior se a escrita falhar. O workflow roda às 06:17 UTC e por dispatch; `frontend/scripts/copy-snapshots.mjs` copia os SVGs no build. Mudanças aparecem no próximo sync + build/publicação. Se o SVG ainda não existir, `ProfileBadges` oculta somente a área após erro de carga.

O primeiro sync contra o backend publicado deve concluir **antes** do deploy do frontend. Não é necessário gerar nem versionar SVGs de membros reais no branch de implementação.

### 2.17 Eventos vinculados a IES (Codaqui Universitário)

- `managed_events.institutionId` vincula um managed event comum a uma `entities` ativa do tipo `instituicao_ensino`. Não há evento, inscrição, certificado ou ledger paralelos.
- `POST /events` exige organizer/admin sem vínculo. Com `institutionId`, o service aceita organizer/admin, `manager @ program('universitario')` ou `ambassador @ ies` ativo e válido naquela IES; o controller não aplica uma role global antes dessa verificação.
- `/admin/universitario` oferece o atalho `/admin/eventos?institutionId=<uuid>`. O formulário lê o UUID somente quando ele pertence ao embaixador (ou quando o ator já gerencia eventos), não oferece troca de IES e mantém o valor no payload.
- Confirmação e rejeição de candidaturas chamam `DesignationsService.invalidateCache()`. Isso evita que o resultado negativo de `hasDesignation`, consultado antes da candidatura, bloqueie o primeiro evento por até 60 segundos após a posse.
- `GET /universities/public` e `static/universities/index.json` projetam somente cidades, IES, embaixadores ativos e eventos publicados. Motivação, e-mail e candidaturas não entram no snapshot. O E2E real está em `backend/test/universities.e2e-spec.ts`.

## 3. Convenções e anti-patterns

- **Sempre use `authFetch` em telas admin** — `fetch` direto não trata 401.
- **Permissões de evento:** verifique `events.service.ts` antes de adicionar novos
  endpoints; existem helpers `canManageAll`, `assertCanViewEvent`, `isStaff`.
- **Ledger financeira:** toda movimentação financeira usa `recordTransaction` com `referenceId`
  prefixado. Nunca crie conta manualmente — use `getOrCreateCommunityAccount`.
- **Horas:** nunca chame a ledger financeira, não faça backfill de check-ins/guests e não remova
  a unicidade de fonte ou a idempotency key. Novas fontes só entram com seus módulos/fases.
- **Migrations:** nomeie como `MigrationNNN_Descricao.ts` com timestamp crescente.
- **Frontend:** use MUI v9 Grid com `size={{ xs: 12 }}` (não `item xs={12}`).
- **Classificação 18+:** não transforme a heurística de formulário em bloqueio, coleta de
  idade/documento, `noindex` ou exclusão do sitemap.
- **Turnstile:** não aplique o guard a uma rota pública sem testar token, hostname, timeout,
  replay e o comportamento de produção sem secret.

## 4. Testes

```bash
# Backend
cd backend && npm run test

# Frontend
npm run test

# Typecheck (frontend)
npm run typecheck
```

## 5. Dicas de debug

- **Override não aparece:** verifique se `GET /events/overrides/public` retorna o registro
  (`sourceKey` + `eventId`), depois confira se `scripts/sync-events.mjs` aplicou o
  `payload.extendData` no snapshot e gerou `hasOverride: true`. O arquivo
  `overrides-index.json` foi removido — os overrides vivem agora na tabela
  `event_override` do PostgreSQL.
- **Ingresso pago não gera registration:** verifique logs do webhook Stripe e se
  `order.status` virou `paid`. Use `POST /events/orders/reconcile-ledger` para reprocessar.
- **Match CSV falha:** confira `members.secondaryEmails` e o método
  `findMemberByIdentifier` em `events.service.ts`.
- **Transação não aparece na transparência:** verifique `referenceId` e se o tipo está em
  `frontend/src/lib/transaction.ts` e no backend `ledger.service.ts`.
- **Checkout embedded não abre:** verifique se `STRIPE_PUBLISHABLE_KEY` está configurada e se
  `uiMode: 'embedded'` está sendo enviado no `CheckoutDto`.
- **Despesa de evento não aparece:** verifique se `ReimbursementRequest.eventId` ou
  `externalActivationId` foi preenchido e se o `referenceId` começa com `reimbursement:`.
- **Termos de compra versionados:** o texto canônico fica em `frontend/src/pages/termos-de-compra.astro`;
  o `termsVersion` aceito no backend é `2026-07-v1`.
- **Erro de DI no backend (`UnknownDependenciesException`):** adicione o teste em
  `events.module.spec.ts` e verifique se a assinatura do construtor de `EventsService` foi
  atualizada em todos os specs que instanciam o serviço diretamente.
- **Data/horário errado em eventos:** o backend interpreta strings `datetime-local` no
  timezone do evento (`parseDateTimeLocal` em `events.service.ts`). Verifique se o frontend
  envia `YYYY-MM-DDTHH:mm` e se `timezone` está preenchido.
