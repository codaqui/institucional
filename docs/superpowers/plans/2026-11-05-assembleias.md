<!-- AGENT-INDEX
purpose: Plano executável da Fase 3 — Assembleias com registro fino e Discussion manual.
audience: Implementers e revisores da Fase 3.
status: Implementação, merge e release do backend concluídos; categoria Reuniões configurada; redeploy, sync inicial e Giscus real pendentes.
sections:
  - Constraints
  - Tasks 1–7
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-05-assembleias-design.md — design aprovado
agent-protocol:
  - Executar em ordem com TDD e revisão entre tasks; Fases 4–7 ficam fora.
-->

# Assembleias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar assembleias com registro estruturado mínimo, Discussion manual, páginas públicas, Giscus e operação administrativa, sem armazenar narrativa no banco.

**Architecture:** NestJS/TypeORM mantém metadados e cartório em `assemblies`; `discussionUrl` é manual e estável por pathname. Um snapshot estático alimenta listagem/detalhe Astro, e o admin usa as ilhas/auth/paginação existentes.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Astro 7, React 19, MUI 9, Vitest 3, Giscus, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-05-assembleias-design.md`

## Global Constraints

- Backend `0.15.0`; migration `036_Assemblies`; Fases 4–7 fora do escopo.
- Discussion manual na categoria Reuniões, título exatamente `/assembleias/<type>-<number>`, sem GitHub App.
- `(type, number)` único e concorrente; slug imutável `<type>-<number>`.
- `heldAt` obrigatório para `held` e não anterior a `scheduledAt`; `oficial` realizada exige PDF e cartório.
- `createdById` é trilha, não permissão nem dado público. Criar/editar: admin ou diretor ativo; cartório: admin.
- Nenhum upload; PDF HTTPS pela allowlist do `StorageService`. Nenhuma narrativa, voto ou quórum no banco.
- API nova sem `/admin/`; listagem administrativa paginada no envelope padrão; `/assemblies/` no proxy sem colisão com `/assembleias`.
- Sync atômico preserva snapshot em falha. Giscus usa `pathname` e a categoria Reuniões, sem alterar o blog.
- MUI 9/tokens `--cq-*`, zero hex solto, acessibilidade, testes e revisão por task. Dados de teste sempre sintéticos.

---

### Task 1: Entidade, regras de domínio e migration 036

**Files:**
- Create: `backend/src/assemblies/entities/assembly.entity.ts`
- Create: `backend/src/assemblies/assembly.rules.ts` e `assembly.rules.spec.ts`
- Create: `backend/src/assemblies/dto/assembly.dto.ts` e `assembly.dto.spec.ts`
- Create: `backend/src/migrations/1794100000000-Migration036_Assemblies.ts`
- Create: `backend/src/assemblies/assembly.migration.spec.ts`

**Interfaces:**
- `AssemblyType = 'ordinaria' | 'oficial'`; `AssemblyStatus = 'scheduled' | 'held' | 'canceled'`.
- `assemblySlug(type, number): string` retorna `<type>-<number>`.
- `assertAssemblyTransition(assembly, patch, actor): void` valida transição e cartório.
- `parseDiscussionUrl(value): string` aceita somente `https://github.com/codaqui/institucional/discussions/<número>`.

- [x] **Step 1: Write failing domain and migration tests**

```ts
expect(assemblySlug('ordinaria', 2)).toBe('ordinaria-2');
expect(() => assertAssemblyTransition(official, { status: 'held', heldAt: later }, admin))
  .toThrow('PDF e cartório');
```

Migration test: verifica tabela, enum e índice único `(type, number)` no `up`/`down`.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/assemblies --runInBand`
Expected: módulos ausentes.

- [x] **Step 3: Implement entity, DTO and migration**

Campos do spec, `jsonb` para `notaryRegistry`, índice único e índice de listagem `(status, scheduledAt DESC)`. DTO usa `class-validator`, transform de datas e limite de texto. Não adicionar colunas de narrativa ou `createdById` ao payload público.

- [x] **Step 4: Implement and verify domain rules**

Validar slug, status, `heldAt >= scheduledAt`, PDF/cartório oficial e URL exata da Discussion. Reusar `StorageService.validateReceiptUrl` para PDF.

Run: `cd backend && npx jest src/assemblies --runInBand`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src/assemblies backend/src/migrations && git commit -m "feat(fase-3): adiciona modelo e migration de assembleias"`

