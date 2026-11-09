<!-- AGENT-INDEX
purpose: Plano executável da Fase 4b — Codaqui Universitário, cidades, IES, embaixadores e eventos.
audience: Implementers e revisores da próxima PR.
status: Implementado e verificado; PR #618 aberta para main; merge/release 0.17.0, sync inicial e validação pública pendentes de comando explícito.
sections:
  - Global Constraints
  - Tasks 1–8
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-09-codaqui-universitario-design.md — design aprovado
agent-protocol:
  - Executar em ordem com teste antes de cada mudança e commit por task.
  - Não criar tabelas paralelas de IES, embaixadores ou eventos.
-->

# Codaqui Universitário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar cidades, IES, candidatura/confirmação de embaixadores e eventos nas instituições, reutilizando entidades, designations, eventos, certificados e horas atuais.

**Architecture:** Um `UniversitiesModule` orchestrates cidades/IES/candidaturas e projeções públicas. `entities`, `member_designations` e `managed_events` recebem vínculos aditivos; `EventsService` valida IES/permissão sem importar o módulo novo, evitando dependência circular. Astro consome snapshot e ilhas para público, candidatura e administração.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Node 24, Astro 7, React 19, MUI 9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-09-codaqui-universitario-design.md`

## Global Constraints

- Backend **0.17.0**, migration **042**, trabalho em `develop`; merge/release/deploy somente por comando explícito.
- Não criar tabelas paralelas de IES, embaixadores ou eventos; usar `entities`, `member_designations` e `managed_events`.
- Um embaixador ativo por IES e uma candidatura pendente por membro/IES, com unicidade no banco e tratamento transacional.
- Gestor avalia; somente admin confirma. Embaixador cria evento somente na própria IES ativa e válida.
- APIs administrativas sem `/admin/`; listagens seguem `pagination.ts` + `PaginationControls`.
- Snapshot sem e-mail, motivação, candidaturas ou IDs de atores. Motivação só para gestor/admin e próprio candidato.
- Preservar inscrição, guest claim, check-in, concessão de certificado, `hour_ledger` exactly-once e `profileVisibility`.
- MUI 9/tokens `--cq-*`, zero hex solto, acessibilidade, testes antes de cada mudança e fixtures sintéticas removidas.

---

### Task 1: Migration 042 e contrato de dados

**Files:**
- Create: `backend/src/universities/entities/city.entity.ts`
- Create: `backend/src/universities/universities.migration.spec.ts`
- Create: `backend/src/migrations/1794400000000-Migration042_CodaquiUniversitario.ts`
- Modify: `backend/src/entities/entities/institution.entity.ts`
- Modify: `backend/src/events/entities/managed-event.entity.ts`
- Modify: `backend/src/designations/entities/member-designation.entity.ts`
- Modify: `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- `City { id, name, uf, isActive, createdAt, updatedAt }`.
- `Institution.cityId: string | null`, `ManagedEvent.institutionId: string | null`.
- `MemberDesignation.validUntil: Date | null`, `applicationNotes: string | null`.

- [x] **Step 1: Escrever teste da migration e da entidade City**

```ts
expect(upSql).toContain('CREATE TABLE "cities"');
expect(upSql).toContain('ALTER TABLE "entities" ADD "cityId" uuid');
expect(upSql).toContain('ALTER TABLE "managed_events" ADD "institutionId" uuid');
expect(upSql).toContain('ALTER TABLE "member_designations" ADD "validUntil" TIMESTAMPTZ');
expect(upSql).toContain('ALTER TABLE "member_designations" ADD "applicationNotes" text');
expect(upSql).toContain("status = 'active' AND \"designation\" = 'ambassador'");
expect(downSql).toContain('DROP TABLE IF EXISTS "cities"');
```

- [x] **Step 2: Rodar teste e confirmar falha**

Run: `cd backend && npx jest src/universities/universities.migration.spec.ts --runInBand`
Expected: migration inexistente.

- [x] **Step 3: Implementar entidades e migration**

