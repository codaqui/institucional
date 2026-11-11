<!-- AGENT-INDEX
purpose: Plano TDD da Fase 5 — Mentoria com disponibilidade, sessões, notificações, horas e insights.
audience: Implementers e revisores da PR.
status: Concluída e publicada em v0.19.0-backend; Mentoria Operations publicada em 0.22.0.
sections:
  - Global Constraints
  - Tasks 1–8
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-09-mentorship-phase5-design.md — design aprovado
agent-protocol:
  - Teste antes de cada mudança, commit por task e nenhuma reserva dupla ou crédito duplicado.
-->

# Mentorship Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar candidatura de mentores, disponibilidade semanal, agendamento concorrente, sessões, notificações, horas e páginas de mentoria.

**Architecture:** Um `MentorshipModule` gerencia perfil/disponibilidade/sessões e reutiliza designations, `HoursService`, `EmailService` e o registry de templates. Reservas usam lock + unique por mentor/horário; snapshots expõem somente perfis e estatísticas públicas.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Node 24, Astro 7, React 19, MUI 9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-09-mentorship-phase5-design.md`

## Global Constraints

- Backend **0.19.0**, migration **044**, branch `feat/mentorship-phase5`, PR para `develop`; merge/release somente por comando explícito.
- Não alterar a PR #618 nem criar autenticação paralela, Cal.com/Calendly, reagendamento direto ou nova fila de e-mails.
- `mentor @ program('mentoria')` é a autorização; `mentor_profiles` guarda foco/áreas, não papéis.
- Reserva usa lock + unique `(mentorId,scheduledAt)` e validação de sobreposição; conflito = 409 sem e-mail.
- `completed` cria uma única entrada `mentorship_session` pending; `canceled/no_show` não gera horas.
- Somente e-mail verificado vincula `menteeMemberId`; snapshot sem PII de mentorandos, notas, tokens ou IDs de atores.
- APIs de gestão fora de `/admin/`; listagens novas seguem `pagination.ts` + `PaginationControls`.

---

### Task 1: Migration 044 e modelo de mentoria

**Files:**
- Create: `backend/src/mentorship/entities/mentor-profile.entity.ts`
- Create: `backend/src/mentorship/entities/mentor-availability.entity.ts`
- Create: `backend/src/mentorship/entities/mentorship-session.entity.ts`
- Create: `backend/src/mentorship/mentorship.migration.spec.ts`
- Create: `backend/src/migrations/1794600000000-Migration044_Mentorship.ts`
- Modify: `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- `MentorProfile`, `MentorAvailability`, `MentorshipSession` com campos e estados da spec.
- `MentorshipSessionStatus = requested | confirmed | completed | canceled | no_show`.

- [x] **Step 1: Escrever teste da migration**

```ts
expect(upSql).toContain('CREATE TABLE "mentor_profiles"');
expect(upSql).toContain('CREATE TABLE "mentor_availability"');
expect(upSql).toContain('CREATE TABLE "mentorship_sessions"');
expect(upSql).toContain('UNIQUE ("mentorId", "scheduledAt")');
expect(upSql).toContain('"menteeMemberId" uuid');
expect(downSql).toContain('DROP TABLE IF EXISTS "mentorship_sessions"');
```

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship/mentorship.migration.spec.ts --runInBand`
Expected: migration inexistente.

- [x] **Step 3: Implementar entidades e migration**

```ts
await queryRunner.query('CREATE UNIQUE INDEX "UQ_mentorship_session_slot" ON "mentorship_sessions" ("mentorId", "scheduledAt")');
```

Adicionar FKs, índices por `token` e `status`, checks de `durationMin` e `rating`. `mentor_availability` usa `ON DELETE CASCADE`; demais relações usam `ON DELETE RESTRICT`. Bump `0.19.0`.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship/mentorship.migration.spec.ts --runInBand && npm run build`
Commit: `feat(fase-5): adiciona modelo de mentoria`