### Task 2: API pública e administrativa com autorização e auditoria

**Files:**
- Create: `backend/src/assemblies/{assemblies.module,assemblies.service,assemblies.controller}.ts`
- Create: `backend/src/assemblies/assemblies.service.spec.ts` e `assemblies.controller.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/audit/{audit-category.ts,audit-category.spec.ts,entities/audit-log.entity.ts}`

**Interfaces:**
- `AssembliesService.create(dto, actor)`, `.update(id, dto, actor)`, `.listPublic()`, `.publicBySlug(slug)`, `.listManage(query)`.
- Rotas do spec: `GET /assemblies/public`, `GET /assemblies/public/:slug`, `GET /assemblies`, `POST /assemblies`, `PATCH /assemblies/:id`.
- Novas ações `assembly.created`, `assembly.updated`, `assembly.status_changed`, `assembly.notary_registered` em governo.

- [x] **Step 1: Write failing service/controller tests**

```ts
await expect(service.create(baseDto, director)).resolves.toMatchObject({
  type: 'ordinaria', number: 1, status: 'scheduled',
});
await expect(service.create(baseDto, member)).rejects.toThrow(ForbiddenException);
await expect(service.update(official.id, { status: 'held', heldAt: later }, admin))
  .rejects.toThrow('PDF e cartório');
```

