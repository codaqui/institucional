<!-- AGENT-INDEX
purpose: Plano TDD da navegação híbrida e do C4P como recurso de atividades próprias e externas.
audience: Implementers e revisores de backend, frontend e release.
status: Aprovado para execução nativa na develop em 2026-11-18.
sections:
  - Restrições globais e foco de revisão
  - Task 1 — Modelo e migration 053
  - Task 2 — Endpoints por atividade e snapshot
  - Task 3 — Navegação híbrida
  - Task 4 — Recursos no admin
  - Task 5 — Descoberta pública
  - Task 6 — Documentação e gates
related-docs:
  - ../specs/2026-11-18-event-capabilities-c4p-design.md — contrato aprovado e decisões do builder check
agent-protocol:
  - Seguir RED→GREEN por task, sem operações em campanhas reais e sem framework genérico de plugins.
-->

# Event Capabilities and C4P Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar C4P às atividades e restaurar a descoberta do portal sem inflar o header ou duplicar fluxos existentes.

**Architecture:** Uma migration aditiva liga `c4p_calls` a ativações externas e impede duplicidade por atividade. Um controller C4P específico para `/events` usa wrappers de autorização do módulo de eventos; a curadoria permanece em `/c4p/manage`. Frontend estático cruza os snapshots existentes, enquanto o admin ganha uma visão de recursos e o header usa grupos acessíveis.

**Tech Stack:** NestJS 11, TypeORM/PostgreSQL, TypeScript, React 19/MUI 9, Astro 7, Vitest/Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-event-capabilities-c4p-design.md`

## Global Constraints

- Não criar framework genérico de plugins, apagar campanhas ou quebrar URLs de avaliação/submissão/resultado.
- Notas, comentários e dados privados de propostas continuam fora de qualquer projeção pública.
- Nenhuma campanha real é criada, vinculada, aberta ou finalizada durante desenvolvimento ou validação.
- Não reconstruir ingressos, staff, check-in, certificados, scoring, dashboard ou curadoria.
- Usar tokens `--cq-*`, nenhuma dependência nova, teste falhando antes de cada implementação.

## Review Focus

- Ativação externa repetida/concorrente: deve retornar a mesma chamada e nunca duplicar activation/call; teste em Task 2 e E2E em Task 6.
- Atualização genérica de features: deve preservar C4P e rejeitar mudança direta; teste em Task 1.
- Snapshot legado e malformado: campos antigos continuam válidos, `externalEventKey` é validado e PII é rejeitada; testes em Tasks 2 e 5.
- Query `source` + `recurso` e histórico: filtros combinam por AND e navegação do browser preserva ambos; testes em Task 5.
- Navegação por teclado/mobile: grupo atual, disclosures e foco devem funcionar sem hover; testes em Task 3 e inspeção em Task 6.

---

### Task 1: Modelo, migration 053 e preservação do flag externo

**Files:**
- Create: `backend/src/migrations/1795600000000-Migration053_EventC4P.ts`
- Create: `backend/src/c4p/event-c4p.migration.spec.ts`
- Modify: `backend/src/c4p/entities/c4p-call.entity.ts`
- Modify: `backend/src/events/entities/external-event-activation.entity.ts`
- Modify: `backend/src/events/events.service.ts`
- Test: `backend/src/events/events-external.spec.ts`

**Interfaces:**
- Produces: `C4pCall.externalActivationId: string | null`, feature `c4p` e unique parcial por `managedEventId`/`externalActivationId`.
- Consumes: entidades e `activateExternal(eventKey,dto,user)` atuais.

- [ ] **Step 1: Write failing migration and activation tests**
  Assert SQL de coluna/FK para `externalActivationId`, índices únicos parciais e rollback somente desses objetos. Em `activateExternal`, teste 400 quando `features` contém `c4p` e preservação do flag existente ao atualizar `checkin`.
- [ ] **Step 2: Run tests RED**
  Run: `cd backend && npx jest src/c4p/event-c4p.migration.spec.ts src/events/events-external.spec.ts --runInBand`
  Expected: migration não existe e/ou comportamento `c4p` ainda não implementado.
- [ ] **Step 3: Implement additive model and migration**
  Adicionar coluna nullable/FK `ON DELETE RESTRICT`, índices parciais, feature `c4p`; no activate genérico, rejeitar alteração direta e preservar o flag existente ao salvar as demais features.
- [ ] **Step 4: Run focused tests GREEN**
  Run: comando do Step 2. Expected: todos PASS.
- [ ] **Step 5: Commit**
  `git add backend/src/migrations/1795600000000-Migration053_EventC4P.ts backend/src/c4p/event-c4p.migration.spec.ts backend/src/c4p/entities/c4p-call.entity.ts backend/src/events/entities/external-event-activation.entity.ts backend/src/events/events.service.ts backend/src/events/events-external.spec.ts && git commit -m "feat(eventos): fundamenta C4P por atividade"`

### Task 2: Endpoints idempotentes por atividade e associação pública

**Files:**
- Create: `backend/src/c4p/event-c4p.service.ts`, `event-c4p.controller.ts`, `event-c4p.service.spec.ts`, `event-c4p.controller.spec.ts`
- Modify: `backend/src/c4p/dto/c4p-call.dto.ts`, `c4p-calls.service.ts`, `c4p-dashboard.service.ts`, `c4p.module.ts`, `backend/src/events/events.service.ts`
- Test: `backend/src/c4p/c4p-calls.service.spec.ts`, `c4p-dashboard.service.spec.ts`, `c4p-public.controller.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `CreateEventC4pCallDto` (campos de `CreateC4pCallDto` + `communityProjectKey?`, `title?`, `startAt?`); `POST /events/:id/c4p` e `/events/external/:eventKey/c4p` retornam `C4pCall`; snapshot adiciona `externalEventKey: string | null` sem remover `event`.

