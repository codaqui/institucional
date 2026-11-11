<!-- AGENT-INDEX
purpose: Plano TDD da fila assíncrona de convites de certificado, paginação e rate limit SMTP.
audience: Implementers e revisores da PR.
status: Fila publicada em v0.19.0-backend; serialização SMTP global entre processos e réplicas ampliada em 0.23.0.
sections:
  - Global Constraints
  - Tasks 1–7
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-09-certificate-invite-queue-design.md — design aprovado
agent-protocol:
  - Executar em ordem, teste antes de cada mudança e commit por task.
  - Não alterar a PR #618 nem reprocessar falhas históricas automaticamente.
-->

# Certificate Invite Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Substituir a rajada síncrona de convites por fila PostgreSQL com progresso, paginação, ritmo SMTP e retries.

**Architecture:** `CertificateInviteQueueService` encapsula jobs e chama `EventsService.inviteCertificates([id], actor)` por item; o controller passa a enfileirar. `EmailService` serializa SMTP, listagens ganham envelope opcional e a Central usa seleção por página e polling somente quando visível.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Node 24, Astro 7, React 19, MUI 9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-09-certificate-invite-queue-design.md`

## Global Constraints

- Backend **0.18.0**, migration **043**, branch `fix/certificate-invite-queue`, PR para `develop`; merge/release somente por comando explícito.
- Não adicionar BullMQ, Redis, dependência, campanha E3 ou open tracking.
- Não reprocessar logs antigos nem definir `certificateInvitedAt` sem `EmailStatus.SENT`.
- Um job a cada 10 segundos; 3 tentativas; backoff 1/5/15 minutos; 421/454 pausa pendentes por 15 minutos.
- `EMAIL_SEND_INTERVAL_MS`: produção default 2000, demais ambientes default 0.
- Sem `page` e `limit`, listagens mantêm array legado; com ambos, envelope `{data,total,page,totalPages,limit}`.
- Página da Central: 25; seleção só da página atual; polling 5 segundos somente com documento visível.
- Sem nome, e-mail, token ou template na fila. Jobs só admin/solicitante. Fixtures sintéticas removidas.

---

### Task 1: Migration 043 e contrato do job

**Files:**
- Create: `backend/src/events/entities/certificate-invite-job.entity.ts`
- Create: `backend/src/events/certificate-invite.migration.spec.ts`
- Create: `backend/src/migrations/1794500000000-Migration043_CertificateInviteJobs.ts`
- Modify: `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- `CertificateInviteJobStatus = queued | processing | retry | completed | failed | skipped`.
- Entity com os campos da spec e índices/unicidades.

- [x] **Step 1: Escrever teste da migration**

```ts
expect(upSql).toContain('CREATE TABLE "certificate_invite_jobs"');
expect(upSql).toContain('UNIQUE ("batchId", "registrationId")');
expect(upSql).toContain("status IN ('queued','processing','retry')");
expect(upSql).toContain('CREATE INDEX "IDX_certificate_invite_jobs_available"');
expect(downSql).toContain('DROP TABLE IF EXISTS "certificate_invite_jobs"');
```

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/certificate-invite.migration.spec.ts --runInBand`
Expected: migration inexistente.

- [x] **Step 3: Implementar entity/migration e bump**

```ts
await queryRunner.query(`CREATE UNIQUE INDEX "UQ_certificate_invite_active_registration"
  ON "certificate_invite_jobs" ("registrationId")
  WHERE status IN ('queued','processing','retry')`);
```

Adicionar FKs para registrations/members com `ON DELETE RESTRICT`, `UNIQUE (batchId,registrationId)` e índices `batchId` e `(status,availableAt)`. Bump `0.18.0` nos dois manifests.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/events/certificate-invite.migration.spec.ts --runInBand && npm run build`
Commit: `feat(eventos): adiciona jobs de convites de certificado`

### Task 2: Rate limit SMTP compartilhado

**Files:**
- Modify: `backend/src/notifications/email.service.ts`
- Modify: `backend/src/notifications/email.service.spec.ts`
- Modify: `.env.example`, `backend/.env.example`

**Interfaces:**
- `EmailService` mantém `sendTemplate` e `sendProjectEmail`; ambos usam uma cadeia serial privada.

- [x] **Step 1: Escrever teste de serialização**