```ts
await queryRunner.query('ALTER TABLE "entities" ADD "cityId" uuid');
await queryRunner.query('ALTER TABLE "managed_events" ADD "institutionId" uuid');
await queryRunner.query('ALTER TABLE "member_designations" ADD "validUntil" TIMESTAMPTZ');
await queryRunner.query('ALTER TABLE "member_designations" ADD "applicationNotes" text');
await queryRunner.query('CREATE UNIQUE INDEX "UQ_university_one_active_ambassador" ON "member_designations" ("targetType", "targetId", "designation") WHERE "targetType" = \'ies\' AND "designation" = \'ambassador\' AND "status" = \'active\'');
```

Antes do índice, consultar duplicidades ativas e falhar com os IDs envolvidos. Adicionar FKs `ON DELETE RESTRICT`, índice por `institutionId`, unique pendente por membro/IES e `UQ_cities_name_uf`. Bump para `0.17.0`.

- [x] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/universities/universities.migration.spec.ts src/designations --runInBand && npm run build`
Commit: `feat(fase-4b): adiciona vínculos do Codaqui Universitário`

### Task 2: Cidades e IES com escopo do gestor

**Files:**
- Create: `backend/src/universities/dto/university.dto.ts`
- Create: `backend/src/universities/universities.module.ts`
- Create: `backend/src/universities/universities.controller.ts`
- Create: `backend/src/universities/universities.service.ts`
- Create: `backend/src/universities/universities.service.spec.ts`
- Create: `backend/src/universities/universities.controller.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`, `backend/src/audit/audit-category.spec.ts`

**Interfaces:**
- `assertUniversityManager(actor): Promise<void>` aceita admin ou `manager @ program('universitario')`.
- `createCity(dto, actor)`, `updateCity(id, dto, actor)`, `createInstitution(dto, actor)`, `updateInstitution(id, dto, actor)`.
- DTOs: `CityInput { name, uf, isActive? }`, `InstitutionInput { name, slug?, website?, contactEmail?, cityId, isActive? }`.

- [x] **Step 1: Escrever testes de autorização e vínculo**

```ts
await expect(service.createCity({ name: 'Maringá', uf: 'PR' }, memberActor))
  .rejects.toThrow(ForbiddenException);
await expect(service.createInstitution({ name: 'IES Exemplo', cityId: city.id }, managerActor))
  .resolves.toMatchObject({ type: 'instituicao_ensino', cityId: city.id });
await expect(service.createInstitution({ name: 'IES Exemplo', cityId: missingUuid }, managerActor))
  .rejects.toThrow(NotFoundException);
```

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd backend && npx jest src/universities --runInBand`
Expected: módulo/service inexistente.

- [x] **Step 3: Implementar módulo, service, DTOs e rotas**

```ts
private async assertUniversityManager(actor: JwtPayload) {
  if (actor.roles?.includes(MemberRole.ADMIN)) return;
  const allowed = await this.designations.hasDesignation(actor.sub, {
    targetType: 'program', targetKey: 'universitario', designation: 'manager',
  });
  if (!allowed) throw new ForbiddenException('Requer gestor do Universitário.');
}
```

Normalizar `name.trim()` e `uf.toUpperCase()`, validar cidade ativa, gerar slug com `entitySlug`, registrar `CITY_CREATED`, `CITY_UPDATED`, `UNIVERSITY_INSTITUTION_CREATED/UPDATED` em auditoria operacional. Registrar rotas `POST/PATCH /universities/cities` e `/institutions` com `JwtAuthGuard`.

- [x] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/universities src/audit/audit-category.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4b): gerencia cidades e IES`

### Task 3: Candidaturas e posse de embaixadores

**Files:**
- Modify: `backend/src/universities/dto/university.dto.ts`
- Modify: `backend/src/universities/universities.controller.ts`, `universities.service.ts`, specs
- Modify: `backend/src/designations/designations.service.ts`, `designations.service.spec.ts`

**Interfaces:**
- `applyAmbassador(institutionId, { applicationNotes }, actor)`.
- `listApplications(actor)`, `listMyApplications(actor)`, `rejectApplication(id, actor)`, `confirmApplication(id, { validUntil? }, actor)`.
- `GrantDesignationInput` aceita `validUntil?: Date`, `applicationNotes?: string`.

- [x] **Step 1: Escrever testes de candidatura, confirmação e validade**

```ts
const pending = await service.applyAmbassador(ies.id, { applicationNotes: 'Quero contribuir' }, candidate);
expect(pending).toMatchObject({ status: 'pending', targetType: 'ies', targetId: ies.id });
await expect(service.applyAmbassador(ies.id, { applicationNotes: 'De novo' }, candidate))
  .rejects.toThrow(ConflictException);
