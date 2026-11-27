<!-- AGENT-INDEX
purpose: Implementar o Admin unificado das quatro categorias de Projetos na release 1.15.0.
audience: Implementadores e revisores.
status: Aguardando confirmação do plano antes da execução.
sections:
  - Global Constraints
  - Review Focus
  - Task 1
  - Task 2
  - Task 3
  - Task 4
  - Task 5
related-docs:
  - ../specs/2026-11-26-admin-operations-improvements-design.md — desenho aprovado.
  - 2026-11-26-admin-hotfixes-1-14-1.md — hotfixes já integrados na develop.
agent-protocol:
  - Executar com TDD; não publicar nem fazer deploy sem gates e revisão.
-->

# Admin Projects Catalog 1.15.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admin e diretores gerenciem Programas, Extensão, Campanhas comunitárias e Open Source em um único Admin de Projetos, sem duplicar registros ou fontes de dados.

**Architecture:** A API administrativa ganha filtro explícito de categoria com default compatível `extension`. O frontend compartilha listagem e máquina de status, mas usa formulário completo somente para Extensão; as demais categorias usam campos editoriais comuns. Registros `open_source` são editados, nunca importados como cópias.

**Tech Stack:** NestJS, TypeORM, class-validator, React 19, MUI v9, Vitest, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-admin-operations-improvements-design.md`

## Global Constraints

- `GET /projects` sem `category` continua retornando somente Extensão; `category=all` retorna todas.
- Categoria é imutável após criação; `kind` não vira categoria.
- Participantes, horas e certificados continuam exclusivos de Extensão.
- `canonicalUrl` aceita caminho interno ou HTTPS.
- Nenhuma cópia de projeto open source é criada; a ação “Importar da vitrine” é removida.
- Salvar na API não promete atualização imediata do portal por snapshot.
- Frontend/backend: 1.15.0; migration: nenhuma; nenhum deploy sem autorização.

## Review Focus

- Consumidor antigo sem `category`: mantém apenas Extensão; teste na Task 1.
- `category=all`: inclui as quatro categorias sem expor ações de Extensão às demais; testes nas Tasks 1 e 4.
- Open source existente selecionado: abre edição do mesmo ID, nunca POST; teste na Task 3.
- Rascunho parcial da 1.14.1: reabre e salva sem `undefined`; teste de regressão na Task 2.
- Entidade em segunda página: aparece no filtro/formulário; teste na Task 4.
- Editor com `canonicalUrl`: valida HTTPS/caminho interno e preserva URL na atualização; teste na Task 2.

---

### Task 1: Filtro administrativo por categoria

**Files:**
- Modify: `backend/src/projects/dto/project.dto.ts:64-69`
- Modify: `backend/src/projects/projects.service.ts:241-264`
- Test: `backend/src/projects/projects.service.spec.ts`

**Interfaces:**
- Produces: `ProjectQueryDto.category?: 'extension'|'program'|'campaign'|'open_source'|'all'`; omissão equivale a `extension`.

- [ ] **Step 1: Write failing service tests**

Fixtures com um projeto de cada categoria. Provar default somente Extensão, `all` com quatro, filtro `campaign` somente Campanhas e combinação com status/entidade.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest --runInBand src/projects/projects.service.spec.ts`
Expected: FAIL porque `category=all` é ignorado e somente Extensão é retornada.

- [ ] **Step 3: Implement query and filter**

Adicionar o enum ao DTO e resolver `category` no `where`: ausência/`extension` filtra Extensão, `all` não filtra, demais filtram o valor informado.

- [ ] **Step 4: Run projects tests**

Run: `cd backend && npx jest --runInBand src/projects`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/projects/dto/project.dto.ts backend/src/projects/projects.service.ts backend/src/projects/projects.service.spec.ts
git commit -m "feat(projetos): filtra admin por categoria"
```

### Task 2: Modelo e payload por categoria

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/project-form.ts`
- Modify: `frontend/src/components/islands/admin/projects/project-form.test.ts`

**Interfaces:**
- Produces: `ProjectCategory = 'extension'|'program'|'campaign'|'open_source'`; `ManagedProject.category` e `canonicalUrl`; `buildProjectPayload` inclui categoria e somente campos comuns fora de Extensão.

- [ ] **Step 1: Write failing model tests**