```ts
let releaseFirst!: () => void;
provider.send.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseFirst = resolve; })).mockResolvedValue(undefined);
const first = service.sendTemplate('event-registration-confirmation', 'a@x.dev', makeContext());
const second = service.sendTemplate('event-registration-confirmation', 'b@x.dev', makeContext());
await Promise.resolve();
expect(provider.send).toHaveBeenCalledTimes(1);
releaseFirst();
await Promise.all([first, second]);
expect(provider.send).toHaveBeenCalledTimes(2);
```

Adicionar teste de `EMAIL_SEND_INTERVAL_MS=5` com fake timers para provar espera configurável.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/notifications/email.service.spec.ts --runInBand`
Expected: segunda chamada inicia antes da primeira terminar.

- [x] **Step 3: Implementar cadeia serial e intervalo**

```ts
private smtpChain: Promise<void> = Promise.resolve();
private scheduleSmtpSend(message: EmailMessage): Promise<void> {
  const run = this.smtpChain.then(async () => {
    await this.provider.send(message);
    await this.smtpDelay();
  });
  this.smtpChain = run.catch(() => undefined);
  return run;
}
```

`smtpDelay()` lê `EMAIL_SEND_INTERVAL_MS`, usa 2000 somente como default de produção e 0 fora dela. Substituir os dois `provider.send` existentes por `scheduleSmtpSend`. Documentar a env nos exemplos, sem segredo.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/notifications/email.service.spec.ts --runInBand && npm run build`
Commit: `fix(notifications): serializa envios SMTP`

### Task 3: Paginação compatível das inscrições

**Files:**
- Modify: `backend/src/events/dto/certificate-operations.dto.ts`
- Modify: `backend/src/events/events.controller.ts`, `events.controller.spec.ts`
- Modify: `backend/src/events/events.service.ts`, `events.service.spec.ts`

**Interfaces:**
- `ListRegistrationsQueryDto { page?, limit?, search?, certificateFilter? }`.
- `certificateFilter`: `all | eligible | granted | registration_pending`.

- [x] **Step 1: Escrever testes de envelope e legado**

```ts
const legacy = await service.listRegistrations('evt-1', { search: 'ana' }, actor);
expect(Array.isArray(legacy)).toBe(true);
const page = await service.listRegistrations('evt-1', { page: 2, limit: 25, certificateFilter: 'registration_pending' }, actor);
expect(page).toMatchObject({ total: 55, page: 2, totalPages: 3, limit: 25 });
expect(qb.andWhere).toHaveBeenCalledWith('r.status IN (:...pendingStatuses)', { pendingStatuses: ['pending_match', 'pending_guest'] });
```

Repetir contrato para `listExternalParticipants`, verificando `eligible` e `granted` sem depender de dados reais.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events.controller.spec.ts --runInBand`
Expected: query DTO/envelope inexistente.

- [x] **Step 3: Implementar DTO, controller e consulta**

```ts
if (query.certificateFilter === 'registration_pending') {
  qb.andWhere('r.status IN (:...pendingStatuses)', { pendingStatuses: ['pending_match', 'pending_guest'] });
}
if (query.page !== undefined && query.limit !== undefined) {
  const [rows, total] = await qb.getManyAndCount();
  return { data: await this.enrichRegistrations(rows), total, page: query.page, totalPages: Math.ceil(total / query.limit), limit: query.limit };
}
```

Aplicar `skip/take`, validar `page >= 1`, `1 <= limit <= 100`, manter `search` e array legado. Controller usa `@Query() query` nas duas rotas.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events.controller.spec.ts --runInBand && npm run build`
Commit: `feat(eventos): pagina participantes e certificados`

### Task 4: Enfileiramento e progresso dos convites

**Files:**
- Create: `backend/src/events/certificate-invite-queue.service.ts`
- Create: `backend/src/events/certificate-invite-queue.service.spec.ts`
- Modify: `backend/src/events/events.module.ts`, `events.module.spec.ts`
- Modify: `backend/src/events/events.controller.ts`, `events.controller.spec.ts`
- Modify: `backend/src/events/events.service.ts`, `events.service.spec.ts`

**Interfaces:**
- `enqueue(registrationIds,user): Promise<{batchId,total,status:'queued',invalid:string[]}>`.
- `getBatch(batchId,user): Promise<CertificateInviteBatchProgress>`.
- `validateCertificateInviteRegistration(id,user): Promise<'ok'|'invalid'|'already_invited'>` extraída no `EventsService`.

