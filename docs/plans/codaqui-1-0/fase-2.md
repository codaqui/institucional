<!-- AGENT-INDEX
purpose: Plano executável da Fase 2 do Codaqui 1.0.0 — horas, ownership, guest claim e perfil público.
audience: AI agents e mantenedores executando a Fase 2.
status: implementação, jornadas e gates locais concluídos; handoff externo pendente. Backend 0.14.0 preparado, mas ainda não publicado em main; sync inicial de badges e preparação da Fase 3 permanecem gates externos.
sections:
  - Escopo e decisões fechadas
  - Arquitetura e migrations
  - Tasks 1–8 com TDD e commits
  - Gates e handoff
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe e subsistema B
  - docs/adrs/013-hour-ledger.md — comportamento implementado na Fase 2
  - docs/plans/codaqui-1-0/rbac.md — cutover de ownership
  - docs/plans/codaqui-1-0/auth.md — guest token e decisões de risco
  - docs/plans/codaqui-1-0/transversais.md — Turnstile, certificados e retenção
agent-protocol:
  - Não puxar Fases 3–7; Fase 3 começa somente por comando explícito após o handoff.
  - Backend 0.14.0; migrations 033 horas, 034 ownership e 035 guest.
  - Publicação em main, redeploy e sync inicial de badges não podem ser marcados sem evidência externa.
-->

# Fase 2 — Pessoas e Horas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar contabilidade de horas, transição de ownership para designations, participação de convidados e evolução do perfil público sem alterar a ledger financeira ou os fluxos de tenants.

**Architecture:** Uma branch `feat/fase-2-pessoas-horas` criada de `develop`, com um commit por task e revisão entre entregas. `hour_ledger` é um módulo NestJS separado da ledger financeira; check-in e crédito automático compartilham transação e unicidade. Ownership usa dual-write antes da leitura por designations. Guests reutilizam `event_registrations`, Turnstile e o check-in atômico existente. O backend sobe uma única vez para `0.14.0`.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Astro 7, React 19, MUI 9, Vitest 3, Cloudflare Turnstile, Pagefind, Node 24.

**Spec:** `docs/plans/codaqui-1-0/README.md`, `rbac.md`, `auth.md` e `transversais.md`.

## Global Constraints

- Não implementar assembleias, entidades/projetos, mentoria, Universitário, Business tiers ou C4P.
- Não criar tabelas de vínculo paralelas nem reutilizar `ledger.transactions` para horas.
- `hour_ledger` usa horas decimais; eventos usam minutos na origem e convertem com duas casas.
- Crédito de evento é `approved` e exige `memberId` no check-in; guest sem conta não gera hora nem retroativo.
- Eventos legados sem carga horária não recebem backfill automático: registrar warning e seguir o check-in.
- Novos managed events exigem `workloadMinutes` ou duração válida; ativação de check-in externo exige carga no override. Cancelamento posterior não desfaz check-in nem horas.
- Ownership preserva `OrganizersFile`; a tabela legada não é removida nesta fase.
- Guest é somente para managed events gratuitos; evento pago e evento externo ficam fora.
- Guest duplicado ao vincular conta vira `CANCELLED`, com audit, sem duplicar vaga/certificado.
- Nome/e-mail de guests sem conta são anonimizados quando o início do evento tem mais de 365 dias; token, consentimento e trilha de presença permanecem.
- `profileVisibility` ganha apenas a chave `badge` (default `true`), usada pelo selo SVG; `hours` continua controlando horas públicas.
- APIs novas não usam `/admin/`; listagens seguem o envelope e os limites da decisão 12.
- Zero hex fora de `tokens.css`; MUI 9 com `sx`/`slotProps`; Grid com `size`.
- Toda concessão/aprovação grava audit de governo. Nenhum segredo ou PII real entra em fixtures/docs.
- Gates finais: `make astro-verify`, `make astro-verify-tenants`, `npm run test:scripts`, `cd backend && npm run build && npx jest --silent`.

## Migrations e interfaces

| Migration | Entrega |
|---|---|
| `033_HourLedger` | `hour_ledger`, enums, FK a members e unicidade de fontes automáticas |
| `034_EventOrganizerDesignations` | seed/reconciliação de ownership em `member_designations`, sem drop legado |
| `035_EventGuests` | campos guest, `PENDING_GUEST`, nome/e-mail nullable e índices de vínculo/retenção |

