<!-- AGENT-INDEX
purpose: Implementar hotfixes de disponibilidade, rascunho parcial e datas do Admin na release 1.14.1.
audience: Implementadores e revisores.
status: Aprovado para revisão antes da execução.
sections:
  - Global Constraints
  - Review Focus
  - Task 1
  - Task 2
  - Task 3
  - Task 4
  - Task 5
related-docs:
  - ../specs/2026-11-26-admin-operations-improvements-design.md — desenho aprovado e sequência das releases.
agent-protocol:
  - Executar com TDD; não abrir PR nem fazer deploy sem revisar o resultado e os gates.
-->

# Admin Hotfixes 1.14.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o erro ao salvar disponibilidade, preservar rascunhos completos ou parciais de Projetos e apresentar datas legíveis no Admin.

**Architecture:** `weekday` permanece somente na URL de disponibilidade. O frontend serializa campos opcionais de rascunho sem vazios artificiais; o backend aceita itens parciais somente em rascunho e reforça a validação completa em qualquer operação que produza ou mantenha um projeto não-rascunho.

**Tech Stack:** React 19, TypeScript, NestJS 11, class-validator, Vitest, Jest, PostgreSQL 18.

**Spec:** `docs/superpowers/specs/2026-11-26-admin-operations-improvements-design.md`

## Global Constraints

- `weekday` nunca entra no payload de `PUT /mentorship/availability/:weekday`; ele continua na leitura da API.
- Rascunho aceita campos incompletos, mas proposta/ativo exige os campos completos já definidos em `assertProjectComplete`.
- Nenhuma regra de permissão ou máquina de status muda.
- Datas do Admin usam `formatProjectPeriod`, com pt-BR e “A definir”, sem `null`.
- Frontend e backend usam 1.14.1 nos manifests e lockfiles; migration: nenhuma.
- Trabalho na `develop`, PR para `main` somente após gates e branch deployment; nenhum deploy sem autorização.

## Review Focus

- Rascunho com encontro, orçamento ou parceiro parcialmente preenchido: todos os valores informados persistem, sem exigir proposta completa; teste nas Tasks 2 e 3.
- Projeto proposto/ativo com item parcial: backend rejeita e não salva; teste na Task 2.
- Rascunho sem mentor: preserva mentoria vazia sem `mentorMemberId`; teste na Task 3.
- Disponibilidade com múltiplas janelas: PUT sem `weekday` e leitura com `weekday`; teste na Task 1.
- Período sem início/fim: interface mostra fallback legível e nunca `null`; teste na Task 4.

---

### Task 1: Disponibilidade semanal sem campo proibido

**Files:**
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx:275,332-339`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.test.tsx:133-142,339-376`

**Interfaces:**
- Produces: `saveAvailability(day: number, rules: Array<Omit<AvailabilityRule, "weekday">>)`; PUT contém somente `startTime`, `endTime`, `timeZone`.

- [ ] **Step 1: Confirm the completed RED→GREEN evidence**

A implementação atual já contém o teste alterado que falhava com `weekday` no corpo e passou após a correção. Confirmar que o mock deriva `weekday` da URL ao montar a leitura.

- [ ] **Step 2: Run the editor and real API verifications**

Run: `cd frontend && npx vitest run src/components/islands/mentorship/MentorDashboardIsland.test.tsx`
Expected: 18 testes PASS.

Run: `cd backend && DB_HOST=localhost DB_PORT=55456 DB_USER=codaqui DB_PASSWORD=test DB_NAME=codaqui_mentorship_test npm run test:e2e -- mentorship.e2e-spec.ts --runInBand`
Expected: 2 jornadas PASS; o banco descartável é removido ao final.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx frontend/src/components/islands/mentorship/MentorDashboardIsland.test.tsx
git commit -m "fix(mentoria): remove weekday do payload de disponibilidade"
```

### Task 2: Backend aceita rascunho parcial e protege não-rascunhos

**Files:**
- Modify: `backend/src/projects/dto/project.dto.ts:5-27`
- Modify: `backend/src/projects/projects.service.ts:153-192`
- Test: `backend/src/projects/dto/project.dto.spec.ts`
- Test: `backend/src/projects/projects.service.spec.ts`

**Interfaces:**
- Consumes: `assertProjectComplete(project)` de `project.rules.ts`.
- Produces: itens aninhados opcionais no DTO; toda operação cujo resultado seja `proposed` ou `active` em Extensão valida o objeto completo antes de `save`.

- [ ] **Step 1: Write failing service tests**

Criar `project.dto.spec.ts` com `plainToInstance` + `validate`, exigindo que um rascunho com schedule parcial, orçamento parcial e parceiro somente com CNPJ não tenha erros. Adicionar ao service:

```ts
it('persists every informed value in a partial draft', async () => {
  // POST com schedule [{ numero: 1, descricao: 'Encontro' }],
  // budget item { descricao: 'Material', valorUnitario: 10.5 }
  // e partner { cnpj: '12.345.678/0001-90' }.
  // Espera save com exatamente esses campos, sem exigir os demais.
});