- [ ] **Step 1: Write failing service/controller and snapshot tests**
  Cobrir criação própria/externa, repetição retorna existente, slug duplicado 409, `communityProjectKey` obrigatório só sem activation, autorização, rollback e snapshot externo sem PII. Verificar endpoints/DTOs no controller.
- [ ] **Step 2: Run tests RED**
  Run: `cd backend && npx jest src/c4p/event-c4p.service.spec.ts src/c4p/event-c4p.controller.spec.ts src/c4p/c4p-dashboard.service.spec.ts src/c4p/c4p-public.controller.spec.ts --runInBand`
  Expected: services/endpoints/campo ainda ausentes.
- [ ] **Step 3: Implement event-specific activation**
  Criar wrappers públicos de autorização em `EventsService`, service C4P transacional com repositórios e `C4pCallsService.create(...,manager?)`, endpoints no módulo C4P e consulta por parent antes de criar. Tratar unique de concorrência retornando a chamada persistida.
- [ ] **Step 4: Implement additive public association**
  Incluir `externalActivationId` no DTO/entidade de criação e buscar activations para serializar `externalEventKey`; manter `event:{slug,title}` e todas as whitelist de privacidade.
- [ ] **Step 5: Run focused tests GREEN**
  Run: comando do Step 2 + `c4p-calls.service.spec.ts`. Expected: todos PASS.
- [ ] **Step 6: Commit**
  `git add backend/src/c4p backend/src/events/events.service.ts && git commit -m "feat(c4p): ativa chamadas pela atividade"`

### Task 3: Header híbrido acessível

**Files:**
- Modify: `frontend/src/lib/site-navigation.ts`, `site-navigation.test.ts`, `frontend/src/components/astro/SiteHeader.astro`, `frontend/src/lib/header-menu.ts`, `header-menu.test.ts`