`HourEntry`: `id`, `memberId`, `sourceType`, `sourceId`, `sourceLabel`, `hours`, `description`, `occurredAt`, `status`, `reportedById`, `approvedById`, `approvedAt`, `rejectReason`, `idempotencyKey`, `createdAt`, `updatedAt`.

Fontes: `event_checkin`, `directorate_activity`, `extension_project`, `mentorship_session`. Só `directorate_activity` é editável nesta fase; as demais são contratos para fases futuras.

### Task 1: Núcleo `hour_ledger` e API de aprovação

**Files:**
- Create: `backend/src/hours/entities/hour-entry.entity.ts`
- Create: `backend/src/hours/dto/{create-hour-entry.dto,review-hour-entry.dto,list-hours.dto}.ts`
- Create: `backend/src/hours/{hours.module,hours.service,hours.controller}.ts`
- Create: `backend/src/hours/hours.service.spec.ts` e `hours.controller.spec.ts`
- Create: `backend/src/migrations/1794000000000-Migration033_HourLedger.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/audit/entities/audit-log.entity.ts`, `backend/src/audit/audit-category.ts`
- Modify: `backend/src/members/{profile-visibility.ts,dto/update-profile-visibility.dto.ts}` e testes

**Interfaces:**
- `HoursService.create(dto, actor): Promise<HourEntry>` cria `pending` com `idempotencyKey` obrigatório.
- `HoursService.approve(id, actor)` e `.reject(id, actor, reason)` exigem admin/finance-analyzer e audit.
- `GET /hours/me`, `GET /hours/pending`, `POST /hours`, `POST /hours/:id/approve`, `POST /hours/:id/reject`.
- `GET /hours/members/:memberId/summary` retorna `{ totalHours, entries }`, vazio quando `hours=false`.
- `GET /hours/members/:memberId/statement?from&to` exige o próprio membro e devolve dados para declaração.

- [x] **Step 1: Write failing service and migration tests**

```ts
it('deduplicates manual entries by member and idempotency key', async () => {
  repo.findOne.mockResolvedValue({ id: 'existing' });
  await expect(service.create(baseDto, actor)).rejects.toThrow(ConflictException);
});

it('returns no public hours when visibility is disabled', async () => {
  membersRepo.findOneBy.mockResolvedValue({ profileVisibility: { hours: false } });
  await expect(service.publicSummary('member-1')).resolves.toEqual({ totalHours: 0, entries: [] });
});
```

Run: `cd backend && npx jest src/hours src/members/profile-visibility.spec.ts --runInBand` → FAIL porque módulo/chave não existem.

- [x] **Step 2: Create migration 033 and the hours module**
  `hours numeric(8,2) > 0`; índice único `(memberId,sourceType,sourceId)` apenas para `event_checkin` e `mentorship_session`; índice único `(memberId,idempotencyKey)` quando não nulo. `down` remove somente objetos da 033.
  Adicionar `badge` ao contrato de visibilidade com default `true`, DTO opcional/booleano e metadados em Meus dados.
- [x] **Step 3: Implement authorization, idempotency and public filtering**
  Diretor lança apenas `directorate_activity`; admin/finance-analyzer aprova/rejeita. Rejeição exige motivo. A summary pública soma somente `approved` e omite entradas quando oculta.
- [x] **Step 4: Run focused tests and validate down/up**
  `cd backend && npx jest src/hours src/members --runInBand`; aplicar/reverter/reaplicar 033 no banco descartável.
- [x] **Step 5: Commit**
  `git add backend/src/hours backend/src/migrations backend/src/members backend/src/audit backend/src/app.module.ts && git commit -m "feat(fase-2): adiciona ledger de horas e aprovações"`

### Task 2: Horas automáticas no check-in e carga obrigatória

**Files:**
- Modify: `backend/src/hours/hours.service.ts` e spec
- Modify: `backend/src/events/events.service.ts`, `events.module.ts` e specs
- Modify: `backend/src/events/dto/event.dto.ts` e `external.dto.ts`
- Create: `backend/src/hours/event-hours.ts` e `event-hours.spec.ts`