- [x] **Step 1: Escrever testes de enqueue/progresso**

```ts
const result = await queue.enqueue(['reg-1', 'reg-1', 'invalid'], actor);
expect(result).toMatchObject({ total: 1, status: 'queued', invalid: ['invalid'] });
expect(jobRepo.save).toHaveBeenCalledWith(expect.objectContaining({ registrationId: 'reg-1', status: 'queued', attempts: 0 }));
await expect(queue.getBatch(result.batchId, otherActor)).rejects.toThrow(ForbiddenException);
```

Adicionar 23505 da unique ativa convertido em ausência de duplicidade e autorização repetida no worker.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/certificate-invite-queue.service.spec.ts --runInBand`
Expected: service inexistente.

- [x] **Step 3: Implementar enqueue, entidade no módulo e rotas**

```ts
const batchId = randomUUID();
const jobs = validIds.map((registrationId) => this.jobRepo.create({
  batchId, registrationId, requestedById: user.sub, status: 'queued', attempts: 0,
}));
await this.jobRepo.save(jobs);
```

Controller injeta `CertificateInviteQueueService`, usa `@HttpCode(202)` no POST atual e adiciona `GET certificate-invites/batches/:batchId` antes das rotas `:id`. Extrair validação no EventsService sem enviar e-mail. Registrar entity em `TypeOrmModule.forFeature`.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/events/certificate-invite-queue.service.spec.ts src/events/events.controller.spec.ts src/events/events.module.spec.ts --runInBand && npm run build`
Commit: `feat(eventos): enfileira convites de certificado`

### Task 5: Worker com lock, retries e backoff

**Files:**
- Modify: `backend/src/events/certificate-invite-queue.service.ts`
- Modify: `backend/src/events/certificate-invite-queue.service.spec.ts`

**Interfaces:**
- `processNextJob(): Promise<void>` chamado por `@Cron('*/10 * * * * *')` e diretamente nos testes.
- Reuso de `EventsService.inviteCertificates([registrationId], currentActor)`.

- [x] **Step 1: Escrever testes do ciclo de vida**

```ts
expect(job.status).toBe('processing');
expect(events.inviteCertificates).toHaveBeenCalledWith(['reg-1'], expect.objectContaining({ sub: actor.sub }));
expect(jobRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
```

Adicionar: SMTP skipped; 421 com `retry` e `availableAt`; terceira falha vira `failed`; job travado >2 min volta para `retry`; lock usa `onLocked: 'skip_locked'`; 421/454 atualiza pendentes para +15 minutos.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/certificate-invite-queue.service.spec.ts --runInBand`
Expected: `processNextJob` inexistente.

- [x] **Step 3: Implementar worker**

```ts
const job = await this.jobRepo.manager.transaction(async (manager) => {
  const repo = manager.getRepository(CertificateInviteJob);
  const claimed = await repo.findOne({
    where: { status: In(['queued', 'retry']), availableAt: LessThanOrEqual(new Date()) },
    order: { createdAt: 'ASC' },
    lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
  });
  if (!claimed) return null;
  claimed.status = 'processing';
  claimed.lockedAt = new Date();
  claimed.attempts += 1;
  return repo.save(claimed);
});
```

Processar fora do lock, recarregar ator atual e mapear `sent/completed`, `skipped/skipped`, falha temporária/permanente conforme spec. Recuperar `processing` antigo antes de selecionar. Não lançar erro de SMTP para o cron.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/events/certificate-invite-queue.service.spec.ts src/events/events.service.spec.ts --runInBand && npm run build`
Commit: `feat(eventos): processa convites com ritmo e retries`

### Task 6: Central paginada e acompanhamento assíncrono

**Files:**
- Create: `frontend/src/components/islands/admin/checkin/useCertificateInviteProgress.ts`
- Modify: `frontend/src/components/islands/admin/checkin/CertificateCenter.tsx`
- Modify: `frontend/src/components/islands/admin/checkin/CheckinApp.tsx`
- Modify: `frontend/src/components/islands/admin/checkin/types.ts`
- Modify: `frontend/src/components/islands/admin/checkin/__tests__/checkin.test.tsx`

