<!-- AGENT-INDEX
purpose: Plano de implementação do catálogo backend, migration 055 e correções editoriais da 1.14.0.
audience: Mantenedores e AI agents executores.
status: Aprovado para implementação após revisão do backend; nenhum deploy sem autorização.
sections:
  - Global Constraints
  - Review Focus
  - Task 1
  - Task 2
  - Task 3
  - Task 4
related-docs:
  - ../specs/2026-11-24-projects-catalog-design.md — desenho e rollout aprovados.
agent-protocol:
  - Executar com TDD e commits por etapa; não editar static/ nem copiar conteúdo para snapshots manualmente.
-->

# Projects Catalog and Migration 055 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alimentar `/projetos` pelo backend com Programas, Extensão, Campanhas e Open Source, preservando as regras e os dados de Extensão.

**Architecture:** `extension_projects` permanece a tabela existente e ganha categoria e URL canônica. A API pública projeta todas as categorias, enquanto o admin e as operações de participação continuam restritos a Extensão. Um seed idempotente importa o catálogo atual; o frontend consome somente o snapshot sincronizado.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, class-validator, Jest, Astro, React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-projects-catalog-design.md`

## Global Constraints

- Categorias exatas: `program`, `extension`, `campaign`, `open_source`; `kind` não vira categoria.
- Somente Extensão permite inscrição, horas, certificados e o admin atual.
- `canonicalUrl` aceita caminho interno `/...` ou HTTPS; nunca `javascript:` ou HTTP externo.
- Seed idempotente, sem sobrescrever projetos existentes nem apagar relações.
- Corrigir conteúdo apenas em `blog/` e `trilhas/`; nunca em cópias geradas.
- Release 1.14.0; nenhum deploy ou merge sem autorização explícita.

## Review Focus

- Registro de Extensão antigo: mantém categoria, visibilidade e relações após up/down/up; teste na Task 2.
- Campanha finalizada: pode ser pública, mas não permite inscrição/horas/certificado; testes nas Tasks 1 e 2.
- Slug ou seed repetido: não duplica nem sobrescreve conteúdo; teste na Task 2.
- URL insegura ou nula: HTTPS/caminho interno válido, demais rejeitados sem quebrar Extensão; testes nas Tasks 1 e 2.
- Projeto sem campos de Extensão: sync aceita, página não mostra null nem formulário; testes na Task 3.

---

### Task 1: Categorias e contratos backend

**Files:**
- Create: `backend/src/projects/project-category.ts`
- Modify: `backend/src/projects/entities/extension-project.entity.ts`
- Modify: `backend/src/projects/dto/project.dto.ts`
- Modify: `backend/src/projects/project.rules.ts`
- Modify: `backend/src/projects/project-lifecycle.ts`
- Modify: `backend/src/projects/projects.service.ts`
- Modify: `backend/src/projects/participants.service.ts`
- Modify: `backend/src/hours/hours.service.ts`
- Modify: `backend/src/projects/project-certificates.service.ts`
- Tests: `backend/src/projects/project-category.spec.ts`, `project-lifecycle.spec.ts`, `projects.service.spec.ts`, `participants.service.spec.ts`, `project-hours.service.spec.ts`, `project-certificates.service.spec.ts`

**Interfaces:**
- Produces: `ProjectCategory`, `isPublicCatalogProject(project)`, `assertExtensionCategory(project)` e `assertCanonicalUrl(value?: string | null)`.

- [ ] **Step 1: Write failing contract tests**

Cobrir as quatro categorias, default/backfill de Extensão, URLs internas/HTTPS e rejeição de esquemas inseguros. Provar que Extensão pública continua somente `active`; demais categorias aceitam `active/finished`. Provar 400 para inscrição, horas e certificados fora de Extensão. Provar criação mínima de Campanha e que listagem/admin atual seleciona somente Extensão.

- [ ] **Step 2: Run focused tests**

Run: `cd backend && npx jest --runInBand src/projects`
Expected: FAIL porque categoria e helpers não existem.

- [ ] **Step 3: Implement category contracts**

Adicionar os campos à entidade/DTO e helpers puros. Aplicar visibilidade centralmente em `listPublic`/`publicBySlug` e incluir `category` + `canonicalUrl` na projeção pública. Restringir listManage e operações de participação/horas/certificados a Extensão. Fazer ativação exigir os campos completos somente em Extensão; demais categorias usam nome, entidade, resumo e URL canônica quando houver. Impedir mudança de categoria no update.

- [ ] **Step 4: Run backend project suite and build**

Run: `cd backend && npx jest --runInBand src/projects && npm run build`
Expected: todos os testes e build PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/projects docs/superpowers/specs/2026-11-24-projects-catalog-design.md docs/superpowers/plans/2026-11-24-projects-catalog.md
git commit -m "feat(projetos): adiciona categorias ao catálogo"
```

### Task 2: Migration 055 e seed idempotente

**Files:**
- Create: `backend/src/projects/catalog-seed.ts`
- Create: `backend/src/migrations/<timestamp>-Migration055_ProjectsCatalog.ts`
- Tests: `backend/src/projects/catalog-seed.spec.ts`, `backend/src/projects/projects-catalog.migration.spec.ts`

**Interfaces:**
- Consumes: `ProjectCategory` e os contratos da Task 1.
- Produces: seed com 11 open source, 2 programas e 10 campanhas, sem duplicatas de slug.