### Task 2: Candidaturas e perfil do mentor

**Files:**
- Create: `backend/src/mentorship/dto/mentorship.dto.ts`
- Create: `backend/src/mentorship/mentorship.module.ts`
- Create: `backend/src/mentorship/mentorship.controller.ts`
- Create: `backend/src/mentorship/mentorship.service.ts`
- Create: `backend/src/mentorship/mentorship.service.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`, `backend/src/audit/audit-category.spec.ts`

**Interfaces:**
- `apply(dto,user)`, `listMyApplications(user)`, `listApplications(actor)`, `confirmApplication(id,actor)`.
- `getProfile(actor)`, `updateProfile(dto,actor)`.

- [x] **Step 1: Escrever testes de candidatura e aprovação**

```ts
const pending = await service.apply({ areas: ['DevOps'], focus: 'Carreira' }, candidate);
expect(pending).toMatchObject({ status: 'pending', designation: 'mentor', targetKey: 'mentoria' });
await expect(service.confirmApplication(pending.id, managerActor)).rejects.toThrow(ForbiddenException);
await expect(service.confirmApplication(pending.id, adminActor)).resolves.toMatchObject({ active: true, approvedById: adminActor.sub });
```

Incluir duplicidade pendente, escopo do mentor ativo e atualização de foco/áreas.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship --runInBand`
Expected: módulo/service inexistente.

- [x] **Step 3: Implementar fluxo**

```ts
await this.designations.grant({
  memberId: user.sub, targetType: 'program', targetKey: 'mentoria', designation: 'mentor',
  appointedById: user.sub, status: 'pending',
});
```

Confirmação admin chama `designations.confirm`, cria perfil com `approvedById/since` e invalida cache. Rotas sem `/admin/`: applications, profile e availability futura. Registrar ações de auditoria governança.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship src/audit/audit-category.spec.ts --runInBand && npm run build`
Commit: `feat(fase-5): abre candidaturas de mentores`

### Task 3: Disponibilidade e slots com concorrência

**Files:**
- Create: `backend/src/mentorship/availability.service.ts`
- Create: `backend/src/mentorship/availability.service.spec.ts`
- Modify: `backend/src/mentorship/dto/mentorship.dto.ts`
- Modify: `backend/src/mentorship/mentorship.module.ts`, `mentorship.controller.ts`

**Interfaces:**
- `replaceAvailability(weekday,rules,actor)`.
- `listAvailability(mentorId,from): Promise<AvailabilitySlot[]>`.
- `reserveSlot(input,actor): Promise<MentorshipSession>`.

- [x] **Step 1: Escrever testes de regra e reserva dupla**

```ts
await service.replaceAvailability(1, [{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }], mentorActor);
await expect(service.reserveSlot({ mentorId, scheduledAt: futureSlot, durationMin: 60, menteeName: 'Ana', menteeEmail: 'ana@x.dev', topicTags: ['DevOps'], guestConsentAt: new Date() }, guestActor)).resolves.toMatchObject({ status: 'requested' });
await expect(service.reserveSlot(input, otherGuest)).rejects.toThrow(ConflictException);
expect(emailService.sendTemplate).not.toHaveBeenCalled();
```

Adicionar `startTime >= endTime`, regra sobreposta e sessão fora da disponibilidade.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship/availability.service.spec.ts --runInBand`
Expected: service inexistente.

- [x] **Step 3: Implementar slots e reserva transacional**

```ts
const conflict = await sessions.findOne({
  where: {
    mentorId,
    status: In(['requested', 'confirmed']),
    scheduledAt: LessThan(endAt),
  },
});
if (conflict) throw new ConflictException('Este horário já está reservado.');
```

Lock da regra e filtro `existing.start < requested.end AND existing.end > requested.start`; unique `(mentorId,scheduledAt)` vira 409. Converter wall-clock pelo helper de timezone existente, sem dependência nova. `guestConsentAt` obrigatório sem membro.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship --runInBand && npm run build`
Commit: `feat(fase-5): agenda slots de mentoria sem conflito`