**Interfaces:**
- `onInvite(ids): Promise<{batchId,total,status:'queued',invalid:string[]}>`.
- `useCertificateInviteProgress(batchId,loadBatch,onDone)`.

- [x] **Step 1: Escrever testes de página, batch e visibilidade**

```tsx
expect(screen.getByRole('navigation', { name: 'Paginação de certificados' })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: 'Selecionar convidáveis' }));
await user.click(screen.getByRole('button', { name: 'Enfileirar convites (25)' }));
expect(authFetch).toHaveBeenCalledWith('/events/certificate-invites/batch', expect.objectContaining({ body: expect.stringContaining('registrationIds') }));
expect(await screen.findByRole('progressbar')).toBeInTheDocument();
```

Mockar 51 registros e provar que somente os 25 da página são enviados; trocar página limpa seleção. Com `visibilityState='hidden'`, avançar timers não chama o batch; ao voltar para `visible`, polling reinicia.

- [x] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/checkin/__tests__/checkin.test.tsx`
Expected: sem paginação/progresso e seleção excede a página.

- [x] **Step 3: Implementar paginação controlada**

```tsx
const params = new URLSearchParams({ page: String(page), limit: '25', search: query, certificateFilter: filter });
const data = await parseAuthJson<PaginatedResponse<EventRegistration>>(res, setLoadError);
setRegistrations(data?.data ?? []);
setTotalPages(data?.totalPages ?? 0);
```

Manter parse legado para outras chamadas. Filtro/busca/página controlados no `CheckinApp`; `CertificateCenter` limpa seleção quando os registros mudam e informa “nesta página”.

- [x] **Step 4: Implementar 202, progresso e polling**

```tsx
if (document.visibilityState !== 'visible' || !batchId || terminal) return;
const timer = window.setInterval(loadBatch, 5000);
return () => window.clearInterval(timer);
```

Usar `<progress aria-label="Progresso dos convites" max={total} value={done} />` e `role="status"`. Recarregar inscrições ao concluir; erro de consulta oferece retry manual.

- [x] **Step 5: Verificar e commit**

Run: `cd frontend && npx vitest run src/components/islands/admin/checkin/__tests__/checkin.test.tsx && npm run check`
Commit: `feat(eventos): acompanha convites em fila`

### Task 7: E2E no dump, documentação e PR

**Files:**
- Create: `backend/test/certificate-invite-queue.e2e-spec.ts`
- Create: `docs/adrs/016-certificate-invite-queue.md`
- Modify: `docs/modules/events/CODE_MANUAL.md`, `docs/modules/privacy/treatments.md`
- Modify: `DEVELOPMENT.md`, `AGENTS.md`, `docs/README.md`

**Interfaces:**
- Jornada real: enqueue 202 → worker → sent/completed; 421 → retry; nova tentativa → completed; legacy arrays preservados.

- [x] **Step 1: Escrever e rodar E2E em dump isolado**

```ts
const before = await dataSource.query("SELECT status, COUNT(*) FROM email_logs WHERE template = 'certificate-pending-registration' GROUP BY status");
const response = await request(app.getHttpServer()).post('/events/certificate-invites/batch').set(as('admin')).send({ registrationIds: [registration.id] }).expect(202);
await queue.processNextJob();
expect(response.body.status).toBe('queued');
expect(afterSent).toBe(beforeSent + 1);
```

Restaurar o dump atual em `codaqui_certificate_queue_test`; validar 28 sent/90 failed preservados antes/depois, migration down/up e provider mockado para 421→sucesso. Remover fixtures e banco.

- [x] **Step 2: Rodar gates completos**

Run: `cd backend && npm run build && npx jest --silent`
Run: `npm run test:scripts`
Run: `make astro-verify && make astro-verify-tenants`

- [x] **Step 3: Documentar e commit**

Registrar ADR 016 com evidências do dump (28/90/130), contratos, limitação exactly-once, rate limit, retries, rollout e privacidade. Atualizar manual, inventário, runbook e guia principal.
Commit: `docs(eventos): registra fila de convites e handoff`

- [x] **Step 4: Abrir PR para develop e apresentar integração**

Concluído: PR #620 integrada e fila publicada em `v0.19.0-backend`; serialização global ampliada em `v0.23.0-backend`. Não reenviar históricos automaticamente.