Incluir paginação, público sem `createdById`, slug imutável e auditoria de cartório.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/assemblies --runInBand`
Expected: `AssembliesService`/rotas ausentes.

- [x] **Step 3: Implement service, authorization and numbering**

Transação com `pg_advisory_xact_lock(hashtext(:type))`, `MAX(number)+1` por tipo e save; retry apenas de violação `(type,number)` em concorrência. Diretor é validado por `DesignationsService.hasDesignation(actor.sub, { targetType: 'directorate', designation: 'director' })`. Admin tem acesso global; cartório exige admin.

- [x] **Step 4: Implement controller, audit and public projections**

Rotas públicas antes de `/:id`, DTOs de query com paginação e audit nas mutações. Retornar slug derivado, nunca `createdById`.

Run: `cd backend && npx jest src/assemblies src/audit --runInBand --silent`
Expected: PASS.

- [x] **Step 5: Commit**

`git add backend/src/assemblies backend/src/audit backend/src/app.module.ts && git commit -m "feat(fase-3): adiciona API de assembleias"`

### Task 3: Snapshot atômico, proxy e workflow

**Files:**
- Create: `scripts/sync-assemblies.mjs` e `sync-assemblies.test.mjs`
- Create: `.github/workflows/sync-assemblies.yml`
- Create: `static/assemblies/.gitkeep`
- Modify: `frontend/scripts/copy-snapshots.mjs`
- Modify: `frontend/src/lib/api-proxy-paths.ts` e `api-proxy-paths.test.ts`
- Modify: `package.json` e `Makefile`

**Interfaces:**
- `syncAssemblies({ apiUrl, outputFile, now, fetchImpl })` escreve `{generatedAt, assemblies}`.
- `npm run sync:assemblies`; snapshot copiado para `frontend/public/assemblies/index.json`.
- Proxy aceita `/assemblies/*` e não confunde `/assembleias`.

- [x] **Step 1: Write failing sync/proxy tests**

```js
await assert.rejects(syncAssemblies({ apiUrl: failingUrl, outputFile }));
assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).assemblies.length, 1);
```

Testar array inválido, falha HTTP, rename e proxy. Criar `static/assemblies/index.json` inicial vazio com `generatedAt` e `assemblies: []`.

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/sync-assemblies.test.mjs && cd frontend && npx vitest run src/lib/api-proxy-paths.test.ts`
Expected: arquivo/função/prefixo ausentes.

- [x] **Step 3: Implement atomic sync, proxy and workflow**

Seguir `sync-communities.mjs`: validar coleção inteira, temp+rename, não tocar snapshot em erro. Workflow diário `23 6 * * *` + dispatch, GitHub App e `contents: write`, chamando `npm run sync:assemblies` com `ASSEMBLIES_API_URL=https://api.codaqui.dev`.

- [x] **Step 4: Verify sync and real proxy contracts**

Run: `npm run test:scripts && cd frontend && npx vitest run src/lib/api-proxy-paths.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

`git add scripts .github/workflows static/assemblies frontend/scripts frontend/src/lib package.json Makefile && git commit -m "feat(fase-3): adiciona snapshot e proxy de assembleias"`

### Task 4: Giscus e páginas públicas

**Files:**
- Create: `frontend/src/data/assemblies.ts` e `assemblies.test.ts`
- Create: `frontend/src/pages/assembleias/index.astro`
- Create: `frontend/src/pages/assembleias/[slug].astro`
- Modify: `frontend/src/components/islands/GiscusIsland.tsx`
- Modify: `frontend/src/data/giscus.ts`
- Modify: `.github/workflows/deploy-astro.yml`, `compose.yaml`, `.env.example`, `frontend/.env.example`

**Interfaces:**
- `loadAssembliesIndex()` lê `public/assemblies/index.json` com fallback vazio.
- `assemblyPath(a)` retorna `/assembleias/${assemblySlug(a.type,a.number)}`.
- `GiscusIsland` aceita `config?: GiscusConfig`; default continua o blog.
- `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` configura a categoria por ambiente.

- [x] **Step 1: Write failing public data/Giscus tests**

```tsx
expect(assemblyPath({ type: 'oficial', number: 2 })).toBe('/assembleias/oficial-2');
expect(screen.getByTestId('giscus')).toHaveAttribute('data-category-id', 'test-category');
```

Verificar listagem ordenada, detalhe oficial, cancelada, slug inválido e default do blog inalterado.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/data/assemblies.test.ts src/components/islands/__tests__/GiscusIsland.test.tsx`
Expected: arquivos/contrato ausentes.

- [x] **Step 3: Implement data loading, Giscus override and public pages**

Listagem com cards semânticos e detalhe com OG/JSON-LD. Giscus por pathname, categoria Reuniões via env pública e `config` opcional. Mapear variável no Compose e no build do deploy.

- [x] **Step 4: Use the existing category and configure it**

A categoria **Reuniões** já existia em `codaqui/institucional` com ID `DIC_kwDOG9s0Ns4CxJVR`. O ID foi confirmado por GraphQL e configurado em `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` como Variable pública do repositório.

- [x] **Step 5: Verify public pages and commit**

Run: `cd frontend && npm run check && npm run build && npm run test`
Expected: páginas emitidas, blog inalterado, PASS. Commit: `feat(fase-3): publica assembleias e Giscus`.

### Task 5: Admin CRUD e navegação

**Files:**
- Create: `frontend/src/pages/admin/assembleias.astro`
- Create: `frontend/src/components/islands/admin/assemblies/AssembliesAdminApp.tsx` e teste
- Modify: `frontend/src/components/islands/AppNavIsland.tsx` e `__tests__/AppNavIsland.test.tsx`

**Interfaces:**
- `/admin/assembleias`: página fina com `AppLayout` e `AssembliesAdminApp`.
- Ilha usa `useAuth`, `authFetch`, `parseAuthJson`, `extractErrorMessage`, `PaginationControls`.
- Formulário cobre criação/edição, realização/cancelamento e cartório admin.

- [x] **Step 1: Write failing admin tests**

```tsx
await user.click(screen.getByRole('button', { name: /nova assembleia/i }));
await user.type(screen.getByLabelText(/discussion/i), validDiscussionUrl);
await user.click(screen.getByRole('button', { name: /salvar/i }));
expect(postBody.discussionUrl).toBe(validDiscussionUrl);
```

Cobrir diretor sem permissão de cartório, admin com cartório, validação e erros visíveis.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/islands/admin/assemblies src/components/islands/__tests__/AppNavIsland.test.tsx`
Expected: ilha/rota ausentes.

- [x] **Step 3: Implement admin island and navigation**

CRUD com formulários acessíveis, campos de Discussion/PDF/cartório e transições. Adicionar Assembleias a Governança, sem API `/admin/` e sem alterar menu do blog.

- [x] **Step 4: Verify admin tests and commit**

Run: `cd frontend && npx vitest run src/components/islands/admin/assemblies src/components/islands/__tests__/AppNavIsland.test.tsx && npm run check`
Expected: PASS. Commit: `feat(fase-3): adiciona gestão de assembleias`.

### Task 6: Migração real, concorrência e jornada end-to-end

**Files:**
- Create: `.cache` somente scripts temporários ignorados, removidos ao final.

**Interfaces:**
- Banco isolado com dump atual, migrations até 036 e fixtures sintéticas.
- Discussões criadas manualmente com título igual ao pathname.

- [x] **Step 1: Validate migration down/up**

Restaurar dump, aplicar/reverter/reaplicar 036, preservar membros e migration final 036.

- [x] **Step 2: Validate concurrent creation**

Duas criações simultâneas do mesmo tipo geram números diferentes e duas linhas, sem exceção de unicidade. Confirmar slug e status.

- [ ] **Step 3: Validate full journey**

Criar Discussion manual e assembleia via API, editar, realizar com PDF/cartório, consultar snapshot, abrir listagem/detalhe e conferir Giscus. Cancelar outra e verificar transparência. Remover todos os fixtures.

- [x] **Step 4: Run complete gates and commit**

`cd backend && npm run build && npx jest --silent`; `make astro-verify`; `make astro-verify-tenants`; `npm run test:scripts`. Commit de eventuais correções com evidência.

### Task 7: ADR, documentação e release 0.15.0

**Files:**
- Create: `docs/adrs/014-assemblies.md`
- Create: `.superpowers/sdd/2026-11-05-assembleias/task-7-report.md`
- Modify: `docs/README.md`, `docs/plans/codaqui-1-0/README.md`, `AGENTS.md`, `DEVELOPMENT.md`
- Modify: `backend/package.json` e `backend/package-lock.json` — bump já entregue na Task 6; permanecem em `0.15.0`, sem nova alteração

**Interfaces:**
- ADR registra Discussion manual, modelo fino, numeração, snapshot, cartório e limites.
- Backend `0.15.0`, Fase 4 continua fora do escopo.

- [x] **Step 1: Update living docs**

Incluir AGENT-INDEX, API, categoria Giscus, configuração `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID`, operação manual e retenção de comentários no GitHub.

- [x] **Step 2: Independent review**

Revisão estática concluída sem Critical/Important: segurança/autorização, unicidade, PII, concorrência, sync, acessibilidade e contratos. Nenhuma correção de código foi necessária; limites manuais foram registrados na ADR e no runbook.

- [x] **Step 3: Final gates and commit**

Evidências verdes dos quatro gates reaproveitadas da implementação `c1ae23b57da`, sem repetição desnecessária no diff docs-only; links, `git diff --check`, escopo do diff e versão 0.15.0 verificados no HEAD final. Commit `chore(fase-3): prepara release 0.15.0 e handoff`.

- [x] **Step 4: Integration handoff and merge**

PR #613 integrada em `main` pelo merge `922d38a950718ea33bf2917119a3e1a8491576f6`, com CI, Sonar e quatro builds de frontend verdes.

- [x] **Step 5: Publish backend 0.15.0**

Release `v0.15.0-backend` publicada no run `42292647305`, com imagens linux/amd64 e linux/arm64/v8.

- [ ] **Step 6: Complete production rollout**

Redeploy manual no Coolify, confirmação da migration 036, sync inicial, publicação do frontend com a correção da categoria Reuniões e validação com Discussion real continuam pendentes.