### Task 4: Ciclo de sessões, cancelamento e avaliação

**Files:**
- Create: `backend/src/mentorship/sessions.service.ts`
- Create: `backend/src/mentorship/sessions.service.spec.ts`
- Modify: `backend/src/mentorship/mentorship.module.ts`, `mentorship.controller.ts`

**Interfaces:**
- `getByToken(token)`, `confirm(id,meetLink,actor)`, `complete(id,actor)`, `noShow(id,actor)`, `cancel(id,reason,actor)`, `rate(token,rating,feedback?)`.

- [x] **Step 1: Escrever testes de estado e escopo**

```ts
await expect(service.complete(id, otherMentor)).rejects.toThrow(ForbiddenException);
await expect(service.confirm(id, 'http://insecure.test', mentorActor)).rejects.toThrow(BadRequestException);
await expect(service.cancel(id, 'Motivo', mentorActor)).resolves.toMatchObject({ status: 'canceled', cancelReason: 'Motivo' });
await expect(service.rate(token, 5, 'Ótima sessão')).resolves.toMatchObject({ rating: 5, feedback: 'Ótima sessão' });
```

Concluir depois do horário, impedir conclusão antes, impedir avaliação fora de `completed` e impedir confirmação sem HTTPS.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship/sessions.service.spec.ts --runInBand`
Expected: service inexistente.

- [x] **Step 3: Implementar transições**

```ts
if (session.status !== 'confirmed') throw new ConflictException('Somente sessões confirmadas podem ser concluídas.');
if (session.scheduledAt > new Date()) throw new ConflictException('A sessão ainda não ocorreu.');
session.status = 'completed';
session.completedAt = new Date();
```

Cancelamento exige motivo 3–500 e vale apenas antes de `completed`; `no_show` somente depois do horário. Projeção por token não expõe IDs de atores nem notas privadas.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship --runInBand && npm run build`
Commit: `feat(fase-5): gerencia ciclo das sessões`

### Task 5: Notificações, horas e retenção

**Files:**
- Modify: `backend/src/notifications/default-templates.ts`, `default-templates.spec.ts`
- Modify: `backend/src/mentorship/sessions.service.ts`, `sessions.service.spec.ts`
- Modify: `backend/src/members/members.service.ts`, `members.service.spec.ts`
- Modify: `backend/src/hours/entities/hour-entry.entity.ts`

**Interfaces:**
- Templates `mentorship-requested`, `mentorship-confirmed`, `mentorship-reminder-d1`, `mentorship-cancelled`.
- `HoursService.recordMentorshipSession(session)` cria uma única entrada pending.
- `upsertByGithub` vincula somente e-mails verificados a `menteeMemberId`.

- [x] **Step 1: Escrever testes de horas e vínculo**

```ts
await service.complete(id, mentorActor);
expect(hours.recordMentorshipSession).toHaveBeenCalledWith(expect.objectContaining({ id, durationMin: 60 }));
expect(hours.recordMentorshipSession).toHaveBeenCalledTimes(1);
await service.complete(id, mentorActor);
expect(hours.recordMentorshipSession).toHaveBeenCalledTimes(1);
await members.upsertByGithub({ ...githubUser, emails: [{ email: 'ana@x.dev', verified: true }] });
expect(sessionRepo.update).toHaveBeenCalledWith({ menteeEmail: 'ana@x.dev', menteeMemberId: IsNull() }, { menteeMemberId: member.id });
```

