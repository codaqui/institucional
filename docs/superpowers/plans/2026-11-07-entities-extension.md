<!-- AGENT-INDEX
purpose: Plano executável da Fase 4 — entidades, parcerias, projetos de extensão, participantes, horas e comprovantes.
audience: Implementers e revisores da Fase 4.
status: Fase 4 e adendo de certificação desacoplada implementados na PR #617; merge, release 0.16.0 e validação pública aguardam comando explícito.
sections:
  - Constraints
  - Tasks 1–10
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-06-entities-extension-design.md — design aprovado
  - docs/plans/codaqui-1-0/cadastro-projeto-extensao.md — catálogo funcional
agent-protocol:
  - Executar em ordem com TDD e revisão entre tasks; Fase 4b e posteriores ficam fora.
-->

# Entities and Extension Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a jornada entidade → parceria → projeto → mentor → inscrição → horas → aprovação → finalização → comprovante, preservando a vitrine open source.

**Architecture:** NestJS/TypeORM recebe `entities` e `projects`; designations identificam o mentor principal e `hour_ledger` registra horas. Astro consome snapshots públicos, preserva `/projetos` e adiciona ilhas para inscrição, membro, mentor e admin.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Astro 7, React 19, MUI 9, Vitest 3, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-06-entities-extension-design.md`

## Global Constraints

- Backend `0.16.0`; migrations 037–041 na mesma release; Fases 4b–7 fora do escopo. O adendo de certificação desacoplada está em `docs/superpowers/plans/2026-11-09-checkin-certificate-decoupling.md`.
- Diretoria global tem `communityId=NULL`; assembleia pertence a uma entidade jurídica e numera por `entityId + type`.
- URLs novas de assembleias usam `/assembleias/<entitySlug>/<type>-<number>`; `/assembleias/*` redireciona para a Codaqui.
- Campanhas/malas diretas ficam em spec própria, fora deste plano.
- Orçamento é descritivo e nunca chama `LedgerService`; horas usam exclusivamente `hour_ledger`.
- Mentor principal é designation `mentor @ extension_project`; não criar `mentorMemberId`.
- Rascunho mínimo: `name + entityId`; projeto completo usa `draft → proposed → active → finished/canceled`.
- Inscrição e horas são transacionais; `pending + approved <= totalHours`; retry não duplica `idempotencyKey`.
- `/projetos` preserva open source; dados novos usam `/projects/` na API e `static/projects/index.json` no snapshot.
- APIs novas sem `/admin/`; listagens administrativas usam o envelope e `PaginationControls` compartilhados.
- `internalNotes`, IDs internos de atores, e-mails, aprovações e idempotency keys nunca são públicos.
- MUI 9/tokens `--cq-*`, zero hex solto, acessibilidade, testes e revisão por task. Dados de teste sempre sintéticos.

---

### Task 1: Entidades, parcerias e migration 037

**Files:**
- Create: `backend/src/entities/entities.module.ts`, `entities.controller.ts`, `entities.service.ts`
- Create: `backend/src/entities/entities.service.spec.ts`, `entities.controller.spec.ts`
- Create: `backend/src/entities/entities.rules.ts`, `entities.rules.spec.ts`
- Create: `backend/src/entities/entities.migration.spec.ts`
- Create: `backend/src/entities/entities/{institution.entity,partnership.entity}.ts`
- Create: `backend/src/entities/dto/{institution.dto,partnership.dto}.ts`
- Create: `backend/src/migrations/1794300000000-Migration037_EntitiesPartnerships.ts`
- Modify: `backend/src/app.module.ts`, `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- `EntitiesService.create(dto, actor)`, `.update(id, dto, actor)`, `.listManage(query)`, `.listPublic()`.
- `EntitiesService.createPartnership(entityId, dto, actor)`, `.updatePartnership(id, dto, actor)`, `.listPartnerships(entityId)`.
- Método interno `assertDirector(actor): Promise<void>` aceita admin ou designation ativa de diretor usando `DesignationsService`.

- [x] **Step 1: Write failing entity, authorization and migration tests**

```ts
it('rejects partnership dates in reverse order', () => {
  expect(() => assertPartnershipDates({ startedAt: '2026-02-01', endsAt: '2026-01-01' }))
    .toThrow(BadRequestException);
});

it('requires an active director to create an entity', async () => {
  await expect(service.create(baseEntity, memberActor)).rejects.toThrow(ForbiddenException);
});
```

Migration assertions must cover `entities`, `partnerships`, unique `slug`, FKs and down dropping both tables. Creation derives a unique slug from the entity name for public assembly routes.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/entities --runInBand`
Expected: FAIL because module/rules/migration do not exist.

- [x] **Step 3: Implement entities, partnerships and paginated API**

```ts
async createPartnership(entityId: string, dto: PartnershipInput, actor: JwtPayload) {
  await this.assertDirector(actor);
  assertPartnershipDates(dto);
  const entity = await this.repo.findOneByOrFail({ id: entityId, isActive: true });
  return this.partnerships.save(this.partnerships.create({ ...dto, entityId: entity.id }));
}
```

Implement public projections without `contactEmail`/`registeredById`; DTO query uses default 50/cap 100. Bump only backend version to `0.16.0`.

- [x] **Step 4: Run focused tests and backend build**

Run: `cd backend && npx jest src/entities --runInBand && npm run build`
Expected: PASS and Nest build exit 0.

- [x] **Step 5: Commit**

`git add backend && git commit -m "feat(fase-4): adiciona entidades e parcerias"`

### Task 2: Projeto, participantes, regras e migration 038

**Files:**
- Create: `backend/src/projects/entities/{extension-project.entity,project-participant.entity}.ts`
- Create: `backend/src/projects/dto/{project.dto,project-query.dto}.ts`
- Create: `backend/src/projects/project.rules.ts`, `project.rules.spec.ts`, `project.migration.spec.ts`
- Create: `backend/src/migrations/1794310000000-Migration038_ExtensionProjects.ts`

**Interfaces:**
- `normalizeProjectName(name): string`, `projectSlug(name): string`.
- `hoursToCents(value: number): number` converte para centésimos e é reutilizado pelas horas.
- `assertScheduleMatches(schedule, totalHours): void` valida em centésimos.
- `assertProjectComplete(project): void` exige todos os campos para `proposed/active`.
- `assertProjectDates(project): void` aplica período e inscrição.

- [x] **Step 1: Write failing domain and migration tests**

```ts
expect(normalizeProjectName('  Ação   Extensão ')).toBe('acao extensao');
expect(() => assertScheduleMatches([{ carga: 0.1 }, { carga: 0.2 }], 0.31)).toThrow();
expect(() => assertScheduleMatches([{ carga: 0.1 }, { carga: 0.2 }], 0.3)).not.toThrow();
```

Migration assertions cover nullable draft fields, unique `normalizedName`/`slug`, active participant uniqueness and one active mentor designation per project.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/projects/project.rules.spec.ts src/projects/project.migration.spec.ts --runInBand`
Expected: FAIL because files do not exist.

- [x] **Step 3: Implement rules, entities and migration**

```ts
export const hoursToCents = (value: number) => Math.round(value * 100);
export function assertScheduleMatches(schedule: ScheduleItem[], totalHours: number) {
  if (schedule.reduce((sum, item) => sum + hoursToCents(item.carga), 0) !== hoursToCents(totalHours)) {
    throw new BadRequestException('A soma dos encontros deve ser igual à carga horária total.');
  }
}
```

Validate ODS, attachments, budget arithmetic and name/slug normalization. Do not add mentor columns or `cities`.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/projects/project.rules.spec.ts src/projects/project.migration.spec.ts --runInBand`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src/projects backend/src/migrations && git commit -m "feat(fase-4): adiciona modelo de projetos de extensão"`

### Task 3: API de projetos, lifecycle, mentor e auditoria

**Files:**
- Create: `backend/src/projects/projects.module.ts`, `projects.controller.ts`, `projects.service.ts`
- Create: `backend/src/projects/projects.service.spec.ts`, `projects.controller.spec.ts`
- Create: `backend/src/projects/project-lifecycle.ts`, `project-lifecycle.spec.ts`
- Create: `backend/src/common/discussion-url.ts`, `backend/src/common/discussion-url.spec.ts`
- Create: `backend/src/notifications/project-email.ts`, `project-email.spec.ts`
- Modify: `backend/src/notifications/email.service.ts`, `email-template.service.ts`, `notifications.module.ts`
- Modify: `backend/src/assemblies/assembly.rules.ts`
- Modify: `backend/src/audit/{audit-category.ts,entities/audit-log.entity.ts}` e testes
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- `ProjectsService.create(dto, actor)`, `.update(id, dto, actor)`, `.listManage(query)`, `.listPublic()`, `.publicBySlug(slug)`.
- `assertProjectTransition(project, dto, actor, activeMentor): void` aplica ownership, mentor e relatório.
- `EmailService.sendProjectEmail({template,to,memberName,projectName,projectId,hours?,reason?}): Promise<EmailLog>`.
- `assertDiscussionUrl(value): string` compartilhado por projetos e assembleias.

- [x] **Step 1: Write failing lifecycle, mentor and public projection tests**

```ts
await expect(service.update(project.id, { status: 'active' }, otherDirector)).rejects.toThrow(ForbiddenException);
await expect(service.update(project.id, { status: 'finished', reportDiscussionUrl }, mentorActor)).resolves.toMatchObject({ status: 'finished' });
expect(publicProject).not.toHaveProperty('internalNotes');
expect(publicProject).not.toHaveProperty('createdById');
```

Also test mentor replacement ending the previous designation and this exact notification call writing an email log:

```ts
await email.sendProjectEmail({
  template: 'project_mentor_assigned', to: 'mentor@example.test',
  memberName: 'Mentor Sintético', projectName: 'Projeto Sintético', projectId: 'project-1',
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/projects src/notifications/project-email.spec.ts src/common/discussion-url.spec.ts --runInBand`
Expected: FAIL because service/routes/template do not exist.

- [x] **Step 3: Implement transactional lifecycle and mentor designation**

```ts
const project = await manager.getRepository(ExtensionProject).findOneOrFail({
  where: { id }, lock: { mode: 'pessimistic_write' },
});
const activeMentor = await manager.getRepository(MemberDesignation).findOne({
  where: { targetType: 'extension_project', targetId: id, designation: 'mentor', status: 'active' },
});
assertProjectTransition(project, dto, actor, activeMentor);
// Replacement: end old mentor + grant new mentor + save participant links in this transaction.
```

Keep `internalNotes` out of public projections. Add generic project templates and call mentor notification after commit; SMTP failure remains logged. Extract Discussion validation without changing assembly behavior.

- [x] **Step 4: Run focused backend tests**

Run: `cd backend && npx jest src/projects src/notifications src/common src/assemblies src/audit --runInBand --silent`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src && git commit -m "feat(fase-4): adiciona lifecycle e mentoria de projetos"`

### Task 4: Inscrições com limite transacional

**Files:**
- Create: `backend/src/projects/participants.controller.ts`, `participants.service.ts`, `participants.service.spec.ts`
- Modify: `backend/src/projects/projects.module.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts` se uma ação nova for necessária

**Interfaces:**
- `ParticipantsService.join(projectId, actor)`, `.leave(projectId, actor)`, `.remove(projectId, memberId, actor)`, `.myProjects(actor)`.
- Routes `POST /projects/:id/join|leave`, `DELETE /projects/:id/participants/:memberId`, `GET /projects/my`.

- [x] **Step 1: Write failing participation tests**

```ts
await expect(service.join(fullProject.id, member)).rejects.toThrow(ConflictException);
await service.join(project.id, member);
await expect(service.join(project.id, member)).rejects.toThrow(ConflictException);
await service.leave(project.id, member);
await expect(service.join(project.id, member)).resolves.toMatchObject({ leftAt: null });
```

Cover closed window, mentor attempting participant join, idempotent leave and director removal audit.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/projects/participants.service.spec.ts --runInBand`
Expected: FAIL because service does not exist.

- [x] **Step 3: Implement lock, count and membership writes**

```ts
const project = await projectRepo.findOneOrFail({ where: { id: projectId }, lock: { mode: 'pessimistic_write' } });
const count = await participantRepo.count({ where: { projectId, role: 'participant', leftAt: IsNull() } });
if (project.maxParticipants > 0 && count >= project.maxParticipants) throw new ConflictException('Vagas esgotadas.');
```

Revive a prior row by clearing `leftAt` or insert a new active row. Send confirmation only after commit.

- [x] **Step 4: Run project tests**

Run: `cd backend && npx jest src/projects --runInBand --silent`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src/projects backend/src/audit && git commit -m "feat(fase-4): adiciona inscrições em projetos"`

### Task 5: Horas de projeto com idempotência e revisão

**Files:**
- Create: `backend/src/projects/dto/project-hour.dto.ts`, `project-hour.dto.spec.ts`
- Create: `backend/src/projects/project-hours.controller.ts`, `project-hours.controller.spec.ts`
- Modify: `backend/src/hours/hours.service.ts`, `hours.service.spec.ts`, `hours.module.ts`
- Modify: `backend/src/projects/projects.module.ts`

**Interfaces:**
- `HoursService.recordExtensionProjectEntry(projectId, dto, actor): Promise<HourEntry>`.
- `HoursService.updateExtensionProjectEntry(projectId, hourId, dto, actor): Promise<HourEntry>`.
- DTO create: `{memberId,hours,occurredAt,description,idempotencyKey}`; update omits member/key.

- [x] **Step 1: Write failing hour tests**

```ts
await service.recordExtensionProjectEntry(project.id, twoHours, mentor);
await expect(service.recordExtensionProjectEntry(project.id, twoHours, mentor)).rejects.toThrow(ConflictException);
await expect(service.recordExtensionProjectEntry(project.id, aboveTotal, mentor)).rejects.toThrow(ConflictException);
expect(entry).toMatchObject({ sourceType: 'extension_project', status: 'pending', reportedById: mentor.sub });
```

Cover co-mentor 403, mentor self-entry, pending-only edit and review notifications for approve/reject.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/hours/hours.service.spec.ts src/projects/project-hours.controller.spec.ts --runInBand`
Expected: FAIL because methods/routes do not exist.

- [x] **Step 3: Implement transactional hour creation and pending edit**

```ts
const locked = await projectRepo.findOneOrFail({ where: { id: projectId }, lock: { mode: 'pessimistic_write' } });
const used = await hourRepo.sum('hours', { memberId: dto.memberId, sourceType: 'extension_project', sourceId: projectId, status: In(['pending', 'approved']) });
if (hoursToCents(used ?? 0) + hoursToCents(dto.hours) > hoursToCents(locked.totalHours)) throw new ConflictException('Carga horária do projeto excedida.');
```

Use existing unique idempotency protection. Send approve/reject email after status mutation, using `sourceLabel` and member data.

- [x] **Step 4: Run backend tests and build**

Run: `cd backend && npx jest src/hours src/projects --runInBand --silent && npm run build`
Expected: PASS and build exit 0.

- [x] **Step 5: Commit**

`git add backend/src && git commit -m "feat(fase-4): integra horas de projetos ao ledger"`

### Task 6: Comprovantes idempotentes e migration 039

**Files:**
- Create: `backend/src/projects/entities/project-certificate.entity.ts`
- Create: `backend/src/projects/project-certificates.controller.ts`, `project-certificates.service.ts`, `project-certificates.service.spec.ts`
- Create: `backend/src/migrations/1794320000000-Migration039_ProjectCertificates.ts`
- Modify: `backend/src/projects/projects.module.ts`

**Interfaces:**
- `ProjectCertificatesService.issue(projectId, kind, actor)`, `.verify(code)`, `.owned(code, actor)`.
- `approvedHours(projectId, memberId): Promise<number>` soma somente horas `approved` para a emissão.
- Routes defined exactly as the spec under `/project-certificates`.

- [x] **Step 1: Write failing issuance and privacy tests**

```ts
const first = await service.issue(project.id, 'participant', member);
const second = await service.issue(project.id, 'participant', member);
expect(second.code).toBe(first.code);
expect(second.hoursAtIssue).toBe(first.hoursAtIssue);
await expect(service.verify(first.code)).resolves.not.toHaveProperty('memberId');
```

Cover unfinished project, zero approved hours, non-owner 403 and mentor report.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/projects/project-certificates.service.spec.ts src/projects/project.migration.spec.ts --runInBand`
Expected: FAIL because certificate service/table do not exist.

- [x] **Step 3: Implement migration and idempotent issuance**

```ts
const existing = await repo.findOne({ where: { projectId, memberId, kind } });
if (existing) return existing;
const hoursAtIssue = await this.approvedHours(projectId, memberId);
const code = `PRJ-${randomUUID()}`;
return repo.save(repo.create({ projectId, memberId, kind, code, hoursAtIssue, issuedAt: new Date(), createdById: actor.sub }));
```

Serialize conflicting issuance with the unique index and return the existing row on `23505`. Notify final documents without rolling back state on SMTP failure.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/projects --runInBand --silent`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src && git commit -m "feat(fase-4): emite comprovantes de projetos"`

### Task 7: Diretorias comunitárias e assembleias por entidade

**Files:**
- Create: `backend/src/migrations/1794330000000-Migration040_OrganizationalScopes.ts`
- Create: `backend/src/assemblies/assembly-scopes.migration.spec.ts`
- Modify: `backend/src/directorates/entities/directorate.entity.ts` e DTOs
- Modify: `backend/src/assemblies/entities/assembly.entity.ts`, DTOs, service e testes
- Modify: `backend/src/entities/entities.rules.ts`, DTOs e testes

**Interfaces:**
- `directorates.communityId: string | null`; `null` mantém diretoria global.
- `assemblies.entityId: string` é obrigatório na criação e imutável.
- Numeração e advisory lock usam `entityId + type`; detalhe público usa `entitySlug + slug`.
- Entidade Codaqui tem `slug='codaqui'`; outras entidades exigem admin ou `manager @ entity`.

- [x] **Step 1: Write failing scope, backfill and numbering tests**

```ts
await Promise.all([
  service.create({ ...baseAssembly, entityId: codaqui.id }, director),
  service.create({ ...baseAssembly, entityId: codaqui.id }, director),
]);
expect(assemblies.map((assembly) => assembly.number)).toEqual([1, 2]);
expect(publicAssembly.entity).toEqual({ slug: 'codaqui', name: 'Associação Codaqui' });
expect(publicAssembly).not.toHaveProperty('entityId');
```

Migration tests cover `directorates.communityId`, required `assemblies.entityId`, backfill Codaqui and unique `(entityId,type,number)` in up/down.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/assemblies src/directorates src/entities --runInBand`
Expected: FAIL because migration/scope does not exist.

- [x] **Step 3: Implement migration 040 and scoped authorization**

```ts
await queryRunner.query(`ALTER TABLE "directorates" ADD "communityId" uuid`);
await queryRunner.query(`ALTER TABLE "assemblies" ADD "entityId" uuid`);
// Seed/reuse Associação Codaqui, backfill and only then make entityId required.
await queryRunner.query(`DROP INDEX "UQ_assemblies_type_number"`);
await queryRunner.query(`CREATE UNIQUE INDEX "UQ_assemblies_entity_type_number" ON "assemblies" ("entityId", "type", "number")`);
```

Use `pg_advisory_xact_lock(hashtext(entityId || ':' || type))`, preserve Codaqui authorization and require `manager @ entity` for other umbrellas. Keep `entityId` out of public payloads and expose only `entity: {slug,name}`.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/assemblies src/directorates src/entities --runInBand --silent`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src && git commit -m "feat(fase-4): vincula diretorias e assembleias às organizações"`

### Task 8: Snapshot, proxy e páginas públicas

**Files:**
- Create: `scripts/sync-projects.mjs`, `sync-projects.test.mjs`, `.github/workflows/sync-projects.yml`
- Create: `static/projects/index.json`
- Create: `frontend/src/data/projects-extension.ts`, `projects-extension.test.ts`
- Create: `frontend/src/pages/projetos/[slug].astro`, `frontend/src/pages/projetos/comprovante.astro`
- Create: `frontend/src/components/islands/projects/{ProjectRegistrationIsland,ProjectCertificateVerificationIsland}.tsx` e testes
- Move: `frontend/src/pages/assembleias/[slug].astro` → `frontend/src/pages/assembleias/[entitySlug]/[slug].astro`
- Modify: `frontend/src/pages/projetos.astro`, `frontend/scripts/copy-snapshots.mjs`
- Modify: `frontend/src/data/assemblies.ts` e `assemblies.test.ts`
- Modify: `scripts/sync-assemblies.mjs` e `sync-assemblies.test.mjs`
- Modify: `frontend/scripts/build-tenant-redirects.mjs` e teste
- Modify: `frontend/src/lib/api-proxy-paths.ts`, `api-proxy-paths.test.ts`, `package.json`, `Makefile`

**Interfaces:**
- `syncProjects({apiUrl,outputFile,now,fetchImpl,renameImpl})`.
- `validateProjectsPayload(payload): PublicProject[]` valida a coleção inteira antes de escrever.
- `loadProjectsIndex(): {generatedAt,projects}`, `projectPath(project): '/projetos/<slug>'`.
- `assemblyPath(assembly): '/assembleias/<entitySlug>/<type>-<number>'`; redirect legado `/assembleias/* → /assembleias/codaqui/*`.
- Registration island calls `POST /projects/:id/join|leave` via `authFetch`.

- [x] **Step 1: Write failing sync, proxy and public UI tests**

```js
await assert.rejects(syncProjects({ outputFile, fetchImpl: async () => jsonResponse({}, 503) }));
assert.equal(await readFile(outputFile, 'utf8'), previous);
```

```tsx
expect(loadProjectsIndex().projects[0]).not.toHaveProperty('internalNotes');
expect(projectPath(project)).toBe('/projetos/acao-extensao');
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/sync-projects.test.mjs && cd frontend && npx vitest run src/data/projects-extension.test.ts src/lib/api-proxy-paths.test.ts src/components/islands/projects`
Expected: FAIL because files/contracts do not exist.

- [x] **Step 3: Implement atomic snapshot and public journeys**

```js
const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/projects/public`);
const projects = validateProjectsPayload(await response.json());
await writeFile(temporaryFile, `${JSON.stringify({ generatedAt: now().toISOString(), projects }, null, 2)}\n`);
```

Keep open source cards in `/projetos`; generate extension detail pages, registration island and certificate verification by query code. Add daily 06:29 UTC workflow and narrow proxy exceptions.

- [x] **Step 4: Run frontend/scripts checks**

Run: `npm run test:scripts && cd frontend && npm run check && npm run test`
Expected: PASS.

- [x] **Step 5: Commit**

`git add scripts static .github frontend package.json Makefile && git commit -m "feat(fase-4): publica vitrine e inscrições de projetos"`

### Task 9: Admin, membro e mentor

**Files:**
- Create: `frontend/src/pages/admin/{entidades,projetos}.astro`
- Create: `frontend/src/components/islands/admin/entities/EntitiesAdminApp.tsx` e teste
- Create: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx` e teste
- Create: `frontend/src/components/islands/projects/MemberProjectsIsland.tsx`, `MentorProjectsIsland.tsx` e testes
- Modify: `frontend/src/components/islands/AppNavIsland.tsx` e teste
- Modify: `frontend/src/components/islands/admin/assemblies/AssembliesAdminApp.tsx` e teste
- Modify: `frontend/src/components/islands/admin/directorates/DirectoratesAdminApp.tsx` e teste
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/member/__tests__/member-dashboard.test.tsx`

**Interfaces:**
- Admin uses `EntitiesService`/`ProjectsService` endpoints through `authFetch` and shared pagination.
- Assembly form/filter uses `entityId`; directorate form/filter uses nullable `communityId`.
- Mentor hour form emits `{memberId,hours,occurredAt,description,idempotencyKey: crypto.randomUUID()}`.
- Member page exposes own certificates; admin/director/mentor visibility follows API errors, never client-only authorization.

- [x] **Step 1: Write failing admin and member journey tests**

```tsx
await user.click(screen.getByRole('button', { name: /nova entidade/i }));
await user.type(screen.getByLabelText(/nome/i), 'Entidade sintética');
await user.click(screen.getByRole('button', { name: /salvar/i }));
expect(postBody).toMatchObject({ name: 'Entidade sintética' });
```

Cover draft/complete project, director without owner transition 403, mentor hours/finalization and member declaration download.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/entities src/components/islands/admin/projects src/components/islands/projects`
Expected: FAIL because islands do not exist.

- [x] **Step 3: Implement accessible MUI journeys**

```tsx
const response = await authFetch(`${apiUrl}/projects/${project.id}/hours`, {
  method: 'POST', body: JSON.stringify({ ...form, idempotencyKey: crypto.randomUUID() }),
});
```

Use `Alert`, `PaginationControls`, accessible dialogs, tokens and no new admin API prefix. Add navigation under Governança and member/mentor sections.

- [x] **Step 4: Run frontend checks**

Run: `cd frontend && npm run check && npm run test`
Expected: PASS.

- [x] **Step 5: Commit**

`git add frontend && git commit -m "feat(fase-4): adiciona gestão de projetos e horas"`

### Task 10: Migração real, concorrência, E2E e handoff

**Files:**
- Create: `docs/adrs/008-entities-extension-projects.md`
- Modify: `docs/README.md`, `docs/plans/codaqui-1-0/README.md`, `AGENTS.md`, `DEVELOPMENT.md`
- Modify: `docs/superpowers/specs/2026-11-06-entities-extension-design.md` somente se uma decisão real mudar

**Interfaces:**
- PostgreSQL descartável com dump real, migrations 037–040 e fixtures sintéticas removidas ao final.
- Handoff registra release `v0.16.0-backend`, redeploy, sync inicial e validação pública como etapas separadas.

- [x] **Step 1: Validate migration down/up and data preservation**

Run migrations through 040, revert to 036 and reapply to 040 on a disposable copy. Assert existing members, communities and assemblies survive and all new constraints exist. Validado com 174 membros, 6 comunidades e uma assembleia sintética com backfill Codaqui; fixtures removidas.

- [x] **Step 2: Validate real concurrency and E2E**

Run two joins for the last slot, repeated hour idempotency, concurrent certificate issuance and concurrent creation of assemblies with distinct numbers per entity. Exercise the complete director → mentor → participant → finance-analyzer journey and the legacy assembly redirect. Remove every fixture. E2E PostgreSQL e redirect por entidade verificados; fixtures zeradas.

- [x] **Step 3: Run all gates**

```bash
cd backend && npm run build && npx jest --silent
cd .. && npm run test:scripts
make astro-verify
make astro-verify-tenants
```

Expected: zero failures; restore any generated snapshots not belonging to the implementation. Resultado: 1.220 testes backend, 894 frontend, 80 scripts e todos os builds verdes.

- [x] **Step 4: Update living docs and commit**

Record ADR 008, exact API/permissions, privacy, operations, migration evidence and remaining release steps.

`git add docs AGENTS.md DEVELOPMENT.md && git commit -m "docs(fase-4): registra ADR 008 e handoff 0.16.0"`

- [x] **Step 5: Present integration state**

Merge local into `develop`, open PR to `main`, watch CI/Sonar and resolve review findings. Do not merge/release/deploy without the user's explicit command at that checkpoint. PR #617 aberta, CI e deploys verdes, CodeQL/Trivy aprovados e zero issues abertas no Sonar.
