<!-- AGENT-INDEX
purpose: Plano TDD da Fase 7.2 para ciclo de vida, atomicidade e vínculo de sessões de mentoria.
audience: Implementadores, revisores e futuros agentes consultando o histórico.
status: Concluído e publicado em v1.1.0-backend/migration 050 pela PR #652.
sections: [Sincronização, Candidatura atômica, Reconciliação, Vínculo e UI, Gates]
related-docs: [../specs/2026-11-16-mentorship-lifecycle-design.md]
agent-protocol: Registro histórico concluído; não reexecutar tasks nem checkboxes.
-->

# Fase 7.2 — Ciclo de vida e sessões de mentoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar mentor designation/perfil, garantir candidaturas atômicas e permitir apresentar e vincular participantes de sessões a contas da plataforma.

**Architecture:** `MentorProfile` passa a ser sincronizado pelo `QueryRunner` de designations. Candidatura e vínculos usam transações/consultas em lote; um componente de participante e um Dialog de vínculo são compartilhados entre dashboard do mentor e admin.

**Tech Stack:** NestJS + TypeORM/PostgreSQL · Astro/React/MUI · Jest/Vitest/node:test.

**Spec:** `docs/superpowers/specs/2026-11-16-mentorship-lifecycle-design.md`

## Global Constraints

- `mentor @ program('mentoria')` continua sendo a autorização; sem tabela/role paralela nem dependência circular entre módulos.
- Apenas designations ativas e vigentes (`validUntil` nulo ou futuro) ativam/exibem mentores.
- Nome/e-mail/consentimento/status/horas históricos não mudam ao vincular uma conta.
- Sem PII nova nas respostas; opções contêm somente `{id,name,githubHandle,avatarUrl}` e sessões são enriquecidas em lote.
- Backend feature **1.1.0**, migration **050**. TDD e PR com `endersonmenezes`.

## Review Focus

1. Confirmar/revogar com perfil ausente ou roles inalteradas também sincroniza `profile.active` (Task 1).
2. Recandidatura reutiliza UUID/histórico e falha de qualquer save faz rollback das duas entidades (Task 2).
3. Designation vencida não reativa perfil nem reaparece no snapshot sem nova escrita (Tasks 1/3).
4. Busca com `%`, `_` e `\` não vira coringa involuntária nem expõe campos privados (Task 4).
5. Mentor de outra sessão/membro inativo não vincula; nome/e-mail históricos permanecem e não há N+1 (Task 4).
6. Mentor e admin compartilham apresentação/vínculo; placeholder sem conta mostra “Não vinculado à plataforma” (Tasks 5/6).

---

### Task 1: Sincronizar designation e mentor_profile

**Files:**
- Modify: `backend/src/designations/designations.module.ts`
- Modify: `backend/src/designations/designations.service.ts:293-350`
- Test: `backend/src/designations/designations.service.spec.ts`

**Interfaces:**
- Produces: sync de `profile.active` por designation ativa e vigente; cria perfil vazio quando necessário.

- [ ] **Step 1: Write the failing tests**

Adicionar casos: confirm cria perfil ativo vazio quando ausente; revoke desativa preservando `approvedById`; sync ocorre com roles inalteradas; `validUntil` passado não ativa; `validUntil` futuro ativa. Mockar o repositório de `MentorProfile` obtido por `queryRunner.manager.getRepository`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest designations/designations.service --runInBand`
Expected: FAIL porque `MentorProfile` não é consultado/sincronizado.

- [ ] **Step 3: Implement the shared sync**

Registrar `MentorProfile` no módulo. Em `syncMemberWithRunner`, consultar designations ativas com regra de vigência e sincronizar antes do early return de roles. Criar com `areas: []`, `focus: null`, `active: true`, `approvedById` do ator quando necessário; desativar sem criar quando não houver designation vigente.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest designations/designations.service --runInBand`
Expected: toda a suíte de designations passa, inclusive os casos novos.

- [ ] **Step 5: Commit**

`fix(mentoria): sincroniza designation e perfil na mesma transação`

---

### Task 2: Candidatura atômica e recandidatura

**Files:**
- Modify: `backend/src/designations/designations.service.ts:151-200`
- Modify: `backend/src/mentorship/mentorship.service.ts:32-57`
- Test: `backend/src/mentorship/mentorship.service.spec.ts`

**Interfaces:**
- Consumes: sync da Task 1.
- Produces: `grant(input, actor, queryRunner?)`; `apply()` usa uma única transação e reutiliza perfil existente.

- [ ] **Step 1: Write the failing tests**

Provar: erro no save do perfil reverte designation/perfil; recandidatura com perfil existente atualiza `areas/focus`, mantém UUID e `active: false`; nova candidatura cria designation pendente + perfil inativo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest mentorship/mentorship.service --runInBand`
Expected: FAIL porque `grant` não aceita runner e o perfil existente viola unique.