Adicionar `no_show` sem horas, e-mail não verificado sem vínculo e anonimização somente de convidados antigos sem membro.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship src/members/members.service.spec.ts src/notifications/default-templates.spec.ts --runInBand`
Expected: métodos/templates inexistentes.

- [x] **Step 3: Implementar horas e notificações**

```ts
await this.hours.recordMentorshipSession(session);
```

Implementar método em `HoursService` com `sourceType = 'mentorship_session'`, `hours = durationMin / 60`, `sourceId = session.id`, `status = pending` e dedupe por fonte. Templates no registry atual; falha de e-mail não desfaz a transição. Cron diário anonimiza convidados antigos sem membro.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship src/members/members.service.spec.ts src/hours src/notifications/default-templates.spec.ts --runInBand && npm run build`
Commit: `feat(fase-5): notifica sessões e credita horas uma vez`

### Task 6: Snapshot público e insights

**Files:**
- Modify: `backend/src/mentorship/mentorship.controller.ts`, `mentorship.service.ts`, specs
- Create: `scripts/sync-mentors.mjs`, `scripts/sync-mentors.test.mjs`
- Create: `static/mentors/index.json` com `{ "generatedAt": null, "mentors": [], "insights": { "completed": 0, "activeMentors": 0, "areas": [], "noShowRate": 0 } }`
- Create: `.github/workflows/sync-mentors.yml`
- Modify: `package.json`, `Makefile`, `frontend/scripts/copy-snapshots.mjs`

**Interfaces:**
- `GET /mentorship/public` e `GET /mentorship/insights` (admin).
- `MENTORS_API_URL` default `http://localhost:3001`.

- [x] **Step 1: Escrever testes de projeção e sync atômico**

```ts
expect(publicPayload.mentors[0]).toEqual({ handle: 'ana', name: 'Ana', avatarUrl: 'avatar', areas: ['DevOps'], focus: 'Carreira', availability: [] });
expect(publicPayload.mentors[0]).not.toHaveProperty('memberId');
expect(publicPayload).not.toHaveProperty('sessions');
await runSync();
expect(readJson(tempSnapshot)).toEqual(previousSnapshot);
```

