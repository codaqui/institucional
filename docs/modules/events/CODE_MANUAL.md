<!-- AGENT-INDEX
purpose: Manual prático do código para futuros agents trabalharem no módulo de eventos e áreas adjacentes.
audience: AI agents, mantenedores
sections:
  - Onde vive cada funcionalidade
  - Fluxos principais (criar evento, vender ingresso, check-in, certificado)
  - Convensões e anti-patterns
  - Testes
  - Dicas de debug
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ./ROLES.md — mapa de papéis
  - ../adrs/001-event-platform.md — decisões arquiteturais da plataforma de eventos
-->

# Manual do Código — Módulo de Eventos

## 1. Onde vive cada funcionalidade

### Backend (`backend/src/`)

| Funcionalidade | Arquivo(s) principais |
|----------------|-----------------------|
| Entidades (eventos, ingressos, orders, registrations, staff, ativações) | `events/entities/*.entity.ts` |
| Regras de negócio + permissões | `events/events.service.ts` |
| Endpoints HTTP | `events/events.controller.ts` |
| Webhook Stripe para ingressos | `stripe/stripe.service.ts` (`handleEventTicketCheckoutCompleted`) |
| Ledger / transparência | `ledger/ledger.service.ts`, `ledger/ledger.controller.ts` |
| E-mails transacionais | `notifications/email.service.ts` |
| Overrides de eventos (novo: persistidos no PostgreSQL) | `events/event-overrides.service.ts`, `events/event-overrides.controller.ts` |
| GitHub-as-Database (apenas snapshots internal:codaqui) | `github-db/github-db.service.ts` |
| Ownership de eventos externos (PostgreSQL) | `event-organizer/event-organizer-ownership.service.ts` |
| Match de participantes CSV | `events/events.service.ts` (`importParticipants`, `findMemberByIdentifier`) |
| Reembolsos vinculados a evento | `reimbursements/reimbursements.service.ts`, `events/events.service.ts` |
| Papéis e permissões | `members/entities/member.entity.ts`, `auth/guards/roles.guard.ts` |

### Frontend (`src/`)

| Funcionalidade | Arquivo(s) principais |
|----------------|-----------------------|
| Listagem pública de eventos | `pages/eventos.tsx`, `lib/events-api.ts` |
| Detalhe do evento | `pages/eventos/detalhe.tsx` |
| Hub admin de eventos | `pages/admin/eventos.tsx` |
| Check-in | `pages/admin/eventos-checkin.tsx` |
| Perfil do membro (inscrições/certificados) | `pages/membro/index.tsx` |
| Perfil público (histórico de eventos) | `pages/membros/perfil.tsx` |
| Overrides e ativações | `pages/admin/overrides.tsx` |
| Componente de pedidos | `components/EventOrdersDialog/index.tsx` |
| Componente de lançar despesa de evento | `components/EventReimbursementDialog/index.tsx` |
| Checkout embedded de ingressos | `components/StripeEmbeddedCheckoutDialog/index.tsx` |
| Categorização de transações | `utils/transaction.tsx` |
| Termos de compra | `pages/termos-de-compra.md` |

## 1.1 Mapa rápido de papéis

| Papel (role) | Onde é verificado | O que pode fazer no módulo de eventos |
|---|---|---|
| `admin` | `RolesGuard` | Tudo em todos os eventos. |
| `event_organizer` | `EventsService.canManageAll`, ownership em `event_organizer_ownership` | Criar/editar/publicar eventos próprios; criar overrides de eventos externos que possui; ativar features em eventos externos que possui; gerenciar staff de eventos próprios; ver relatórios; lançar despesas. |
| `event_finance` | `RolesGuard` | Aprovar reembolsos; ver relatórios financeiros; exportar pedidos. |
| `event_host` | `event_staff.staffRole === 'host'` | Editar próprio evento; ver inscritos/pedidos; check-in; certificados; despesa. |
| `event_checker` | `event_staff.staffRole === 'checker'` | **Apenas** check-in (scanner + busca mínima). |
| `membro` | `JwtAuthGuard` | Comprar/reservar ingressos; ver próprias inscrições; emitir certificado. |