- [ ] **Step 1: Write failing seed/migration tests**

Verificar 23 slugs únicos, entidades esperadas e URLs canônicas. Verificar que a migration adiciona constraint/default, preserva Extensão e usa inserts idempotentes. Verificar que o down remove somente os seeds e os dois campos, preserva as entidades compartilhadas e não toca outros registros.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npx jest --runInBand src/projects/catalog-seed.spec.ts src/projects/projects-catalog.migration.spec.ts`
Expected: FAIL porque seed/migration não existem.

- [ ] **Step 3: Implement seed and migration**

Guardar o catálogo em `catalog-seed.ts`, com título, resumo, entidade, categoria, status, data e URL. A migration resolve o membro `endersonmenezes` com erro se ausente e cria somente entidades ausentes. O down preserva essas entidades compartilhadas e remove somente os projetos importados e os campos novos. Inserir projetos com `ON CONFLICT DO NOTHING`, sem update de conteúdo existente. Campanhas usam slug `tisocial-<postSlug>` e `finished`; demais seeds usam `active`.

- [ ] **Step 4: Run migration tests and isolated PostgreSQL verification**

Run: `cd backend && npx jest --runInBand src/projects && npm run build`
Expected: PASS.

Executar up/down/up em dump isolado seguindo `DEVELOPMENT.md`. Confirmar contagens, IDs/relações antigas e ausência de duplicatas. Remover bancos temporários.

- [ ] **Step 5: Commit**

```bash
git add backend/src/projects/catalog-seed.ts backend/src/projects/catalog-seed.spec.ts backend/src/projects/projects-catalog.migration.spec.ts backend/src/migrations
git commit -m "feat(projetos): importa catálogo na migration 055"
```

### Task 3: Catálogo frontend e correções editoriais

**Files:**
- Modify: `scripts/sync-projects.mjs` e `scripts/sync-projects.test.mjs` (ou o nome de teste existente equivalente)
- Modify: `frontend/src/data/projects-extension.ts` e `frontend/src/data/projects-extension.test.ts`
- Modify: `frontend/src/pages/projetos.astro`
- Modify: `frontend/src/pages/projetos/[slug].astro`
- Modify: `blog/2023-01-05-codaqui-na-conferencia-do-devpr-2023.md`
- Modify: `blog/2022-10-14-hello-world.md`
- Modify: `trilhas/github/page-8.md`
- Modify: `docs/plans/frontend-jornadas/2026-11-24-followup-links-discovery.md`
- Modify: `docs/adrs/008-entities-extension-projects.md`

**Interfaces:**
- Produces: `projectHref(project)`, agrupamento por `ProjectCategory` e cards que usam `canonicalUrl` antes do detalhe interno.

- [ ] **Step 1: Write failing sync/data tests**

Provar que Extensão mantém as validações antigas e que Campanha/Open Source sem mentor/ODS/agenda são aceitos. Provar validação de `canonicalUrl`, status `finished` fora de Extensão, agrupamento e prioridade do link canônico.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:scripts && cd frontend && npm run test -- --run src/data/projects-extension.test.ts`
Expected: FAIL pelos novos contratos.

- [ ] **Step 3: Implement frontend and editorial changes**

Fazer o sync validar por categoria sem reduzir proteção de Extensão. Atualizar tipos e adaptadores. Renderizar as quatro seções na ordem Programas, Extensão, Campanhas e Open Source, omitindo vazias. No detalhe, mostrar somente entidade/resumo/link original fora de Extensão e manter inscrição somente em Extensão ativa.

Remover o CTA do media kit, substituir os dois links de certificados pela frase aprovada e corrigir o GitHub Starter para `classroom-resources`. Atualizar follow-up e ADR sem apagar histórico.

- [ ] **Step 4: Run focused frontend checks**

Run: `npm run test:scripts && cd frontend && npm run check && npm run test -- --run src/data/projects-extension.test.ts`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts frontend/src/data frontend/src/pages/projetos.astro frontend/src/pages/projetos blog trilhas docs/plans/frontend-jornadas docs/adrs/008-entities-extension-projects.md
git commit -m "feat(projetos): publica catálogo por categoria"
```

### Task 4: Release 1.14.0 e verificação final

**Files:**
- Modify: `frontend/package.json` e `frontend/package-lock.json`
- Modify: `backend/package.json` e `backend/package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/README.md`

- [ ] **Step 1: Update release metadata**

Usar 1.14.0 nos quatro manifests/lockfiles. Documentar catálogo, migration 055, correções editoriais e rollout obrigatório. Atualizar índices de releases/planos.

- [ ] **Step 2: Run all gates**

Run: `npm run test:scripts && cd backend && npm run build && npx jest --silent`
Run: `cd .. && make astro-verify && make astro-verify-tenants`
Expected: todos exit 0. Limpar artefatos gerados.

- [ ] **Step 3: Verify rendered UI**

Capturar `/projetos` e um detalhe de cada categoria em desktop/mobile e claro/escuro com dados de snapshot apropriados. Verificar links, ausência de null, categorias, inscrição restrita a Extensão e nenhum overflow.

- [ ] **Step 4: Review and publish PR**

Executar revisão independente, corrigir somente achados críticos/importantes e publicar `develop`. Abrir PR para `main` explicando backend, migration, frontend, editorial e rollout. Acompanhar CI/Sonar; não publicar nem fazer deploy sem comando explícito.
