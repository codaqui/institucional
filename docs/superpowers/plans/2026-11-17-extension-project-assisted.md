<!-- AGENT-INDEX
purpose: Plano TDD da Fase 8b.1 — cadastro assistido de projetos de extensão com mentores pesquisáveis e sincronização idempotente.
audience: Implementers e revisores
status: Em execução em develop
sections:
  - Constraints e review focus
  - Tasks 1–4
  - Gates e rollout
related-docs:
  - ../specs/2026-11-17-extension-project-assisted-design.md — desenho revisado por builder check
  - ../../adrs/008-entities-extension-projects.md — contrato atual
agent-protocol: Executar em ordem, em develop, com teste antes de cada mudança; P6, P7 e CNPq ficam fora.
-->

# Extension Project Assisted Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o cadastro/edição de projetos de extensão assistido, preservando mentores e prevenindo efeitos colaterais em edições sem mudança.

**Architecture:** A listagem administrativa recebe opções públicas dos mentores atuais. O formulário é decomposto em helpers puros e componentes de mentores/recursos, enquanto a sincronização backend aplica somente deltas e notifica apenas mudança real do principal.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, React 19, MUI 9, Vitest, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-17-extension-project-assisted-design.md`

## Global Constraints

- Trabalhar em `develop`; não implementar antes da ratificação da spec.
- Sem migration, mudanças no snapshot público, lifecycle, inscrições, horas, comprovantes ou autorização.
- P6, P7, CNPq, Stripe e conversão de open source ficam fora.
- Reutilizar `/mentorship/member-options`; não criar segunda busca nem expor e-mails.
- Fixtures sintéticas; nenhum dado real do dump em testes ou documentação.
- Bump minor e changelog somente na entrega implementada, com ADR 008 e roadmap atualizados.

## Review Focus

- Editar sem alterar mentores não pode fechar/recriar vínculos, auditar ou enviar e-mail (Task 2).
- Membro selecionado que sai da busca ou está inativo continua corretamente exibido (Tasks 1 e 3).
- Rascunho não envia linhas opcionais vazias nem exige campos de proposta (Task 4).
- Horas e dinheiro usam centavos para evitar erro de ponto flutuante (Tasks 3 e 4).
- Anexo fora da allowlist continua recusado pelo backend e o erro aparece no diálogo (Task 4).

---

### Task 1: Projeção administrativa dos mentores atuais

**Files:**
- Modify: `backend/src/projects/projects.service.ts`
- Test: `backend/src/projects/projects.service.spec.ts`

**Interfaces:**
- Produces: `ProjectMemberOption {id,name,githubHandle,avatarUrl}` e campos aditivos `mentor: ProjectMemberOption|null` e `coMentors: ProjectMemberOption[]` no envelope de `listManage`.
- Consumes: designation ativa e participantes `role='mentor'`, `leftAt=null` já existentes.

- [ ] **Step 1: Escrever testes falhos da projeção**

Fixturar dois projetos, um principal e dois co-mentores, incluindo um membro histórico inativo. Verificar principal fora dos co-mentores, whitelist pública sem e-mail, projeto sem vínculos retornando `null/[]` e consultas em lote com `In(projectIds)`/`In(memberIds)`.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/projects/projects.service.spec.ts --runInBand`
Expected: FAIL porque os campos não existem.

- [ ] **Step 3: Implementar enriquecimento da página**

Após `findAndCount`, buscar designations/participantes/membros somente dos IDs da página e mapear opções sem alterar filtro, paginação ou projeção pública.

- [ ] **Step 4: Verificar**

Run: `cd backend && npx jest src/projects/projects.service.spec.ts --runInBand`
Expected: PASS.

### Task 2: Sincronização de mentores somente por delta

**Files:**
- Modify: `backend/src/projects/projects.service.ts`
- Test: `backend/src/projects/projects.service.spec.ts`

**Interfaces:**
- Produces: `syncMentorAndCoMentors(...) => Promise<{principalChanged:boolean,membershipChanged:boolean}>`.
- Consumes: projeção da Task 1 para que a UI possa enviar o estado atual sem efeitos colaterais.

- [ ] **Step 1: Escrever testes falhos de no-op e delta**

