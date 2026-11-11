<!-- AGENT-INDEX
purpose: Plano TDD da fase Announcements, derivado da spec homônima.
audience: Implementers e revisores da fase posterior aos patches operacionais.
status: Preparado; execução não iniciada.
sections:
  - Backend e migration 047
  - Snapshot público
  - Admin e barra pública
  - Gates e rollout
related-docs:
  - docs/superpowers/specs/2026-11-11-announcements-design.md — contrato da fase
agent-protocol:
  - Executar RED-GREEN em cada etapa, sem misturar campanhas, C4P ou check-in.
  - Confirmar que 0.23.0 e 0.24.0 foram integradas antes de usar 0.25.0/047.
-->

# Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admins criem, editem e desativem barras institucionais exibidas no portal por snapshot público.

**Architecture:** NestJS/TypeORM com CRUD admin e projeção pública filtrada por janela. Sync atômico para `static/announcements/index.json`, ilha acessível no `BaseLayout` e painel MUI paginado.

**Tech Stack:** NestJS 11, TypeORM/PostgreSQL, Jest/Supertest, React 19/MUI v9, Vitest/Astro, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-11-announcements-design.md`

## Global Constraints

- Confirmar integração de backend 0.23.0 e 0.24.0; esta fase usa **0.25.0** e migration **047**.
- Texto simples, sem HTML; links internos começam por `/` (exceto `//`) ou HTTPS.
- Não incluir autores nem dados de membros no snapshot; não criar dismiss, tracking ou segmentação.
- Não alterar C4P, campanhas de e-mail ou fluxos de check-in.

---

### Task 1: Entidade, migration e admin API

**Files:**
- Create: `backend/src/announcements/entities/announcement.entity.ts`
- Create: `backend/src/announcements/dto/announcement.dto.ts`
- Create: `backend/src/announcements/announcements.{module,controller,service}.ts`
- Create: `backend/src/announcements/announcements.service.spec.ts`
- Create: `backend/src/migrations/1795000000000-Migration047_Announcements.ts`
- Create: `backend/test/announcements.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/package.json` e lock para 0.25.0.

**Interfaces:**
- `Announcement`: campos da spec, severidades `info|success|warning|error`.
- `GET/POST /announcements/admin`, `PATCH/DELETE /announcements/admin/:id` (admin).
- `GET /announcements/public`: somente `{id,text,severity,linkUrl,linkLabel,startsAt,endsAt}` de ativos na janela.

- [ ] **Step 1: Escrever testes RED de validação e contrato**

```ts
await expect(service.create({ text: '<b>Manutenção</b>', severity: 'info' }, admin))
  .rejects.toThrow(BadRequestException);
expect(await service.listPublic()).toEqual([expect.not.objectContaining({ createdById: expect.anything() })]);
```

Cobrir link `javascript:`, `//host`, HTTPS sem label, janela invertida, não-admin 403 e DELETE lógico.

- [ ] **Step 2: Confirmar RED**

Run: `cd backend && npx jest --silent src/announcements`
Expected: módulo/métodos inexistentes.

- [ ] **Step 3: Implementar entidade, DTO, migration e service**

Usar validação `class-validator`, regra customizada de URL/janela, CRUD admin paginado, desativação lógica e auditoria antes/depois. Ordenar público por `error`, `warning`, `info`, `success`, depois `createdAt DESC`.

- [ ] **Step 4: Registrar controller e E2E real**

Executar create → public → close window → public vazio e migration down/up no dump. Confirmar que o público nunca recebe `createdById/updatedById`.

- [ ] **Step 5: Confirmar GREEN e commit**

Run: `cd backend && npx jest --silent src/announcements && npm run build`
Run: `DB_NAME=operations_patch_test NODE_ENV=test npm run test:e2e -- --runInBand test/announcements.e2e-spec.ts`
Expected: todos verdes.

```bash
git add backend && git commit -m "feat(announcements): administra avisos institucionais"
```

### Task 2: Snapshot atômico e proxy

**Files:**
- Create: `scripts/sync-announcements.mjs`
- Create: `scripts/sync-announcements.test.mjs`
- Create: `.github/workflows/sync-announcements.yml`
- Modify: `frontend/scripts/copy-snapshots.mjs`
- Modify: `frontend/src/lib/api-proxy-paths.ts`
- Modify: `package.json` com `sync:announcements`.

**Interfaces:**
- Snapshot `{generatedAt, announcements:[{id,text,severity,linkUrl,linkLabel,startsAt,endsAt}]}`.
- `/announcements/index.json` é asset, nunca proxy de API.

- [ ] **Step 1: Escrever testes RED do sync**

