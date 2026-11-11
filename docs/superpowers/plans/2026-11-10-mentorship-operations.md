<!-- AGENT-INDEX
purpose: Plano TDD para importar o histórico de mentoria e administrar mentores.
audience: Implementers e revisores da branch feat/mentorship-operations.
status: Aprovado em conversa; execução inline sem subagentes.
sections:
  - Constraints
  - Migration 046
  - Admin backend
  - Admin frontend e redirect
  - E2E, gates e PR
related-docs:
  - docs/superpowers/specs/2026-11-10-mentorship-operations-design.md — regras e contagens
agent-protocol:
  - Execute red-green em cada etapa; não use subagentes.
  - Não commite o CSV, não envie e-mails e não faça deploy sem comando explícito.
-->

# Mentoria Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Importar 173 sessões históricas e permitir que admin vincule, ative, desative e edite mentores sem quebrar o fluxo da Fase 5.

**Architecture:** Migration estática idempotente com placeholders e designations. Service admin transacional para perfil/designation, com UI paginada e redirect para admins sem perfil ativo.

**Tech Stack:** NestJS/TypeORM/PostgreSQL, Jest/Supertest, React 19/MUI v9, Vitest/Astro.

**Spec:** `docs/superpowers/specs/2026-11-10-mentorship-operations-design.md`

## Global Constraints

- Backend **0.22.0**, migration **046**, sem alterar `hour_ledger`.
- Não commitar `Dashboard - Mentoria - Schedules.csv`, dumps ou `.env`.
- Usar somente `secondaryEmails` verificados para associações.
- Não enviar e-mails, sincronizar produção ou publicar releases sem comando.

---

### Task 1: Design e plano

**Files:**
- Create: `docs/superpowers/specs/2026-11-10-mentorship-operations-design.md`
- Create: `docs/superpowers/plans/2026-11-10-mentorship-operations.md`

- [x] **Step 1: Registrar contagens e regras de identidade/deduplicação**
- [x] **Step 2: Revisar placeholders, rollback e escopo**
- [x] **Step 3: Commit**

```bash
git add docs/superpowers && git commit -m "docs(mentoria): desenha importação e gestão de mentores"
```

### Task 2: Migration 046

**Files:**
- Create: `backend/src/migrations/1794800000000-Migration046_MentorshipHistory.ts`
- Create: `backend/src/mentorship/mentorship-history.migration.spec.ts`
- Modify: `backend/package.json` e lock
- Test: `backend/test/mentorship-history.e2e-spec.ts`

**Interfaces:**
- `Migration046MentorshipHistory1794800000000 implements MigrationInterface`.
- Seed: 173 sessões, 6 perfis, 1 ativo, 5 placeholders, 8 inválidas e 4 duplicidades ignoradas.

- [x] **Step 1: Escrever testes que falham**

```ts
expect(seed.sessions).toHaveLength(173);
expect(seed.mentors.filter((mentor) => mentor.active)).toHaveLength(1);
expect(seed.mentors.filter((mentor) => mentor.placeholder)).toHaveLength(5);
```