**Interfaces:**
- `resolveEventWorkloadMinutes(event: { workloadMinutes?: number | null; startAt: Date; endAt?: Date | null }): number | null`.
- `HoursService.recordEventCheckin(registration, workloadMinutes, manager): Promise<void>` usa o `EntityManager` da transação do check-in.
- O crédito ocorre somente após o update condicional `checkedInAt null→valor` e na mesma transação.

- [x] **Step 1: Write failing check-in tests**

```ts
it('credits event hours exactly once for a member check-in', async () => {
  await service.checkin('event-1', 'token', admin);
  await service.checkin('event-1', 'token', admin);
  expect(hours.recordEventCheckin).toHaveBeenCalledTimes(1);
});

it('does not credit guests or legacy events without workload', async () => {
  registration.memberId = null;
  await service.checkin('event-1', 'token', admin);
  expect(hours.recordEventCheckin).not.toHaveBeenCalled();
});
```

Run: `cd backend && npx jest src/hours src/events --runInBand` → FAIL.
- [x] **Step 2: Implement workload resolution and validation**
  Prioridade: `workloadMinutes`; fallback `endAt-startAt` inteiro positivo. Create de managed event e ativação externa rejeitam ausência de ambos. Registros legados sem carga seguem sem hora, com warning.
- [x] **Step 3: Make check-in and hour credit atomic**
  Migrar os dois caminhos de check-in para `DataSource.transaction`; o segundo scan retorna `already_checked_in` sem novo crédito. Conflito de unicidade na mesma transação é tratado como idempotência, nunca como segunda hora.
- [x] **Step 4: Run focused and PostgreSQL concurrency tests**
  `cd backend && npx jest src/hours src/events --runInBand`; executar dois check-ins concorrentes no banco descartável e confirmar uma única entrada.
- [x] **Step 5: Commit**
  `git add backend/src/hours backend/src/events && git commit -m "feat(fase-2): credita horas no check-in atômico"`

### Task 3: Dual-write, seed e cutover de ownership

**Files:**
- Modify: `backend/src/event-organizer/event-organizer-ownership.service.ts` e spec
- Modify: `backend/src/event-organizer/event-organizer.module.ts`
- Create: `backend/src/migrations/1794000001000-Migration034_EventOrganizerDesignations.ts`
- Create: `backend/src/event-organizer/ownership-reconciliation.ts` e spec
- Modify: `backend/src/designations/entities/member-designation.entity.ts` somente se o contrato existente exigir ajuste

**Interfaces:**
- `scopeToDesignation(scope, activation): { targetType:'event'; targetId?:string; targetKey?:string; designation:'organizer' }`.
- `reconcileOwnerships(manager): { inserted, alreadyPresent, orphanedActivations }`.
- `getOrganizers()` e `getOwnedScopes()` leem designations após seed; `POST /events/organizers/reconcile` (admin) repete reconciliação idempotente e devolve relatório.

- [x] **Step 1: Write failing dual-write and reconciliation tests**

```ts
expect(scopeToDesignation('meetup:devparana:*', null)).toEqual({
  targetType: 'event', targetKey: 'meetup:devparana:*', designation: 'organizer',
});
expect(scopeToDesignation('meetup:devparana:123', activation)).toEqual({
  targetType: 'event', targetId: activation.id, designation: 'organizer',
});
```

Run: `cd backend && npx jest src/event-organizer --runInBand` → FAIL.
- [x] **Step 2: Implement migration 034**
  Para cada scope, resolve activation por `eventKey`; usa `targetId` quando existe e o scope literal em `targetKey` caso contrário. `appointedById=updatedByMemberId`; `ON CONFLICT DO NOTHING`; sem drop da tabela antiga.
- [x] **Step 3: Implement transactional dual-write and canonical reads**
  Upsert/remove sincronizam somente designations `organizer @ event` do membro na mesma transação. Não revogar outros tipos. Reconciliação é idempotente e relativa scopes sem activation como wildcard/não ativado, não como órfão destrutivo.
- [x] **Step 4: Run focused and real migration tests**
  `cd backend && npx jest src/event-organizer src/designations --runInBand`; validar seed, reexecução, wildcard e activation no dump descartável.
- [x] **Step 5: Commit**
  `git add backend/src/event-organizer backend/src/designations backend/src/migrations && git commit -m "feat(fase-2): migra ownership para designations"`