```js
await assert.rejects(sync(), /payload inválido/);
assert.equal(await readFile(snapshot, 'utf8'), previous);
```

Cobrir escrita completa, autor ausente, erro HTTP/JSON, rename com rollback e arquivo inalterado byte a byte.

- [ ] **Step 2: Confirmar RED**

Run: `node --test scripts/sync-announcements.test.mjs`
Expected: script inexistente.

- [ ] **Step 3: Implementar sync e cópia**

Buscar `/announcements/public` com credenciais existentes do sync, validar todos os itens antes de escrever e usar temp + rename atômico. Excluir `/announcements/index.json` do proxy.

- [ ] **Step 4: Confirmar GREEN e commit**

Run: `node --test scripts/sync-announcements.test.mjs`
Expected: todos verdes.

```bash
git add scripts package.json frontend .github && git commit -m "feat(announcements): publica snapshot atômico"
```

### Task 3: Admin frontend

**Files:**
- Create: `frontend/src/pages/admin/announcements.astro`
- Create: `frontend/src/components/islands/admin/announcements/AnnouncementsAdminApp.tsx`
- Create: `frontend/src/components/islands/admin/announcements/AnnouncementEditorDialog.tsx`
- Create: testes `.test.tsx` correspondentes.
- Modify: itens de navegação admin existentes, seção Comunicação.

**Interfaces:**
- `AnnouncementInput {text,severity,linkUrl?,linkLabel?,startsAt?,endsAt?,active}`.
- Lista paginada, Dialog com preview, PATCH e DELETE lógico.

- [ ] **Step 1: Consultar padrões e escrever RED**

Executar `modern-web-guidance` para forms/dialog/accessibility. Testar criação inválida sem request, edição, prévia, desativação confirmada, paginação e feedback.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/admin/announcements`
Expected: seção inexistente.

- [ ] **Step 3: Implementar painel MUI**

Usar `useAuth/authFetch`, `parseAuthJson/extractErrorMessage`, `PaginationControls`, labels visíveis, validação no submit e Alert com feedback. Desativação exige confirmação; erro não fecha o formulário.

- [ ] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/admin/announcements && npm run check`
Expected: zero erros.

```bash
git add frontend && git commit -m "feat(announcements): cria painel de avisos"
```

### Task 4: Barra pública no BaseLayout

**Files:**
- Create: `frontend/src/components/islands/AnnouncementsBarIsland.tsx`
- Create: `frontend/src/components/islands/AnnouncementsBarIsland.test.tsx`
- Modify: `frontend/src/layouts/BaseLayout.astro`
- Modify: `frontend/src/styles/global.css` somente com tokens `--cq-*`.

**Interfaces:**
- Lê `/announcements/index.json` em runtime e projeta o snapshot da Task 2.

- [ ] **Step 1: Escrever RED de snapshot vazio, múltiplos avisos e links**

Verificar região nomeada, ordem recebida, texto escapado, link externo seguro, ausência de reserva visual em erro/vazio e funcionamento por `data-theme`.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/AnnouncementsBarIsland.test.tsx`
Expected: componente inexistente.

- [ ] **Step 3: Implementar ilha acessível**

Renderizar artigos com severidade textual/ícone, sem HTML, links internos normais e externos com `target="_blank" rel="noopener noreferrer"`. Não persistir estado nem usar cor solta.

- [ ] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/AnnouncementsBarIsland.test.tsx && npm run check`
Expected: todos verdes.

```bash
git add frontend && git commit -m "feat(announcements): exibe avisos no portal"
```

### Task 5: ADR, documentação e rollout

**Files:**
- Create: `docs/adrs/017-announcements.md` com AGENT-INDEX.
- Modify: `docs/plans/codaqui-1-0/README.md`
- Modify: `AGENTS.md` somente se a arquitetura operacional mudar.

- [ ] **Step 1: Registrar implementação e sequência**

Documentar contrato, privacidade, sync e rollout; marcar esta fase somente após evidência real.

- [ ] **Step 2: Rodar E2E e gates**

```bash
cd backend && npm run build && npx jest --silent
DB_NAME=operations_patch_test NODE_ENV=test npm run test:e2e -- --runInBand test/announcements.e2e-spec.ts
cd frontend && npm run check && npm run test
npm run test:scripts
make astro-verify
make astro-verify-tenants
```

- [ ] **Step 3: Integrar e revisar**

Merge feature em `develop`, PR para `main`, SonarCloud sem issues abertas. Publicar 0.25.0 somente após merge e aplicar migration 047 antes do sync inicial.

- [ ] **Step 4: Validar anúncio real**

Criar aviso de manutenção com link para `https://github.com/codaqui/institucional/issues`, executar sync e verificar texto/link nos temas claro/escuro sem expor autores.