- [ ] **Step 3: Implement optional runner and transactional apply**

Em `grant`, isolar o trabalho numa função recebendo runner e usá-lo quando fornecido; sem runner, delegar à transação atual. Em `apply`, injetar `DataSource`, usar `dataSource.transaction`, verificar duplicidade no manager da transação, chamar `grant(..., queryRunner)` e fazer upsert lógico do perfil inativo (create apenas se ausente).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest mentorship/mentorship.service designations/designations.service --runInBand`
Expected: candidatura e designations verdes.

- [ ] **Step 5: Commit**

`fix(mentoria): torna candidatura e recandidatura atômicas`

---

### Task 3: Reconciliar estados e vigência no snapshot

**Files:**
- Create: `backend/src/migrations/1795300000000-Migration050_MentorshipLifecycle.ts`
- Create: `backend/src/mentorship/mentorship-lifecycle.migration.spec.ts`
- Create: `backend/test/mentorship-lifecycle.e2e-spec.ts`
- Modify: `backend/src/mentorship/mentorship.service.ts` (`buildSnapshot`)

**Interfaces:**
- Produces: migration 050 com backup/restauração e snapshot que exige designation vigente em lote.

- [ ] **Step 1: Write the failing migration and snapshot tests**

Migration: `up` cria backup e aplica `EXISTS` com `validUntil IS NULL OR validUntil > NOW()`; `down` restaura do backup e remove a tabela. Snapshot: perfil ativo com designation removida/vencida não aparece; vigente aparece.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest mentorship/mentorship-lifecycle.migration mentorship/mentorship.service --runInBand`
Expected: migration ausente e snapshot sem filtro de designation.

- [ ] **Step 3: Implement migration and batched snapshot filter**

Criar `mentor_profile_active_backup`, reconciliar `active` por `EXISTS` e restaurar no down. No snapshot, buscar designations de mentoria vigentes para os membros dos perfis ativos e exigir as três condições: perfil ativo, membro ativo e designation vigente.

- [ ] **Step 4: Run unit and real PostgreSQL E2E**

Run: `cd backend && npx jest mentorship/mentorship-lifecycle.migration mentorship/mentorship.service --runInBand && node --test --experimental-test-module-mocks test/mentorship-lifecycle.e2e-spec.ts` (usar o runner Jest existente se o arquivo seguir o padrão dos demais E2E)
Expected: testes verdes; E2E cria estados divergentes sintéticos, valida down/up e restauração exata sem dados reais.

- [ ] **Step 5: Commit**

`fix(mentoria): reconcilia perfis e respeita validade das designations`

---

### Task 4: Opções de membros e vínculo de participantes

**Files:**
- Modify: `backend/src/mentorship/dto/mentorship.dto.ts`
- Modify: `backend/src/mentorship/mentorship.controller.ts`
- Modify: `backend/src/mentorship/mentorship.service.ts`
- Modify: `backend/src/mentorship/sessions.service.ts`
- Test: `backend/src/mentorship/mentorship.service.spec.ts`, `sessions.service.spec.ts`

**Interfaces:**
- Produces: `GET /mentorship/member-options?search=`; `POST /mentorship/sessions/:id/mentee {memberId}`; `menteeMember` enriquecido em ambas as listagens.

- [ ] **Step 1: Write the failing tests**

Opções: escape de `%`, `_`, `\`, limite 10, somente campos públicos/ativos. Vínculo: admin ou mentor dono; outro mentor/membro inativo falha; apenas `menteeMemberId` muda. Listagens mentor/admin retornam `menteeMember` com uma consulta em lote.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest mentorship/mentorship.service mentorship/sessions.service --runInBand`
Expected: endpoints/métodos ausentes e sessões sem enriquecimento.

- [ ] **Step 3: Implement DTOs, query and assignment**