Cobrir Campanha com `canonicalUrl`, Open Source sem clone, categoria imutável na edição e rascunho parcial da 1.14.1. Fora de Extensão, payload contém `name`, `entityId`, `category`, `summary`, `isPublic`, `canonicalUrl`, `status` e `kind` coerente; não contém mentor/ODS/orçamento.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/project-form.test.ts`
Expected: FAIL porque categoria/URL não existem no modelo e os campos de Extensão são enviados para todas.

- [ ] **Step 3: Implement category-aware model and payload**

Adicionar categoria ao formulário, defaults por categoria, `canonicalUrl` e ramificação de payload. Manter serialização parcial de Extensão e validação completa apenas para proposta/ativo de Extensão.

- [ ] **Step 4: Run model tests**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/project-form.test.ts`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/admin/projects/project-form.ts frontend/src/components/islands/admin/projects/project-form.test.ts
git commit -m "feat(projetos): serializa categorias no admin"
```

### Task 3: Editor unificado e fim da importação duplicada

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/ProjectFormDialog.tsx`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
- Delete: `frontend/src/components/islands/admin/projects/OpenSourceProjectPicker.tsx`
- Delete: `frontend/src/components/islands/admin/projects/OpenSourceProjectPicker.test.tsx`
- Delete: `frontend/src/data/projects.ts`

**Interfaces:**
- Consumes: modelo da Task 2 e filtro da Task 1.

- [ ] **Step 1: Write failing editor tests**

Criar Campanha com campos comuns e sem campos de Extensão; editar Open Source com `canonicalUrl`; afirmar que não há botão “Importar da vitrine” nem POST ao selecionar Open Source existente. Propor Campanha exige somente resumo, enquanto Extensão mantém validação completa.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: FAIL porque só Extensão tem editor e a vitrine local ainda existe.

- [ ] **Step 3: Implement category editor**

Categoria selecionável somente na criação e desabilitada na edição. Mostrar campos comuns; somente Extensão mostra seções específicas. Remover picker, estado e lista local duplicada. Selecionar/editar Open Source usa o registro atual e seu ID.

- [ ] **Step 4: Run editor tests**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/admin/projects frontend/src/data/projects.ts
git commit -m "feat(projetos): unifica editor do catálogo"
```

### Task 4: Listagem unificada, entidades e feedback

**Files:**
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx`
- Modify: `frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.

- [ ] **Step 1: Write failing list tests**

Cobrir filtro por categoria com `category=all`, chip de categoria, `DataTable`, erro com retry, empty state orientado e duas páginas de entidades. Nenhuma ação de participantes/horas/certificados fora de Extensão.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: FAIL porque não há filtro/categoria e entidades são limitadas à primeira página.

- [ ] **Step 3: Implement unified list**

Adicionar tabs/filtro de categoria com `all`, `DataTable`, skeleton/retry e empty state. Carregar entidades em loop até `totalPages`. Manter ações de status existentes e adicionar link seguro para `canonicalUrl` quando presente.

- [ ] **Step 4: Run list tests**

Run: `cd frontend && npx vitest run src/components/islands/admin/projects/ProjectsAdminApp.test.tsx`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx frontend/src/components/islands/admin/projects/ProjectsAdminApp.test.tsx
git commit -m "feat(projetos): consolida listagem do catálogo"
```

### Task 5: Publicação, release e verificação

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`
- Modify: `backend/package.json`, `backend/package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/README.md`

**Interfaces:**
- Consumes: Tasks 1–4 concluídas.

- [ ] **Step 1: Update release metadata**

Usar 1.15.0 nos quatro arquivos. Documentar Admin unificado, ausência de migration, remoção da lista duplicada e rollout backend → sync → frontend.

- [ ] **Step 2: Run all gates**

Run: `npm run test:scripts && cd backend && npm run build && npx jest --silent`
Run: `cd .. && make astro-verify && make astro-verify-tenants`
Expected: todos exit 0; limpar artefatos gerados.

- [ ] **Step 3: Verify real journeys and rendered UI**

Em PostgreSQL descartável: criar/editar uma Campanha, listar `all`, provar default de Extensão e impedir operações de Extensão nas demais categorias. Em desktop/mobile e claro/escuro: criar Campanha, editar Open Source e validar ausência de duplicação, overflow e campos de Extensão.

- [ ] **Step 4: Independent review and publish**

Revisão independente do range, correção de Critical/Important, push da `develop` e PR para `main`. Se a conta EMU continuar bloqueando `createPullRequest`, entregar a URL de comparação sem contornar a restrição. Não fazer merge ou deploy.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/plans/README.md docs/superpowers/plans/2026-11-26-admin-projects-catalog-1-15-0.md frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
git commit -m "feat(projetos): prepara admin unificado 1.15.0"
```