Cobrir: conjunto idêntico sem `grant`, update/save de participantes, auditoria `PROJECT_MENTOR_DESIGNATED` ou e-mail; mudança só de co-mentor preservando linha inalterada e sem e-mail ao principal; troca de principal com designation atualizada e uma notificação. Configurar repositórios do manager por entidade.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/projects/projects.service.spec.ts --runInBand`
Expected: FAIL porque hoje todas as linhas são recriadas e `notifyMentor` é chamado.

- [ ] **Step 3: Implementar comparação antes/depois**

Calcular o conjunto atual de principal + co-mentores, retornar imediatamente quando idêntico, encerrar apenas removidos e inserir apenas novos. Auditar somente `membershipChanged`; propagar `principalChanged` para o `update` notificar apenas novo/trocado principal.

- [ ] **Step 4: Verificar backend completo do módulo**

Run: `cd backend && npx jest src/projects --runInBand`
Expected: PASS.

### Task 3: Helpers puros, ODS e seleção de mentores

**Files:**
- Create: `frontend/src/components/islands/admin/projects/project-form.ts`
- Create: `frontend/src/components/islands/admin/projects/project-form.test.ts`
- Create: `frontend/src/components/islands/admin/projects/ProjectMentorFields.tsx`
- Create: `frontend/src/components/islands/admin/projects/ProjectMentorFields.test.tsx`

**Interfaces:**
- Produces: tipos `ProjectMemberOption`, `ProjectFormValues`, `validateProjectForm(values)` e `buildProjectPayload(values, 'draft'|'proposed')`.
- Produces: `ProjectMentorFields({mentor,coMentors,onChange,disabled})`.
- Consumes: campos da Task 1 e `/mentorship/member-options`.

- [ ] **Step 1: Escrever testes falhos dos helpers**

Fixtar ODS 4 e metodologia `PjBL`; testar 17 nomes, duplicidade ODS, datas, cronograma em centavos e payload mínimo de rascunho versus completo de proposta.

- [ ] **Step 2: Escrever testes falhos da seleção**

Mockar a busca; verificar debounce, seleção simples/múltipla, remoção do principal dos co-mentores e preservação das opções atuais/inativas quando o resultado muda.

- [ ] **Step 3: Confirmar as falhas**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: FAIL porque helpers/componente não existem.

- [ ] **Step 4: Implementar helpers e `ProjectMentorFields`**

Manter constantes/conversões fora de React. Usar Autocomplete com busca de 300 ms, merge de opções selecionadas e conversão para IDs somente em `buildProjectPayload`.

- [ ] **Step 5: Verificar**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: PASS.

### Task 4: Recursos, diálogo e integração completa

**Files:**
- Create: `frontend/src/components/islands/admin/projects/ProjectResourcesFields.tsx`
- Create: `frontend/src/components/islands/admin/projects/ProjectFormDialog.tsx`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx`
- Test: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
- Modify: `docs/adrs/008-entities-extension-projects.md`
- Modify: `docs/plans/pos-1-0/README.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: edição de `supportPartners`, `budget`, `attachments` e formulário integrado sem alterar demais ações do admin.

- [ ] **Step 1: Escrever testes falhos de recursos e edição integrada**

Verificar linhas opcionais vazias omitidas, totais derivados em centavos, HTTPS obrigatório, erro da allowlist visível e edição que preserva mentor/co-mentores sem exigir UUID. Testar rascunho mínimo e proposta com todos os campos.

- [ ] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: FAIL porque recursos/diálogo não existem.

- [ ] **Step 3: Implementar recursos e extrair o diálogo**

Criar editores de parceiros/orçamento/anexos, derivar totais, integrar validação e mentores, e mover o formulário para `ProjectFormDialog`, deixando listagem/transições no app. Não alterar endpoints além da projeção da Task 1.

- [ ] **Step 4: Verificar interface e atualizar documentação viva**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects`
Expected: PASS. Registrar comportamento atual na ADR 008 e a entrega no roadmap, sem antecipar release.

### Gates e rollout

- [ ] `cd backend && npm run build && npx jest --silent`
- [ ] `make astro-verify`
- [ ] `make astro-verify-tenants`
- [ ] Em banco isolado, executar jornada sintética: rascunho → proposta com mentores/recursos → edição idêntica sem e-mail/churn → mudança de co-mentor → ativação.
- [ ] Atualizar changelog e versões compartilhadas com bump minor na entrega; PR para `develop` com revisão independente.
- [ ] Publicar backend antes do frontend e validar uma jornada controlada sem usar dados reais em fixtures.