**Interfaces:**
- Produces: `SiteNavigationItem = {kind:'link'} | {kind:'group'}` e `isNavigationItemCurrent(pathname,item)`; desktop/mobile consomem a mesma `SITE_NAVIGATION`.
- Consumes: `INTEGRATE_COMMUNITY_LINK`, helpers de foco do drawer e `isNavigationCurrent`.

- [ ] **Step 1: Write failing navigation tests**
  Fixar links/grupos aprovados, `aria-current` para filhos de Aprender/Explorar, destinos Trilhas/Mentoria/Projetos/Blog e ausência de C4P no header. Testar toggle de disclosure por botão com `aria-expanded`.
- [ ] **Step 2: Run tests RED**
  Run: `cd frontend && npx vitest run src/lib/site-navigation.test.ts src/lib/header-menu.test.ts`
  Expected: API/grupos ainda não existem.
- [ ] **Step 3: Implement shared navigation and interactions**
  Renderizar links e botões com `aria-controls`; popover no desktop e disclosure inline no mobile, preservando drawer, foco, busca, tema/auth e CTA. Não usar `<details>`.
- [ ] **Step 4: Run focused tests GREEN**
  Run: comando do Step 2. Expected: todos PASS.
- [ ] **Step 5: Commit**
  `git add frontend/src/lib/site-navigation.ts frontend/src/lib/site-navigation.test.ts frontend/src/lib/header-menu.ts frontend/src/lib/header-menu.test.ts frontend/src/components/astro/SiteHeader.astro && git commit -m "feat(navegacao): recupera descoberta pelo header"`

### Task 4: Configurar recursos no admin

**Files:**
- Create: `frontend/src/components/islands/admin/eventos/EventResourcesDialog.tsx`, `EventResourcesDialog.test.tsx`
- Modify: `EventosAdminApp.tsx`, `InternalEventAccordion.tsx`, `ExternalEventCard.tsx`, `types.ts`, `frontend/src/components/islands/AppNavIsland.tsx` e testes associados

**Interfaces:**
- Consumes: endpoints da Task 2.
- Produces: dialog por `HubRow` com resumo dos recursos/deep links existentes, formulário C4P e link para `/admin/c4p/detalhe?id=<id>` após sucesso.

- [ ] **Step 1: Write failing UI tests**
  Verificar resumo dos recursos existentes, slug/nome derivados, POST próprio/externo, `communityProjectKey` na primeira ativação externa, erro visível, repetição não duplicada e deep link para curadoria. Sidebar não contém C4P dedicado.
- [ ] **Step 2: Run tests RED**
  Run: `cd frontend && npx vitest run src/components/islands/admin/eventos/EventResourcesDialog.test.tsx src/components/islands/admin/eventos/__tests__/eventos.test.tsx src/components/islands/AppNavIsland.test.tsx`
  Expected: componente/ações ausentes.
- [ ] **Step 3: Implement resources entry and C4P activation**
  Adicionar Configurar recursos nos dois tipos de linha, dialog controlado por `EventosAdminApp`, payloads específicos, estado de erro/sucesso e refresh das activations externas. Remover o item C4P do sidebar, mantendo a rota.
- [ ] **Step 4: Run focused tests GREEN**
  Run: comando do Step 2. Expected: todos PASS.
- [ ] **Step 5: Commit**
  `git add frontend/src/components/islands/admin/eventos frontend/src/components/islands/AppNavIsland.tsx frontend/src/components/islands/AppNavIsland.test.tsx && git commit -m "feat(eventos): configura C4P como recurso"`

### Task 5: C4P nas páginas estáticas, filtros e redirects

**Files:**
- Create: `frontend/src/lib/event-c4p.ts`, `event-c4p.test.ts`, `event-resource-filter.ts`, `event-resource-filter.test.ts`
- Modify: `frontend/src/lib/c4p.ts`, testes, `frontend/src/pages/eventos/[...path].astro`, `eventos/index.astro`, `frontend/scripts/build-tenant-redirects.mjs` e testes associados