DTO de busca opcional (`@MaxLength(100)`) e `memberId` UUID. Implementar busca parametrizada com escape e retorno limitado. Em `SessionsService`, implementar `assignMentee` com `assertMentor`, membro ativo e save apenas do UUID; enriquecer `listForMentor`/`listForAdmin` com membros em lote. Registrar as rotas antes de `sessions/:token`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest mentorship/mentorship.service mentorship/sessions.service --runInBand`
Expected: APIs verdes, preservação de histórico e zero N+1.

- [ ] **Step 5: Commit**

`feat(mentoria): busca membros e vincula participantes às sessões`

---

### Task 5: Componentes compartilhados de sessão e vínculo

**Files:**
- Create: `frontend/src/lib/mentorship.ts` (+ `.test.ts`)
- Create: `frontend/src/components/islands/mentorship/SessionParticipant.tsx`
- Create: `frontend/src/components/islands/mentorship/MenteeLinkDialog.tsx` (+ `.test.tsx`)

**Interfaces:**
- Produces: `MentorshipSessionView`, `MENTORSHIP_STATUS_LABEL`, `formatMentorshipDate`, `SessionParticipant`, `MenteeLinkDialog`.

- [ ] **Step 1: Write the failing tests**

Lib: data `16/11/2026 19:00` no fuso da sessão e todos os 5 status. Dialog: carrega opções, busca com `?search=`, envia `{memberId}` para `/mentorship/sessions/session-1/mentee`, mostra sucesso/erro e não envia sem seleção. Participante: mostra avatar/link `/@ana` quando vinculado e “Não vinculado à plataforma” quando ausente.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/mentorship.test.ts src/components/islands/mentorship`
Expected: módulos/componentes ausentes.

- [ ] **Step 3: Implement shared types, presentation and dialog**

Criar tipos compartilhados, formatter e labels sem hex/estilo novo. Renderizar avatar/inicial, nome, handle/link e texto de não vínculo. Implementar Dialog com Autocomplete e busca no endpoint, estado busy/erro e callback `onSaved` após sucesso.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/mentorship.test.ts src/components/islands/mentorship`
Expected: todos os testes compartilhados passam.

- [ ] **Step 5: Commit**

`feat(mentoria): compartilha apresentação e vínculo de participantes`

---

### Task 6: Integrar dashboard, admin e perfil público

**Files:**
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx` (+ teste)
- Modify: `frontend/src/components/islands/admin/mentorship/MentorshipAdminApp.tsx` (+ teste)
- Modify: `frontend/src/pages/[...handle].astro`

**Interfaces:**
- Consumes: contratos da Task 5 e `menteeMember` da Task 4.

- [ ] **Step 1: Write the failing integration tests**

Mentor: sessão mostra data/status/amigáveis e abre o Dialog ao clicar “Vincular participante”. Admin: tabela mostra as mesmas informações e permite abrir o fluxo. Após `onSaved`, ambos recarregam as sessões. Perfil: role `mentor` usa “Mentor(a)”.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/mentorship src/components/islands/admin/mentorship`
Expected: ISO/status crus e ausência da ação.

- [ ] **Step 3: Wire both journeys without duplicating the flow**

Substituir apresentação por `SessionParticipant` e renderizar `MenteeLinkDialog` no estado da sessão selecionada. Recarregar após salvar. Manter ações existentes de confirmação/conclusão/cancelamento e paginação. Adicionar o caso `mentor` ao `getRoleLabel`.

- [ ] **Step 4: Run tests, check and build**

Run: `cd frontend && npx vitest run src/components/islands/mentorship src/components/islands/admin/mentorship && npm run check && npm run build`
Expected: testes e 0 erros; build confirma os dois fluxos.

- [ ] **Step 5: Commit**

`feat(mentoria): melhora sessões no mentor, admin e perfil público`

---

### Task 7: Contratos, versão, gates e revisão

**Files:**
- Modify: `backend/package.json` (1.1.0)
- Modify: `docs/adrs/009-mentorship.md`
- Modify: `AGENTS.md` (decisão de mentoria/migration 050)

- [ ] **Step 1:** atualizar contratos e versão, registrar sync/vigência, endpoints, migration e rollout.
- [ ] **Step 2:** `cd backend && npm run build && npx jest --silent` — verde.
- [ ] **Step 3:** `npm run test:scripts` e `cd frontend && npm run test && npm run check && npm run build` — verde.
- [ ] **Step 4:** `make astro-verify && make astro-verify-tenants` — verde; limpar artefatos.
- [ ] **Step 5:** revisão independente do diff, correção de Critical/Important com TDD, push e PR para `main` com `endersonmenezes`; verificar Sonar issues/duplicação.

## Self-Review

1. **Spec coverage:** sync (T1), apply/reapply (T2), migration/vigência (T3), APIs (T4), UI compartilhada (T5), mentor/admin/perfil (T6), contratos/gates (T7).
2. **Type consistency:** `grant(..., queryRunner?)`, `menteeMember`, opções e componentes usam os mesmos campos definidos.
3. **Review Focus:** cada condição tem teste na task dona, incluindo placeholder e expiração sem escrita.
4. **Proporção:** tasks pequenas, interfaces explícitas e nenhuma duplicação de fluxo entre mentor/admin.
