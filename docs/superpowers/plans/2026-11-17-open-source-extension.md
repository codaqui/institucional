<!-- AGENT-INDEX
purpose: Plano TDD da Fase 8b.2 — conversão manual e assistida da vitrine open source em extensão.
audience: Implementers e revisores
status: Código concluído e revisado em develop/1.6.0; jornada operacional de importação e release/deploy pendentes
sections:
  - Constraints e review focus
  - Tasks 1–2
  - Gates e rollout
related-docs:
  - ../specs/2026-11-17-open-source-extension-design.md — desenho com builder check sem lacunas
  - ../../adrs/008-entities-extension-projects.md — lifecycle atual
agent-protocol: Executar em develop somente após ratificação; sem conversão automática, migration ou P7.
-->

# Open Source to Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir que admin/diretor crie manualmente um projeto de extensão a partir de um item da vitrine, sem remover a origem nem omitir obrigações institucionais.

**Architecture:** Um picker client-side lê `frontend/src/data/projects.ts` e passa a origem ao formulário da Fase 8b.1. Um helper puro pré-preenche somente nome/resumo; a criação usa `POST /projects` sem backend novo.

**Tech Stack:** React 19, MUI 9, Vitest, Astro 7, NestJS 11, TypeORM 0.3.28, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-17-open-source-extension-design.md`

## Global Constraints

- Trabalhar em `develop` somente após ratificação e após a entrega anterior estar publicada.
- Não alterar `projects.ts`, snapshots, DTO/entidade, lifecycle, autorização ou backend.
- Não importar em lote nem remover/ocultar a origem open source.
- URL GitHub é somente referência visual; nunca entra em `attachments`.
- Fixtures sintéticas, sem dados reais do dump; P7, Stripe, empresas e CNPq ficam fora.

## Review Focus

- Selecionar uma origem não pode chamar API nem alterar a vitrine (Task 2).
- Origem GitHub não pode entrar no payload ou falhar na allowlist (Tasks 1 e 2).
- Proposta continua bloqueada sem entidade, ODS, datas, mentor e demais obrigações (Task 2).
- Importar → editar → novo projeto não pode reutilizar origem/estado indevidamente (Task 2).
- Links externos usam `target="_blank" rel="noopener noreferrer"` (Task 1).

---

### Task 1: Helper de origem e picker da vitrine

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/project-form.ts`
- Test: `frontend/src/components/islands/admin/projects/project-form.test.ts`
- Create: `frontend/src/components/islands/admin/projects/OpenSourceProjectPicker.tsx`
- Create: `frontend/src/components/islands/admin/projects/OpenSourceProjectPicker.test.tsx`

**Interfaces:**
- Produces: `createProjectFormFromOpenSource(source: Project|null, defaultEntityId?: string): ProjectFormValues`.
- Produces: `OpenSourceProjectPicker({open,onClose,onSelect})`, lendo `projects` de `src/data/projects.ts`.

- [x] **Step 1: Escrever testes falhos do helper**

Verificar defaults atuais, nome/resumo, entidade default, mentores/recursos vazios e que `buildProjectPayload(...,'draft')` não contém a URL de origem.

- [x] **Step 2: Escrever testes falhos do picker**

Verificar listagem, filtro local por título/descrição, links seguros e que `onSelect` retorna o item escolhido sem `authFetch` ou mutação.

- [x] **Step 3: Confirmar as falhas**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: FAIL porque helper/componente não existem.

- [x] **Step 4: Implementar helper e picker**

Reutilizar `createEmptyProjectForm`, alterar somente nome/resumo e renderizar Dialog com busca local e links seguros.

- [x] **Step 5: Verificar**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: PASS.

### Task 2: Integração manual no formulário admin

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/ProjectFormDialog.tsx`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx`
- Test: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
- Modify: `docs/adrs/008-entities-extension-projects.md`
- Modify: `docs/plans/pos-1-0/README.md`

**Interfaces:**
- Consumes: helper e picker da Task 1.
- Produces: `sourceProject` opcional no diálogo e ação **Importar da vitrine** em `/admin/projetos`.

- [x] **Step 1: Escrever testes falhos da jornada**

Cobrir selecionar origem → formulário preenchido → rascunho via `POST /projects`; proposta ainda bloqueada; erro de API visível; reset entre importar/editar/novo; origem não removida e nenhum request antes de salvar.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: FAIL porque a ação/estado não existem.

- [x] **Step 3: Implementar a integração**

Adicionar `sourceProject` opcional ao diálogo, escolher o helper correto na inicialização, mostrar a origem como link e gerenciar picker/reset no app. Manter o contrato `POST /projects` e todas as ações existentes.

- [x] **Step 4: Verificar e documentar comportamento atual**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: PASS. Atualizar ADR/roadmap sem antecipar release.

### Task 3: Diagnóstico e fluxo de disponibilidade de mentoria

**Files:**
- Modify: `frontend/src/components/islands/mentorship/MentorDirectoryIsland.tsx`
- Test: `frontend/src/components/islands/mentorship/MentorDirectoryIsland.test.tsx`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx`
- Test: `frontend/src/components/islands/mentorship/MentorDashboardIsland.test.tsx`
- Modify: `docs/adrs/009-mentorship.md`

**Interfaces:**
- Consumes: `PublicMentor.availability` já existente e `/mentorship/availability`.
- Produces: distinção visível entre regra não cadastrada e regras sem slots livres.

- [x] **Step 1: Escrever testes falhos das causas**

Cobrir mentor sem regras com mensagem de disponibilidade não cadastrada, mentor com regras e zero slots com mensagem de quatro semanas e orientação na área do mentor. Não alterar o fluxo de reserva existente.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/mentorship`
Expected: FAIL porque as mensagens não existem.

- [x] **Step 3: Implementar estados de diagnóstico**

Usar `mentor.availability.length` para diferenciar ausência de regra de indisponibilidade/cupos ocupados e orientar o mentor no dashboard. Não criar regra automaticamente.

- [x] **Step 4: Verificar e validar jornada real**

Run: `cd frontend && npx vitest run src/components/islands/mentorship`
Expected: PASS. Em banco isolado, validar regra sintética → slots → solicitação de sessão e documentar o diagnóstico na ADR 009.

### Gates e rollout

- [x] `cd frontend && npm run check && npm run test`
- [x] `make astro-verify`
- [x] `make astro-verify-tenants`
- [x] `cd backend && npm run build && npx jest --silent`
- [ ] Jornada controlada após publicação da fase anterior: importar origem → salvar rascunho → completar proposta → ativar; confirmar que a origem continua na vitrine.
- [x] Atualizar changelog e versões compartilhadas com bump minor; PR para `develop` e revisão independente.