await expect(service.confirmApplication(pending.id, { validUntil: '2027-11-09' }, managerActor))
  .rejects.toThrow(ForbiddenException);
await expect(service.confirmApplication(pending.id, { validUntil: '2027-11-09' }, adminActor))
  .resolves.toMatchObject({ status: 'active', confirmedById: adminActor.sub });
```

Adicionar caso `validUntil` expirada não autoriza nem aparece na projeção pública.

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd backend && npx jest src/universities src/designations --runInBand`

- [x] **Step 3: Implementar fluxo transacional**

```ts
const designation = this.designationRepo.create({
  memberId: actor.sub, targetType: 'ies', targetId: institutionId,
  designation: 'ambassador', status: 'pending',
  appointedById: actor.sub, applicationNotes: dto.applicationNotes.trim(),
});
await this.designationRepo.save(designation);
```

Validar IES ativa e notas de 10–2000 caracteres. Rejeição usa `removed` + `endedAt`; confirmação exige admin, seta `confirmedById/confirmedAt` e validade opcional. Capturar `23505` como 409. `hasDesignation` inclui `(validUntil IS NULL OR validUntil > now())` sem afetar registros nulos. `GET /my` filtra pelo candidato; fila completa exige gestor.

- [x] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/universities src/designations --runInBand && npm run build`
Commit: `feat(fase-4b): adiciona candidaturas de embaixadores`

### Task 4: Managed events vinculados à IES

**Files:**
- Modify: `backend/src/events/dto/event.dto.ts`
- Modify: `backend/src/events/events.module.ts`
- Modify: `backend/src/events/events.service.ts`, `events.service.spec.ts`
- Modify: `backend/src/events/events.controller.spec.ts`

**Interfaces:**
- `CreateEventDto` e `UpdateEventDto` aceitam `institutionId?: string | null`.
- `assertInstitutionForEvent(actor, institutionId): Promise<void>` valida tipo e escopo.

- [x] **Step 1: Escrever testes de escopo e serialização**

```ts
await expect(service.createEvent({ ...baseEvent, institutionId: otherIes.id }, ambassador))
  .rejects.toThrow(ForbiddenException);
await expect(service.createEvent({ ...baseEvent, institutionId: ownIes.id }, ambassador))
  .resolves.toMatchObject({ institutionId: ownIes.id });
await expect(service.createEvent({ ...baseEvent, institutionId: ong.id }, adminActor))
  .rejects.toThrow(BadRequestException);
expect(publicEvent.institution).toEqual({ id: ownIes.id, slug: ownIes.slug, name: ownIes.name });
```

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events.controller.spec.ts --runInBand`

- [x] **Step 3: Implementar validação e projeção**

```ts
if (actor.roles?.includes(MemberRole.ADMIN)) return;
const ambassador = await this.designations.hasDesignation(actor.sub, {
  targetType: 'ies', targetId: institutionId, designation: 'ambassador',
});
if (!ambassador) throw new ForbiddenException('Embaixador ativo da IES é necessário.');
```

Injetar `Institution` em `EventsModule`; exigir entidade ativa `instituicao_ensino`. Organizer/admin preserva fluxo atual. Embaixador só na IES válida. Incluir resumo `institution` nas respostas públicas/snapshots, sem `registeredById` ou contato.

- [x] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events.controller.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4b): vincula eventos às IES`

### Task 5: Snapshot público e sincronização

**Files:**
- Modify: `backend/src/universities/universities.controller.ts`, `universities.service.ts`, specs
- Create: `scripts/sync-universities.mjs`, `scripts/sync-universities.test.mjs`
- Create: `static/universities/index.json` com `{ "generatedAt": null, "cities": [], "institutions": [], "events": [] }` como bootstrap vazio
- Modify: `package.json`, `Makefile`, `frontend/scripts/copy-snapshots.mjs`
- Create: `.github/workflows/sync-universities.yml`
- Modify: `frontend/src/lib/api-proxy-paths.ts`, `api-proxy-paths.test.ts`

**Interfaces:**
- `GET /universities/public` e `GET /universities/manage`.
- Snapshot `{ generatedAt, cities, institutions, events }` com projeção mínima da spec.
- `UNIVERSITIES_API_URL` no sync, default `http://localhost:3001`.