Adicionar asserções de `legacy-import`, nenhuma hora, consentimento ou Meet link e rollback condicionado a placeholders inativos.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/mentorship/mentorship-history.migration.spec.ts`
Expected: migration inexistente.

- [x] **Step 3: Gerar seed do CSV sem commitá-lo**

Gerar o array TypeScript com datas ISO, duração calculada/fallback, `legacy-import:<id>` e canal. Conflitos mantêm menor `scheduled_at`. Não criar script ou CSV versionado.

- [x] **Step 4: Implementar upserts idempotentes**

Usar placeholders determinísticos, perfis/designations existentes, `WHERE NOT EXISTS` e `ON CONFLICT (mentorId, scheduledAt) DO NOTHING`. Vincular mentorandos somente por `secondaryEmails`. Rollback só apaga sessões importadas e placeholders inativos sem dependências.

- [x] **Step 5: Confirmar GREEN e E2E real**

```bash
cd backend && npx jest --silent src/mentorship/mentorship-history.migration.spec.ts
DB_NAME=codaqui_certificate_test NODE_ENV=test npm run test:e2e -- --runInBand test/mentorship-history.e2e-spec.ts
```

Expected: 173 sessões, 6 perfis, 5 placeholders, zero horas e down sem apagar dados reais. Bump backend para 0.22.0 e commit.

### Task 3: Admin backend

**Files:**
- Modify: `backend/src/mentorship/dto/mentorship.dto.ts`
- Modify: `backend/src/mentorship/mentorship.controller.ts`
- Modify: `backend/src/mentorship/mentorship.service.ts`
- Test: `backend/src/mentorship/mentorship.controller.spec.ts`
- Test: `backend/src/mentorship/mentorship.service.spec.ts`

**Interfaces:**
- `GET /mentorship/admin/mentors` com envelope compartilhado.
- `PATCH /mentorship/admin/mentors/:id` com `{memberId, areas, focus?, active}`.

- [x] **Step 1: Escrever testes que falham**

Cobrir admin proibido, paginação, ativação, desativação, edição, membro inexistente, conflito de perfil e reatribuição com revogação/concessão/auditoria.

- [x] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/mentorship`
Expected: endpoints/métodos inexistentes.

- [x] **Step 3: Implementar listagem e atualização transacional**

Projetar placeholders sem e-mail, validar membro ativo e conflito `memberId`. Reatribuir revogando designation antiga, ativando a correta quando necessário e revogando em desativação. Invalidar cache e auditar antes/depois.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/mentorship`
Expected: todos os testes passam.

### Task 4: Admin frontend e redirect

**Files:**
- Modify: `frontend/src/components/islands/admin/mentorship/MentorshipAdminApp.tsx`
- Modify: `frontend/src/components/islands/admin/mentorship/MentorshipAdminApp.test.tsx`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.test.tsx`

**Interfaces:**
- Cards com `areas`, `focus`, `active`, `isPlaceholder`; seleção de membro ativo.
- `PATCH /mentorship/admin/mentors/:id` com feedback e paginação.

- [x] **Step 1: Escrever testes que falham**

Testar edição/reatribuição, desativação, placeholder e admin redirecionado de `/membro/mentoria` para `/admin/mentoria` antes de requests.

- [x] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/admin/mentorship src/components/islands/mentorship/MentorDashboardIsland.test.tsx`
Expected: ausência da nova seção e redirect.

- [x] **Step 3: Implementar UI e redirect**

Carregar `/admin/members` uma vez, filtrar client-side, editar áreas/foco, ativar/desativar e reatribuir com confirmação. Admin é detectado por `isAdmin` antes de `/mentorship/profile` e `/mentorship/sessions`.

- [x] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/admin/mentorship src/components/islands/mentorship/MentorDashboardIsland.test.tsx`
Expected: todos os testes passam.

### Task 5: Documentação, E2E e PR

**Files:**
- Modify: `docs/adrs/009-mentorship.md`
- Modify: `docs/plans/codaqui-1-0/README.md`
- Modify: `docs/superpowers/plans/2026-11-10-mentorship-operations.md`

- [x] **Step 1: Atualizar comportamento implementado e checklist**
- [x] **Step 2: Rodar E2E completo em dump**

```bash
DB_NAME=codaqui_certificate_test NODE_ENV=test npm run test:e2e -- --runInBand test/mentorship.e2e-spec.ts test/mentorship-history.e2e-spec.ts
```

- [x] **Step 3: Rodar gates**

```bash
cd backend && npm run build && npx jest --silent
cd frontend && npm run check && npm run test
npm run test:scripts
make astro-verify
make astro-verify-tenants
```

- [x] **Step 4: Publicar branch, abrir PR e aguardar SonarCloud**

Não adicionar CSV/dumps. PR para `main` somente depois de integrar e validar `develop`; depois acompanhar `develop → main` com SonarCloud verde.