### Task 4: Guest invites e claim público com Turnstile

**Files:**
- Modify: `backend/src/events/entities/event-registration.entity.ts`
- Create: `backend/src/migrations/1794000002000-Migration035_EventGuests.ts`
- Create: `backend/src/events/dto/guest.dto.ts`
- Modify: `backend/src/events/{events.controller,events.service,events.module}.ts` e specs
- Modify: `backend/src/common/turnstile/turnstile.guard.ts` somente se o contrato atual não aceitar decorator por rota

**Interfaces:**
- `POST /events/:id/guest-invites` (host/organizer) → `{ inviteUrl, token }` + audit.
- `GET /events/public/guest-invites/:token` → estado mínimo do evento/convite, QR quando confirmado e e-mail mascarado.
- `POST /events/public/guest-claim` com `{ token,name,email,consent,turnstileToken }`, Turnstile + throttler.
- `RegistrationStatus.PENDING_GUEST`; `isGuest`, `guestInvitedByMemberId`, `guestClaimedAt`, `guestConsentAt`.

- [x] **Step 1: Write failing invite/claim tests**

```ts
it('claims a pending guest exactly once', async () => {
  await service.claimGuestRegistration(dto);
  await expect(service.claimGuestRegistration(dto)).rejects.toThrow(ConflictException);
});

it('rejects pending guest at check-in', async () => {
  await expect(service.checkin('event-1', 'pending-token', admin))
    .rejects.toThrow('pending_guest');
});
```

Run: `cd backend && npx jest src/events src/common/turnstile --runInBand` → FAIL.
- [x] **Step 2: Create migration 035 and entity fields**
  Status enum + colunas guest; nome/e-mail nullable somente para convite pendente/anonimizado. Índices `(isGuest,lower(attendeeEmail))` quando aplicável e `(eventId,status)`.
- [x] **Step 3: Implement invite, public projection and atomic claim**
  Convite exige evento publicado/gratuito e staff autorizado. Claim valida consentimento, Turnstile, capacidade/quota e atualiza condicionalmente `PENDING_GUEST→CONFIRMED`; segunda tentativa = 409. Não vazar e-mail completo nem IDs privados.
- [x] **Step 4: Run focused and real migration tests**
  `cd backend && npx jest src/events src/common/turnstile --runInBand`; validar down/up da 035 e claim concorrente no PostgreSQL.
- [x] **Step 5: Commit**
  `git add backend/src/events backend/src/common/turnstile backend/src/migrations && git commit -m "feat(fase-2): adiciona convites e claim de convidados"`

### Task 5: Jornada guest, e-mail, vínculo e retenção

**Files:**
- Create: `frontend/src/pages/eventos/convite.astro`
- Create: `frontend/src/components/islands/events/GuestClaimIsland.tsx` e teste
- Modify: ilhas admin de eventos/inscrições e testes
- Modify: `backend/src/members/members.service.ts` e spec
- Modify: `backend/src/notifications/{default-templates,email.service}.ts` e specs
- Modify: `backend/src/events/events.service.ts` e spec
- Modify: `docs/modules/privacy/treatments.md` e `frontend/src/pages/sobre/privacidade.astro`

**Interfaces:**
- `/eventos/convite?token=<uuid>` noindex, com `GuestClaimIsland` e `TurnstileField`.
- `MembersService.upsertByGithub` vincula somente e-mails verificados e cancela guest duplicado com audit.
- Cron diário anonimiza guests 12 meses após o evento; nenhum crédito retroativo ao vincular.

- [x] **Step 1: Write failing island, linking and retention tests**

```tsx
it('submits consent and Turnstile, then renders the check-in QR', async () => {
  await user.click(screen.getByRole('checkbox', { name: /concordo/i }));
  await user.click(screen.getByRole('button', { name: /confirmar inscrição/i }));
  expect(await screen.findByRole('img', { name: /qr code/i })).toBeInTheDocument();
});
```

```ts
it('links only verified emails and cancels a duplicate guest registration', async () => {
  // primário/secundário verificado; segunda inscrição CONFIRMED no mesmo evento
  expect(guest.status).toBe(RegistrationStatus.CANCELLED);
  expect(audit.log).toHaveBeenCalled();
});
```