- [x] **Step 1: Escrever testes de projeção e sync atômico**

```ts
expect(publicPayload.institutions[0].ambassador).toEqual({
  githubHandle: 'ana', name: 'Ana', avatarUrl: 'avatar', validUntil: null,
});
expect(publicPayload.institutions[0]).not.toHaveProperty('applicationNotes');
expect(publicPayload).not.toHaveProperty('applications');
await runSync();
expect(readJson(tempSnapshot)).toEqual(previousSnapshot);
```

O último caso simula HTTP 500 e exige preservação do snapshot anterior.

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd backend && npx jest src/universities --runInBand && cd .. && node --test scripts/sync-universities.test.mjs`

- [x] **Step 3: Implementar projeção, sync e proxy**

```ts
const payload = {
  generatedAt: new Date().toISOString(),
  cities: cities.map(projectCity),
  institutions: institutions.map(projectInstitution),
  events: events.map(projectEvent),
};
await writeFileAtomic(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
```

Validar payload completo antes de gravar; erro não apaga dados. Adicionar exceção estática exata `/universities/index.json` antes do prefixo `/universities/` e testar que a página não vira proxy. Workflow diário 06:26 UTC + dispatch, sem incluir no agregador `npm run sync`.

- [x] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/universities --runInBand && cd .. && npm run test:scripts`
Commit: `feat(fase-4b): publica snapshot do Universitário`

### Task 6: Página pública e candidatura

**Files:**
- Create: `frontend/src/data/universities.ts`, `frontend/src/data/universities.test.ts`
- Create: `frontend/src/pages/universitario/index.astro`
- Create: `frontend/src/components/islands/universities/UniversityApplicationIsland.tsx`
- Create: `frontend/src/components/islands/universities/UniversityApplicationIsland.test.tsx`

**Interfaces:**
- `loadUniversitiesIndex()` lê `/universities/index.json` e valida o shape da spec.
- `UniversityApplicationIsland` recebe `institutions` e usa `resolveApiUrl`/`authFetch`.

- [x] **Step 1: Escrever testes de loader e candidatura**

```tsx
await user.selectOptions(screen.getByLabelText('Instituição'), 'ies-1');
await user.type(screen.getByLabelText('Motivação'), 'Quero apoiar o programa.');
await user.click(screen.getByRole('button', { name: 'Enviar candidatura' }));
expect(authFetch).toHaveBeenCalledWith('/universities/institutions/ies-1/ambassador-applications', expect.objectContaining({ method: 'POST' }));
expect(await screen.findByText(/candidatura registrada/i)).toBeInTheDocument();
```

Adicionar erro HTTP visível e loader rejeitando motivação/e-mail no snapshot.

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd frontend && npx vitest run src/data/universities.test.ts src/components/islands/universities`

- [x] **Step 3: Implementar página e ilha**

```tsx
const response = await authFetch(`/universities/institutions/${institutionId}/ambassador-applications`, {
  method: 'POST', body: JSON.stringify({ applicationNotes: motivation.trim() }),
});
```

Página pública mostra cidades/IES/embaixadores/eventos e CTA por IES. Usar `PublicLayout`, heading hierarchy, estado vazio e link de login com retorno. Motivação nunca aparece no snapshot.

- [x] **Step 4: Rodar testes e commit**

Run: `cd frontend && npm run check && npx vitest run src/data/universities.test.ts src/components/islands/universities`
Commit: `feat(fase-4b): abre página e candidatura do Universitário`

### Task 7: Admin do programa e atalho do embaixador

**Files:**
- Create: `frontend/src/pages/admin/universitario.astro`
- Create: `frontend/src/components/islands/admin/universities/UniversitiesAdminApp.tsx`
- Create: `frontend/src/components/islands/admin/universities/UniversitiesAdminApp.test.tsx`
- Modify: `frontend/src/components/islands/AppNavIsland.tsx`, `frontend/src/components/islands/__tests__/AppNavIsland.test.tsx`
- Modify: `frontend/src/components/islands/admin/eventos/EventosAdminApp.tsx` e seus testes existentes para aceitar `institutionId` da query string

**Interfaces:**
- `UniversitiesAdminApp` usa `useAuth`, `authFetch`, `parseAuthJson` e `extractErrorMessage`.
- Cards de cidades/IES/candidaturas, confirmação admin e rejeição gestor.
- Atalho `/admin/eventos?institutionId=<iesId>` para embaixador; o formulário de evento lê esse valor e o mantém oculto/imutável no envio.

- [x] **Step 1: Escrever testes de escopo e confirmação**

```tsx
await user.click(screen.getByRole('button', { name: 'Confirmar posse de Ana' }));
expect(authFetch).toHaveBeenCalledWith('/universities/ambassador-applications/pending-1/confirm', expect.objectContaining({ method: 'POST' }));
expect(screen.queryByRole('button', { name: 'Confirmar posse de Ana' })).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Criar evento na minha IES' })).toHaveAttribute('href', '/admin/eventos?institutionId=ies-1');
```

Testar gestor sem botão de confirmação, erro visível e lista paginada.

- [x] **Step 2: Rodar testes e confirmar falhas**

Run: `cd frontend && npx vitest run src/components/islands/admin/universities`

- [x] **Step 3: Implementar admin responsivo**

```tsx
<Button onClick={() => confirm(application)} disabled={!isAdmin || busy}>
  Confirmar posse de {application.member.name}
</Button>
<PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="candidaturas" />
```

Usar `.astro` fino + `AppLayout`, CRUD completo, motivação só na fila, alerts, cards MUI/tokens e paginação compartilhada. Atalho preserva institutionId no formulário de evento.

- [x] **Step 4: Rodar testes e commit**

Run: `cd frontend && npm run check && npx vitest run src/components/islands/admin/universities`
Commit: `feat(fase-4b): adiciona gestão do Universitário`

### Task 8: E2E real, ADR 015 e handoff

**Files:**
- Create: `backend/test/universities.e2e-spec.ts`
- Create: `docs/adrs/015-codaqui-universitario.md`
- Modify: `docs/plans/codaqui-1-0/README.md`, `AGENTS.md`, `DEVELOPMENT.md`
- Modify: `docs/modules/events/CODE_MANUAL.md`, `docs/modules/privacy/treatments.md`

**Interfaces:**
- Jornada real `manager → city → IES → candidate → admin confirm → ambassador event → registration → checkin/certificate/hours`.
- Migration 042 down/up preservando entities, eventos e designations.

- [x] **Step 1: Escrever e rodar E2E em dump isolado**

```ts
await request(app.getHttpServer()).post('/universities/cities').set(as('manager')).send({ name: 'Cidade E2E', uf: 'PR' }).expect(201);
await request(app.getHttpServer()).post(`/universities/institutions/${iesId}/ambassador-applications`).set(as('candidate')).send({ applicationNotes: 'Motivação sintética' }).expect(201);
await request(app.getHttpServer()).post(`/universities/ambassador-applications/${applicationId}/confirm`).set(as('admin')).send({}).expect(201);
expect(hourRows).toHaveLength(1);
```

Restaurar dump em `codaqui_universities_test` via Podman, validar duplicidades, down/up e rodar `DB_NAME=codaqui_universities_test npx jest --config ./test/jest-e2e.json --runInBand test/universities.e2e-spec.ts`. Limpar fixtures e remover o banco descartável.

- [x] **Step 2: Rodar gates completos**

Run: `cd backend && npm run build && npx jest --silent`
Run: `npm run test:scripts`
Run: `make astro-verify && make astro-verify-tenants`

- [x] **Step 3: Documentar e commit**

Registrar ADR 015, decisão de reúso, migration, contratos, snapshot, privacidade, operação e evidências. Marcar Fase 4b no plano Codaqui 1.0 sem apagar a publicação 0.16.0 pendente.
Commit: `docs(fase-4b): registra Universitário e handoff`

- [x] **Step 4: Atualizar PR e apresentar integração**

Push em `develop`, abrir/atualizar PR para `main`, acompanhar CI/Sonar/Copilot e corrigir apontamentos. Apresentar evidências e aguardar comando explícito para merge/release. Backend 0.17.0 requer publicação e migration 042 antes do frontend.