> Para eventos externos, o organizer precisa de **ownership** (`event_organizer_ownership`) além do role.
> Para eventos próprios, o organizer/admin usa `event_staff` para delegar `host`/`checker`.

## 2. Fluxos principais

### 2.1 Criar e publicar um evento próprio

1. `POST /events` (organizer/admin) → `ManagedEvent` status `draft`.
2. `POST /events/:id/ticket-types` → cria lotes.
3. `POST /events/:id/publish` → status `published`.
4. Snapshot: workflow horário ou `POST /events/internal/snapshot` gera arquivos em
   `static/events/internal/codaqui/` e abre PR auto-mergeado.

### 2.2 Vender um ingresso pago

1. Frontend `eventos/detalhe.tsx` chama `POST /events/:id/checkout`.
2. Backend reserva quota (`reserveQuota`) e cria `EventOrder` `pending`.
3. Stripe Checkout Session é criada com metadata `entityType: event-ticket`.
4. Webhook `checkout.session.completed` marca order `paid`, gera registrations e
   registra no ledger (`event-ticket:<orderId>`).
5. Receita cai na conta da comunidade (`communityProjectKey`).

### 2.3 Check-in

1. Participante vê QR em `/membro` (aba Eventos) ou no e-mail.
2. Organizador acessa `/admin/eventos-checkin?event=<id>`.
3. Scanner lê o token e chama `POST /events/:id/checkin`.
4. Resposta idempotente: `checked_in` ou `already_checked_in`.

### 2.4 Certificado

1. Após check-in, participante clica "Emitir certificado" em `/membro`.
2. `GET /events/registrations/:id/certificate` retorna dados.
3. Frontend renderiza cartão com QR para `/certificado/verificar?codigo=`.
4. Carga horária (`workloadMinutes`) vem do override (`extendData.workloadMinutes`) para
   eventos externos, ou de `endAt - startAt` para eventos internos.

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

## 3. Convenções e anti-patterns

- **Sempre use `authFetch` em telas admin** — `fetch` direto não trata 401.
- **Permissões de evento:** verifique `events.service.ts` antes de adicionar novos
  endpoints; existem helpers `canManageAll`, `assertCanViewEvent`, `isStaff`.
- **Ledger:** toda movimentação financeira usa `recordTransaction` com `referenceId`
  prefixado. Nunca crie conta manualmente — use `getOrCreateCommunityAccount`.
- **Migrations:** nomeie como `MigrationNNN_Descricao.ts` com timestamp crescente.
- **Frontend:** use MUI v7 Grid com `size={{ xs: 12 }}` (não `item xs={12}`).

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
  `src/utils/transaction.tsx` e no backend `ledger.service.ts`.
- **Checkout embedded não abre:** verifique se `STRIPE_PUBLISHABLE_KEY` está configurada e se
  `uiMode: 'embedded'` está sendo enviado no `CheckoutDto`.
- **Despesa de evento não aparece:** verifique se `ReimbursementRequest.eventId` ou
  `externalActivationId` foi preenchido e se o `referenceId` começa com `reimbursement:`.
- **Termos de compra versionados:** o texto canônico fica em `src/pages/termos-de-compra.md`;
  o `termsVersion` aceito no backend é `2026-07-v1`.
- **Erro de DI no backend (`UnknownDependenciesException`):** adicione o teste em
  `events.module.spec.ts` e verifique se a assinatura do construtor de `EventsService` foi
  atualizada em todos os specs que instanciam o serviço diretamente.
- **Data/horário errado em eventos:** o backend interpreta strings `datetime-local` no
  timezone do evento (`parseDateTimeLocal` em `events.service.ts`). Verifique se o frontend
  envia `YYYY-MM-DDTHH:mm` e se `timezone` está preenchido.