O último caso simula HTTP 500 e exige preservação do snapshot anterior.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/mentorship --runInBand && cd .. && node --test scripts/sync-mentors.test.mjs`
Expected: projeção/script inexistente.

- [x] **Step 3: Implementar projeção e workflow**

```ts
const payload = { generatedAt: new Date().toISOString(), mentors: publicMentors, insights };
await writeFileAtomic(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
```

Validar payload completo, escrever atomicamente e preservar em erro. Workflow diário 06:21 UTC + dispatch, fora do agregador `npm run sync`. Insights públicos agregados por área, conclusão e no-show, sem sessões individuais.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/mentorship --runInBand && cd .. && npm run test:scripts`
Commit: `feat(fase-5): publica mentores e insights em snapshot`

### Task 7: Páginas de agendamento, mentor e admin

**Files:**
- Create: `frontend/src/data/mentors.ts`, `mentors.test.ts`
- Modify: `frontend/src/pages/participe/mentoria.astro`
- Create: `frontend/src/components/islands/mentorship/MentorApplicationIsland.tsx`, teste
- Create: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx`, teste
- Create: `frontend/src/components/islands/mentorship/MenteeSessionIsland.tsx`, teste
- Create: `frontend/src/pages/membro/mentoria.astro`
- Create: `frontend/src/pages/mentoria/sessao/[token].astro`
- Create: `frontend/src/pages/admin/mentoria.astro`
- Create: `frontend/src/components/islands/admin/mentorship/MentorshipAdminApp.tsx`, teste
- Modify: `frontend/src/components/islands/AppNavIsland.tsx` e teste

**Interfaces:**
- `loadMentorsIndex()` valida snapshot sem PII.
- Dashboard usa `useAuth`, `authFetch`, `parseAuthJson`, `extractErrorMessage` e `PaginationControls`.

- [x] **Step 1: Escrever testes das jornadas**

```tsx
await user.click(screen.getByRole('button', { name: 'Agendar 19:00' }));
await user.type(screen.getByLabelText('Nome'), 'Ana');
await user.type(screen.getByLabelText('E-mail'), 'ana@x.dev');
await user.click(screen.getByRole('checkbox', { name: /consentimento/i }));
expect(authFetch).toHaveBeenCalledWith('/mentorship/sessions', expect.objectContaining({ method: 'POST' }));
expect(await screen.findByText(/sessão solicitada/i)).toBeInTheDocument();
```

Adicionar confirmação do mentor, cancelamento por token, avaliação, aprovação admin e lista paginada.

- [x] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/data/mentors.test.ts src/components/islands/mentorship src/components/islands/admin/mentorship`
Expected: componentes/rotas inexistentes.

- [x] **Step 3: Implementar páginas e ilhas**

```tsx
const response = await authFetch('/mentorship/sessions', {
  method: 'POST', body: JSON.stringify({ mentorId, scheduledAt, durationMin, menteeName, menteeEmail, topicTags, guestConsentAt }),
});
```

Manter os cinco perfis iniciais no snapshot bootstrap. Formulários nativos acessíveis, estados de erro e teclado. `.astro` fino + `AppLayout` para membro/admin. Nav mostra mentoria por designation ativa.

- [x] **Step 4: Verificar e commit**

Run: `cd frontend && npm run check && npx vitest run src/data/mentors.test.ts src/components/islands/mentorship src/components/islands/admin/mentorship`
Commit: `feat(fase-5): entrega jornada de mentoria no site`

### Task 8: E2E, ADR 009 e handoff

**Files:**
- Create: `backend/test/mentorship.e2e-spec.ts`
- Create: `docs/adrs/009-mentorship.md`
- Modify: `docs/plans/codaqui-1-0/README.md`, `AGENTS.md`, `DEVELOPMENT.md`, `docs/README.md`
- Modify: `docs/modules/events/CODE_MANUAL.md`, `docs/modules/privacy/treatments.md`

**Interfaces:**
- Jornada real `candidate → admin confirm → availability → concurrent reservations → confirm → complete → hours → rating`.
- Migration 044 down/up preservando perfis, sessões e designations.

- [x] **Step 1: Escrever e rodar E2E em dump isolado**

```ts
const [first, second] = await Promise.all([
  request(app.getHttpServer()).post('/mentorship/sessions').send(slot).expect(201),
  request(app.getHttpServer()).post('/mentorship/sessions').send(slot).expect(409),
]);
expect(hourRows).toHaveLength(1);
expect(hourRows[0].status).toBe('pending');
```

Restaurar dump em `codaqui_mentorship_test`, validar migration down/up e fixtures sintéticas limpas. Cobrir token, avaliação, vínculo verificado e anonimização quando aplicável.

- [x] **Step 2: Rodar gates completos**

Run: `cd backend && npm run build && npx jest --silent`
Run: `npm run test:scripts`
Run: `make astro-verify && make astro-verify-tenants`

- [x] **Step 3: Documentar e commit**

Registrar ADR 009 com reúso, concorrência, contratos, privacidade, snapshot e rollout. Marcar Fase 5 sem apagar publicações/releases pendentes.
Commit: `docs(fase-5): registra mentoria e handoff`

- [x] **Step 4: Abrir PR e apresentar integração**

Push de `feat/mentorship-phase5`, abrir PR para `develop`, acompanhar CI/Sonar/Copilot e corrigir apontamentos. Não fazer merge, release 0.19.0, sync real ou e-mails reais sem comando explícito. PR #618 permanece separada.

**Resultado:** PR [#621](https://github.com/codaqui/institucional/pull/621) integrada em `develop` pelo merge `85fae64047cedcbede01a72814d304ebd1712a5c`, sem squash. Backend CI, Coverage, Astro, tenants, Trivy e SonarCloud verdes no resultado integrado. PR [#618](https://github.com/codaqui/institucional/pull/618) permanece aberta para `main`; para reverter somente mentoria, usar `git revert -m 1 85fae64047cedcbede01a72814d304ebd1712a5c`. Release e rollout continuam pendentes.