it('rejects an incomplete proposed project before saving', async () => {
  // PATCH em projeto proposed com schedule parcial.
  // Espera BadRequestException e repository.save não chamado.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest --runInBand src/projects/dto/project.dto.spec.ts src/projects/projects.service.spec.ts`
Expected: o DTO rejeita o rascunho parcial e o teste de proposta falha por ausência de validação completa antes de `save`.

- [ ] **Step 3: Implement conditional completeness**

Tornar opcionais somente os campos aninhados que podem estar incompletos em rascunho (`ScheduleItemDto`, `BudgetItemDto`, `SupportPartnerDto`). Antes de salvar um projeto de Extensão cujo estado resultante seja `proposed` ou `active`, chamar `assertProjectComplete` com o objeto mesclado e o mentor atual. Rascunho não chama essa validação.

- [ ] **Step 4: Run backend projects tests**

Run: `cd backend && npx jest --runInBand src/projects src/projects/dto/project.dto.spec.ts`
Expected: todos os testes de Projetos PASS, incluindo os novos e as transições anteriores.

- [ ] **Step 5: Commit**

```bash
git add backend/src/projects/dto/project.dto.ts backend/src/projects/dto/project.dto.spec.ts backend/src/projects/projects.service.ts backend/src/projects/projects.service.spec.ts
git commit -m "fix(projetos): separa validação de rascunho e proposta"
```

### Task 3: Payload do rascunho preserva todos os valores informados

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/project-form.ts:292-365`
- Modify: `frontend/src/components/islands/admin/projects/project-form.test.ts:125-135,168-249`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx:132-179`

**Interfaces:**
- Consumes: DTO parcial da Task 2.
- Produces: `buildProjectPayload(values, status)` mantém strings e itens parciais; datas/números vazios são omitidos, nunca convertidos em `""`, `0` ou `NaN` artificiais; `mentorMemberId` aparece somente com mentor.

- [ ] **Step 1: Write failing payload tests**

Alterar o teste de rascunho sem mentor para exigir `summary`, datas, ODS, encontros e recursos sem `mentorMemberId`. Adicionar um teste com encontro parcial, item de orçamento parcial e parceiro somente com CNPJ, comparando o objeto exato e provando que campos não informados não geram valores artificiais.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/project-form.test.ts src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: FAIL porque o payload atual retorna somente `{name, entityId, status}` em rascunho.

- [ ] **Step 3: Implement complete draft serialization**

Reutilizar a montagem da proposta, incluindo cada campo informado em qualquer status. Para cada campo opcional, incluir a propriedade somente quando houver valor; em encontros/orçamento/parceiros, preservar propriedades parciais sem `Number()` de string vazia. `status === "proposed"` continua exigindo `validateProjectForm` no diálogo.

- [ ] **Step 4: Run frontend project tests**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/project-form.test.ts src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: todos os testes PASS, inclusive proposta e validações existentes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/admin/projects/project-form.ts frontend/src/components/islands/admin/projects/project-form.test.ts frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx
git commit -m "fix(projetos): preserva campos ao salvar rascunho"
```

### Task 4: Datas legíveis no Admin

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx:25,372-375`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`

**Interfaces:**
- Consumes: `formatProjectPeriod(from: string | null, to: string | null): string` de `frontend/src/data/projects-extension.ts`.

- [ ] **Step 1: Write failing rendering tests**

Cobrir projeto com início/fim e projeto sem fim. Esperar `10/03/2027 a 10/04/2027` e `a partir de 10/03/2027`; afirmar que a tabela não contém `null` nem o ISO cru.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: FAIL com ISO e/ou `null` na célula.

- [ ] **Step 3: Use the shared formatter**

Importar `formatProjectPeriod` e renderizar `formatProjectPeriod(project.startsAt, project.endsAt)`.

- [ ] **Step 4: Run rendering tests**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx
git commit -m "fix(projetos): formata períodos no admin"
```

### Task 5: Release 1.14.1, gates e PR

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`
- Modify: `backend/package.json`, `backend/package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/README.md`

**Interfaces:**
- Consumes: Tasks 1–4 concluídas.

- [ ] **Step 1: Update release metadata**

Executar `npm version 1.14.1 --no-git-tag-version` nos dois pacotes. Registrar 1.14.0 como publicada pela PR #674 e criar 1.14.1 com disponibilidade, rascunho parcial e datas. Adicionar o plano ao índice e registrar que não há migration.

- [ ] **Step 2: Run all gates**

Run: `npm run test:scripts && cd backend && npm run build && npx jest --silent`
Run: `cd .. && make astro-verify && make astro-verify-tenants`
Expected: todos exit 0. Limpar somente artefatos gerados em `frontend/public`, preservando `static/`.

- [ ] **Step 3: Verify the original scenarios**

Executar novamente a jornada real de disponibilidade e um fluxo PostgreSQL que salve/reabra um rascunho parcial e tente propor sem completar. Verificar payload e persistência reais, não apenas imports.

- [ ] **Step 4: Independent review and publish**

Revisar o range completo, corrigir somente Critical/Important, publicar `develop` e abrir PR para `main` explicando as três correções, testes e ausência de migration. Acompanhar CI/Sonar; não fazer merge ou deploy sem comando explícito.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/plans/README.md docs/superpowers/specs/2026-11-26-admin-operations-improvements-design.md docs/superpowers/plans/2026-11-26-admin-hotfixes-1-14-1.md frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
git commit -m "fix(admin): prepara release 1.14.1"
```