**Interfaces:**
- Consumes: `C4pSnapshotCall.externalEventKey?: string | null`.
- Produces: `findPublicC4pForEvent(event,calls,now)`, filtros combinados `source`/`recurso` e seção pública de C4P na atividade.

- [ ] **Step 1: Write failing loader/helper and redirect tests**
  Cobrir associação por slug/`${sourceKey}:${id}`, janela aberta, resultado de evento passado, ausência de PII, `externalEventKey` inválido, AND de filtros, ida/volta do histórico e `/c4p → /eventos?recurso=c4p`.
- [ ] **Step 2: Run tests RED**
  Run: `cd frontend && npx vitest run src/lib/c4p.test.ts src/lib/event-c4p.test.ts src/lib/event-resource-filter.test.ts scripts/build-tenant-redirects.test.mjs`
  Expected: helpers/campo/redirect ausentes.
- [ ] **Step 3: Implement static association and event section**
  Decorar detalhe com CTA Submeter, estado fechado ou resumo de resultados permitidos; não incluir dados privados nem duplicar formulário.
- [ ] **Step 4: Implement combined listing filters and redirect**
  Marcar cards associados, manter estatísticas/seções/paginação no subconjunto, combinar query/histórico e adicionar redirect versionado sem página-sombra.
- [ ] **Step 5: Run focused tests GREEN**
  Run: comando do Step 2. Expected: todos PASS.
- [ ] **Step 6: Commit**
  `git add frontend/src/lib/c4p.ts frontend/src/lib/c4p.test.ts frontend/src/lib/event-c4p.ts frontend/src/lib/event-c4p.test.ts frontend/src/lib/event-resource-filter.ts frontend/src/lib/event-resource-filter.test.ts frontend/src/pages/eventos frontend/scripts/build-tenant-redirects.mjs frontend/scripts/build-tenant-redirects.test.mjs && git commit -m "feat(c4p): integra descoberta às atividades"`

### Task 6: Jornada real isolada, documentação e release

**Files:**
- Modify: `backend/test/c4p.e2e-spec.ts`, `docs/adrs/001-event-platform.md`, `012-c4p.md`, `docs/modules/events/CODE_MANUAL.md`, `ROLES.md`, `AGENTS.md`, `docs/plans/README.md`, `CHANGELOG.md`, versões/lockfiles e este plano.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: evidências completas e documentação da release, sem deploy.

- [ ] **Step 1: Add failing E2E journey**
  Em PostgreSQL `_test`, cobrir migration 053 down/up, evento próprio/externo → ativação idempotente → submissão → avaliação/finalização → snapshot associado; preservar registros legados e features genéricas.
- [ ] **Step 2: Run E2E RED then implement only confirmed gaps**
  Run: `cd backend && npm run test:e2e -- --runInBand test/c4p.e2e-spec.ts`
  Expected: cenário novo falha antes da implementação; qualquer correção repete RED→GREEN.
- [ ] **Step 3: Run complete project gates**
  Run: `cd backend && npm run build && npx jest --silent`; `cd frontend && npm run check && npm run test`; `npm run test:scripts`; `make astro-verify && make astro-verify-tenants`.
  Expected: todos PASS.
- [ ] **Step 4: Inspect real journeys in browser**
  Servir build local com dados sintéticos e testar header desktop/mobile/teclado, atividade com/sem C4P, filtros combinados e dialog admin nos dois temas. Nenhuma chamada real de produção.
- [ ] **Step 5: Synchronize docs and release**
  Atualizar ADRs/manuais/AGENTS/índice/changelog, alinhar frontend/backend e lockfiles com bump minor de feature e registrar evidências neste plano. Remover artefatos gerados que não pertencem ao commit.
- [ ] **Step 6: Commit**
  `git add backend/test/c4p.e2e-spec.ts docs AGENTS.md CHANGELOG.md backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json && git commit -m "docs(eventos): consolida C4P por atividade"`