Run: `cd frontend && npx vitest run src/components/islands/events src/components/islands/admin/eventos`; `cd backend && npx jest src/members src/notifications src/events --runInBand` → FAIL.
- [x] **Step 2: Implement public and admin journeys**
  Formulário Nome/E-mail/consentimento/Turnstile; estados pendente/confirmado/cancelado/lotado; QR após claim. Admin gera link/QR e diferencia guest com badge, sem mudar scanner.
- [x] **Step 3: Implement email, account linking and anonymization**
  Template de confirmação guest e lembrete D-1. Vínculo por e-mail verificado; duplicata vira `CANCELLED`; nenhuma hora retroativa. Anonimização define nome/e-mail como null e preserva token/check-in.
- [x] **Step 4: Verify browser and focused tests**
  Executar convite→claim→QR→check-in no Compose; repetir testes focados e conferir que e-mail completo não aparece na projeção pública.
- [x] **Step 5: Commit**
  `git add backend/src/members backend/src/notifications backend/src/events frontend/src/pages/eventos/convite frontend/src/components/islands docs/modules/privacy && git commit -m "feat(fase-2): completa jornada e retenção de convidados"`

### Task 6: UI de horas e declaração do membro

**Files:**
- Create: `frontend/src/pages/membro/horas.astro` e `/admin/horas.astro`
- Create: `frontend/src/components/islands/member/hours/MemberHoursApp.tsx` e teste
- Create: `frontend/src/components/islands/admin/hours/HoursApprovalsApp.tsx` e teste
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/AppNavIsland.tsx` e teste

**Interfaces:**
- `/membro/horas`: saldo approved, extrato, período e declaração imprimível com código de verificação.
- `/admin/horas`: fila paginada, aprovar/rejeitar com motivo obrigatório.
- `/hours/verify/:code` público retorna validade e total do período, respeitando `hours=false`.

- [x] **Step 1: Write failing member/admin tests**

```tsx
it('prints only approved hours in the selected period', async () => {
  await user.click(screen.getByRole('button', { name: /emitir declaração/i }));
  expect(screen.getByText('12,50 horas')).toBeInTheDocument();
  expect(window.print).toHaveBeenCalled();
});
```

Run: `cd frontend && npx vitest run src/components/islands/member/hours src/components/islands/admin/hours` → FAIL.
- [x] **Step 2: Implement member statement and public verification**
  Sem biblioteca PDF nova: documento de impressão com código `HRS-<uuid>` e verificação backend. A verificação pública não revela nome nem total quando horas estão ocultas.
- [x] **Step 3: Implement approval queue and navigation**
  Usar `PaginationControls`, `authFetch`, `extractErrorMessage`, `AppLayout` e padrões existentes; adicionar Horas ao grupo Pessoas e ao dashboard do membro.
- [x] **Step 4: Run focused and browser tests**
  `cd frontend && npx vitest run src/components/islands/member src/components/islands/admin/hours src/components/islands/__tests__/AppNavIsland.test.tsx`; validar aprovação, rejeição, declaração e impressão.
- [x] **Step 5: Commit**
  `git add backend/src/hours frontend/src/pages/membro frontend/src/pages/admin frontend/src/components/islands && git commit -m "feat(fase-2): adiciona painel e declaração de horas"`

### Task 7: Perfil público com horas, badges e selo SVG

**Files:**
- Modify: `backend/src/hours/hours.service.ts` e spec
- Modify: `frontend/src/components/islands/MemberProfileIsland.tsx` e `frontend/src/pages/[...handle].astro`
- Create: `frontend/src/components/islands/member/profile/{HoursSummary,ProfileTimeline,ProfileBadges}.tsx` e testes
- Create: `scripts/sync-member-badges.mjs` e `sync-member-badges.test.mjs`
- Create: `.github/workflows/sync-member-badges.yml`
- Modify: `frontend/scripts/copy-snapshots.mjs` e `Makefile`
- Create: `static/badges/.gitkeep`

**Interfaces:**
- `GET /hours/public` → totais approved por membro, somente quando `hours=true`.
- Perfil mostra horas, marcos 10/50/100 e timeline somente com dados permitidos.
- `/badges/<handle>.svg` inclui nome, ano se permitido e horas se permitido; `badge=false` remove o arquivo no sync.

- [x] **Step 1: Write failing profile and sync tests**

```js
test('removes the badge when badge visibility is disabled and never exposes hidden hours', async () => {
  await syncMemberBadges({ apiUrl, outputDir });
  assert.equal(existsSync(join(outputDir, 'hidden.svg')), false);
  assert.doesNotMatch(readFileSync(join(outputDir, 'visible.svg'), 'utf8'), /hiddenHours/);
});
```

Run: `node --test scripts/sync-member-badges.test.mjs`; `cd frontend && npx vitest run src/components/islands/member/profile` → FAIL.
- [x] **Step 2: Implement public hours and profile sections**
  Extrair componentes pequenos; preservar bio/OG/JSON-LD, eventos, certificados, doações e SortCoins. Campos ocultos nunca reaparecem como defaults.
- [x] **Step 3: Implement atomic badge sync and workflow**
  Escapar XML; gerar por arquivo temporário + rename; apagar somente badges obsoletos após uma resposta completa da API; preservar diretório em caso de falha. Workflow diário + dispatch com permissões mínimas.
- [x] **Step 4: Run focused, build and browser tests**
  `npm run test:scripts`; `cd backend && npx jest src/hours`; `cd frontend && npm run build && npx vitest run src/components/islands/member/profile`; conferir SVG e perfil com `hours/badge` ligados e desligados.
- [x] **Step 5: Commit**
  `git add backend/src/hours frontend/src/components frontend/src/pages frontend/scripts scripts .github/workflows static/badges Makefile && git commit -m "feat(fase-2): expõe horas e selos no perfil público"`

### Task 8: Documentação, release 0.14.0 e handoff

**Files:**
- Modify: `backend/package.json` e `backend/package-lock.json` → `0.14.0`
- Create: `docs/adrs/013-hour-ledger.md`
- Modify: `docs/plans/codaqui-1-0/{README,fase-2}.md`, `docs/README.md`
- Modify: `docs/modules/events/{CODE_MANUAL,ROLES}.md`, `docs/modules/privacy/treatments.md`

**Interfaces:**
- ADR registra separação financeira/horas, carga horária, guest, retenção e declarações sem validade.
- Plano marca somente entregas verificadas; Fase 3 permanece fora do escopo.

- [x] **Step 1: Update living documentation and version**
  Registrar decisões fechadas, APIs novas, cutover sem drop legado, latência de badges e comportamento de campos ocultos.
- [x] **Step 2: Run all required gates**
  `cd backend && npm run build && npx jest --silent`; `make astro-verify`; `make astro-verify-tenants`; `npm run test:scripts`.
  Gate de release: o sync inicial de badges deve rodar com sucesso antes da publicação do frontend; não é necessário gerar nem versionar SVGs de membros reais neste branch.
- [x] **Step 3: Validate production-like journeys**
  Aplicar 026–035 no dump descartável; down/up de 033–035; concorrência de check-in/claim; ownership reconciliado; guest→conta; aprovação/declaração; perfil/badges; HTTP e HTTPS.
- [x] **Step 4: Commit**
  `git add backend/package.json backend/package-lock.json docs && git commit -m "chore(fase-2): prepara release 0.14.0 e handoff"`

## Completion Checklist

- [x] `hour_ledger` separado, aprovado e idempotente, sem horas retroativas ou backfill implícito.
- [x] Check-in gera no máximo uma hora por membro/registration, inclusive externo.
- [x] Ownership reconciliado em designations, dual-write testado e API compatível.
- [x] Guest claim protegido por Turnstile, capacidade correta, QR/check-in e retenção de 12 meses.
- [x] Painel de horas, declaração, perfil e badges respeitam `profileVisibility`.
- [ ] Gates verdes e backend `0.14.0` publicado a partir do HEAD correto de `main`.
- [ ] Fase 3 preparada sem antecipar assembleias ou outros subsistemas.

## Handoff

A Fase 3 começa somente por comando explícito. O handoff deve incluir migration até 035, relatório de reconciliação de ownership, eventos sem carga legados identificados, política de retenção guest, evidência do sync inicial de badges concluído com sucesso antes da publicação do frontend (gate de release, sem precisar gerar SVGs reais neste branch) e o estado real da release `v0.14.0-backend`.
