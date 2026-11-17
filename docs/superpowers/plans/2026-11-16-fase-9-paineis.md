<!-- AGENT-INDEX
purpose: Plano TDD executável da Fase 9 — UX de /membro/admin e autosserviço de privacidade com exportação e solicitação revisada de exclusão.
audience: Implementadores e revisores; leitura obrigatória junto da spec aprovada.
status: Aguardando revisão do plano pela presidência (2026-11-16); tarefas ainda não implementadas.
sections:
  - Constraints e Review Focus
  - Frente A: navegação e históricos (tasks 1–4)
  - Frente B: privacidade backend/frontend/admin (tasks 5–9)
  - Documentação e gates (task 10)
related-docs:
  - docs/superpowers/specs/2026-11-16-fase-9-paineis-design.md — spec aprovada e contratos completos.
agent-protocol:
  - Executar nativamente, task por task, com RED→GREEN e commit por task.
  - Não reordenar dependências: 2–4 dependem de 1; 6/9 dependem de 5; 8 depende de 5–7.
-->

# Fase 9 — Painéis e Privacidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplificar `/membro` e a navegação admin e entregar prévia de privacidade, exportação JSON e solicitação revisada de exclusão de conta.

**Architecture:** Manter Astro/React/MUI e reorganizar os componentes existentes sem novas dependências. Criar `backend/src/privacy/` para isolar exportação e pedidos de exclusão, usando PostgreSQL/TypeORM, auditoria e os guards atuais.

**Tech Stack:** TypeScript, React 19, MUI v9, Vitest, NestJS 11, TypeORM 0.3, PostgreSQL 18, Jest/Supertest.

**Spec:** `docs/superpowers/specs/2026-11-16-fase-9-paineis-design.md`

## Global Constraints

- Não alterar framework, layouts, tokens, logo ou cores do Design System.
- Não incluir pendências dinâmicas no Início nem contadores na sidebar.
- Não executar anonimização, desativação ou exclusão ao criar uma solicitação.
- Reembolsos usa `tab=reimbursements`; `tab=wallet` é alias legado.
- “Tudo” agrega blocos por tipo; não cria paginação cronológica global.
- Backend `1.2.0`, migration `051`, ADR `019`.
- Revisão jurídica/da diretoria é gate antes de `main`.

## Review Focus

- **Exportação com sessões/compras envolvendo terceiros:** ocultar nome/e-mail de mentorandos e participantes; testar em Task 7.
- **Cliques/concorrência em “Solicitar exclusão”:** no máximo uma pendência por membro; testar service e E2E em Task 5.
- **Conclusão admin sem offboarding automático:** `complete` muda somente o pedido, nunca `members`; testar em Tasks 6 e 9.
- **Deep links antigos e certificado selecionado:** aliases resolvem o mesmo filtro e `certificate` sobrevive à canonicalização; testar em Tasks 1 e 2.
- **Dados paginados no Início:** nenhum valor da página corrente é apresentado como total; testar em Task 3.
- **Falha de exportação no navegador:** não baixar arquivo vazio e revogar a URL temporária; testar em Task 8.

---

## Frente A — Navegação e históricos

### Task 1: Modelo de navegação e `FilterChipGroup`

**Files:**
- Modify: `frontend/src/lib/member-navigation.ts`
- Test: `frontend/src/lib/member-navigation.test.ts`
- Create: `frontend/src/components/islands/ui/FilterChipGroup.tsx`
- Test: `frontend/src/components/islands/ui/FilterChipGroup.test.tsx`

**Interfaces:**
- Produces: `ParticipationFilter = "all" | "events" | "certificates" | "projects"`, `FinanceFilter = "all" | "donations" | "subscriptions" | "reimbursements"`, `EventFilter = "future" | "purchased" | "history"`.
- Produces: `MemberLocation { section; tab?: string; event?: EventFilter }` e `buildMemberHref(section, tab?, event?)`.
- Produces: `FilterChipGroup<T extends string>({ label, value, options, onChange })`, com options `{value,label}[]` e `onChange(value: T)`.

- [ ] **Step 1 — RED:** adicionar testes para defaults `all`, `tab=events&event=purchased`, aliases `future/purchased/history/wallet`, `purchase=success`, certificado e valores inválidos. Testar o chip com `aria-pressed=true` somente no valor atual e callback com o valor escolhido.

```ts
expect(memberSectionFromSearchParams("?tab=wallet")).toEqual({ section: "finance", tab: "reimbursements" });
expect(buildMemberHref("participation", "events", "purchased")).toBe("?section=participation&tab=events&event=purchased");
```

- [ ] **Step 2 — verificar RED:** `cd frontend && npm run test -- src/lib/member-navigation.test.ts src/components/islands/ui/FilterChipGroup.test.tsx`; esperado: exports/comportamentos ausentes.
- [ ] **Step 3 — GREEN:** implementar parsing/serialização centralizados e o grupo de botões/Chips MUI com `role="group"`, `aria-label` e `aria-pressed`; preservar `certificate` fora do helper, como hoje.
- [ ] **Step 4 — verificar GREEN:** repetir o comando; esperado: todos os testes passam.
- [ ] **Step 5 — Commit:** `git add frontend/src/lib/member-navigation* frontend/src/components/islands/ui/FilterChipGroup* && git commit -m "feat(member): adiciona filtros por chips e deep links"`.

### Task 2: Participação e Eventos sem sub-abas

**Files:**
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/member/dashboard/EventsTab.tsx`
- Test: `frontend/src/components/islands/member/__tests__/member-dashboard.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`MemberLocation`, `buildMemberHref`, `FilterChipGroup`).
- Produces: filtros `all/events/certificates/projects` e `future/purchased/history` sem alterar endpoints.

- [ ] **Step 1 — RED:** testar quatro tabs principais; Tudo mostra Eventos/Certificados/Projetos; cada chip isola seu bloco; Eventos mostra chips Futuros/Comprei para outros/Histórico; nenhum seletor interno tem `role=tab`.
- [ ] **Step 2 — verificar RED:** `cd frontend && npm run test -- src/components/islands/member/__tests__/member-dashboard.test.tsx`; esperado: falha nos chips/agregação.
- [ ] **Step 3 — GREEN:** substituir as Tabs internas por `FilterChipGroup`; renderizar blocos condicionalmente; preservar carregamento sob demanda, certificado e compra. Canonicalizar aliases no efeito inicial sem remover `certificate`.
- [ ] **Step 4 — verificar GREEN:** repetir o teste e `npm run test -- src/lib/member-navigation.test.ts`; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add frontend/src/components/islands/member frontend/src/lib/member-navigation* && git commit -m "feat(member): simplifica participação e eventos"`.

### Task 3: Financeiro agregado e Início sem duplicação

**Files:**
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/member/dashboard/OverviewTab.tsx`
- Test: `frontend/src/components/islands/member/dashboard/OverviewTab.test.tsx`
- Test: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.test.tsx`
- Test: `frontend/src/components/islands/member/__tests__/member-dashboard.test.tsx`

**Interfaces:**
- Consumes: `FilterChipGroup` da Task 1.
- Preserves: `DonationsTab`, `SubscriptionsTab`, `WalletTab`, dialogs e paginações atuais.

- [ ] **Step 1 — RED:** testar Tudo com três blocos e cada filtro isolado; Início sem “Doações nesta página”/“Assinaturas ativas nesta página”, com “Abrir apoio e financeiro”; reembolso pendente só quando `pending > 0`.

```tsx
expect(screen.queryByText("Doações nesta página")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Abrir apoio e financeiro" })).toBeInTheDocument();
```

- [ ] **Step 2 — verificar RED:** rodar os três arquivos de teste; esperado: falha nos textos/blocos.
- [ ] **Step 3 — GREEN:** usar chips e condicionais compartilhados; remover props/cards redundantes do Overview; manter Clube e Solicitar Reembolso; não calcular totais novos.
- [ ] **Step 4 — verificar GREEN:** repetir os três arquivos; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add frontend/src/components/islands/member && git commit -m "feat(member): consolida apoio e financeiro"`.

### Task 4: Sidebar admin em seis grupos

**Files:**
- Modify: `frontend/src/components/islands/AppNavIsland.tsx`
- Test: `frontend/src/components/islands/__tests__/AppNavIsland.test.tsx`

**Interfaces:**
- Preserves: roles/designations, `isItemActive`, busca, collapse e logout.

- [ ] **Step 1 — RED:** atualizar testes para os grupos Início, Comunidades e eventos, Pessoas e aprendizado, Apoio e financeiro, Governança e transparência, Sistema; verificar todos os destinos da tabela da spec, “Minha mentoria” vs. “Gestão de mentoria”, ausência de “VirtualCoins” e permissões atuais.
- [ ] **Step 2 — verificar RED:** `cd frontend && npm run test -- src/components/islands/__tests__/AppNavIsland.test.tsx`; esperado: falha nos grupos/rótulos.
- [ ] **Step 3 — GREEN:** reordenar `MANAGEMENT_GROUPS` e `CONTA_ITEMS`; não adicionar fetch, badges ou guards novos.
- [ ] **Step 4 — verificar GREEN:** repetir o teste; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add frontend/src/components/islands/AppNavIsland.tsx frontend/src/components/islands/__tests__/AppNavIsland.test.tsx && git commit -m "feat(admin): reorganiza navegação por domínio"`.

## Frente B — Privacidade

### Task 5: Pedido de exclusão — modelo e API do membro

**Files:**
- Create: `backend/src/privacy/entities/account-deletion-request.entity.ts`
- Create: `backend/src/migrations/1795400000000-Migration051_AccountDeletionRequests.ts`
- Create: `backend/src/privacy/account-deletion.service.ts`
- Create: `backend/src/privacy/privacy.controller.ts`
- Create: `backend/src/privacy/privacy.module.ts`
- Create: `backend/src/privacy/account-deletion.service.spec.ts`
- Create: `backend/src/privacy/privacy.controller.spec.ts`
- Create: `backend/src/privacy/account-deletion.migration.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit-category.ts`
- Test: `backend/test/privacy.e2e-spec.ts`

**Interfaces:**
- Produces: `AccountDeletionRequest`, status `pending | completed | canceled`.
- Produces: `AccountDeletionService.latestForMember(memberId)`, `request(memberId)`, `cancel(memberId)`.
- Routes: `GET/POST /members/me/deletion-request`, `POST /members/me/deletion-request/cancel`.
- Audit: `MEMBER_DELETION_REQUESTED`, `MEMBER_DELETION_REQUEST_CANCELED`, `MEMBER_DELETION_REQUEST_COMPLETED`, `MEMBER_DATA_EXPORTED`.

- [ ] **Step 1 — RED:** testar migration/unique parcial, criação idempotente, retorno da pendência existente, cancelamento apenas pendente e ausência de mudança em `members`. Adicionar ao E2E duas chamadas concorrentes e autorização.
- [ ] **Step 2 — verificar RED:** `cd backend && npx jest --silent src/privacy && npx jest --config ./test/jest-e2e.json --runInBand test/privacy.e2e-spec.ts`; esperado: módulo/rotas/modelo ausentes.
- [ ] **Step 3 — GREEN:** criar módulo/entity/migration/service/controller; usar transaction + lock/unique para `request`; `cancel` condicional por membro/status; registrar audit de governo. Registrar `PrivacyModule` no boot real para cobrir DI.
- [ ] **Step 4 — verificar GREEN:** repetir ambos os comandos; esperado: unitários e E2E passam.
- [ ] **Step 5 — Commit:** `git add backend/src/privacy backend/src/migrations/1795400000000-Migration051_AccountDeletionRequests.ts backend/src/app.module.ts backend/src/audit backend/test/privacy.e2e-spec.ts && git commit -m "feat(privacy): solicita exclusão revisada de conta"`.

### Task 6: Fila admin e conclusão auditada

**Files:**
- Create: `backend/src/privacy/dto/get-account-deletion-requests-query.dto.ts`
- Create: `backend/src/privacy/dto/review-account-deletion-request.dto.ts`
- Modify: `backend/src/privacy/account-deletion.service.ts`
- Modify: `backend/src/privacy/privacy.controller.ts`
- Modify: `backend/src/privacy/account-deletion.service.spec.ts`
- Modify: `backend/src/privacy/privacy.controller.spec.ts`
- Modify: `backend/test/privacy.e2e-spec.ts`

**Interfaces:**
- Produces: `list({status,page,limit}): Promise<PaginatedResultDto<AccountDeletionRequest>>` e `complete(id, adminId, reviewNote?)`.
- Routes admin: `GET /admin/members/deletion-requests`, `POST /admin/members/deletion-requests/:id/complete`.

- [ ] **Step 1 — RED:** testar paginação default 50/cap 100, filtro de status, 403 sem admin, 404/409 em pedido inexistente/não pendente e conclusão sem alterar `members`.
- [ ] **Step 2 — verificar RED:** `cd backend && npx jest --silent src/privacy && npx jest --config ./test/jest-e2e.json --runInBand test/privacy.e2e-spec.ts`.
- [ ] **Step 3 — GREEN:** adicionar DTOs validados, update condicional `pending → completed`, ator/reviewNote e audit antes/depois; não chamar nenhum método de membro.
- [ ] **Step 4 — verificar GREEN:** repetir os comandos; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add backend/src/privacy backend/test/privacy.e2e-spec.ts && git commit -m "feat(privacy): adiciona revisão admin de exclusões"`.

### Task 7: Exportação JSON do titular

**Files:**
- Create: `backend/src/privacy/privacy-export.service.ts`
- Create: `backend/src/privacy/privacy-export.types.ts`
- Create: `backend/src/privacy/privacy-export.service.spec.ts`
- Modify: `backend/src/privacy/privacy.controller.ts`
- Modify: `backend/src/privacy/privacy.module.ts`
- Modify: `backend/src/privacy/privacy.controller.spec.ts`
- Modify: `backend/test/privacy.e2e-spec.ts`

**Interfaces:**
- Produces: `PrivacyExportService.exportMember(memberId: string): Promise<MemberDataExport>`.
- Produces: schema `1` com `generatedAt`, `subject`, `account`, `designations`, `events`, `mentorship`, `hours`, `projects`, `finance`, `c4p`, `communications`, `coverage`, `exclusions`.
- Route: `GET /members/me/export`, attachment `codaqui-dados-<handle>-<AAAA-MM-DD>.json`, rate limit 3/hora.

- [ ] **Step 1 — RED:** testar as dez seções e metadados; registros de outro membro não entram; tokens/Stripe/hash não entram; sessão do mentor omite mentorando e compra para terceiros omite attendee. Controller testa filename/content type; E2E testa JSON real e rate limit.

```ts
expect(exported.schemaVersion).toBe(1);
expect(JSON.stringify(exported)).not.toContain("githubAccessToken");
expect(exported.mentorship.sessionsAsMentor[0]).not.toHaveProperty("menteeEmail");
```

- [ ] **Step 2 — verificar RED:** `cd backend && npx jest --silent src/privacy && npx jest --config ./test/jest-e2e.json --runInBand test/privacy.e2e-spec.ts`.
- [ ] **Step 3 — GREEN:** implementar `PrivacyExportService` com repositories TypeORM via `DataSource`, consultas limitadas ao titular e projeções explícitas. Controller escreve attachment JSON e audit operacional sem conteúdo. Não usar dump SQL genérico.
- [ ] **Step 4 — verificar GREEN:** repetir os comandos; esperado: PASS e cobertura global mantida.
- [ ] **Step 5 — Commit:** `git add backend/src/privacy backend/test/privacy.e2e-spec.ts && git commit -m "feat(privacy): exporta dados pessoais em JSON"`.

### Task 8: Prévia, download e solicitação no `/membro`

**Files:**
- Create: `frontend/src/components/islands/member/privacy/ProfileVisibilityPreview.tsx`
- Create: `frontend/src/components/islands/member/privacy/AccountPrivacyActions.tsx`
- Modify: `frontend/src/components/islands/member/privacy/MyDataTab.tsx`
- Test: `frontend/src/components/islands/member/privacy/MyDataTab.test.tsx`
- Create: `frontend/src/components/islands/member/privacy/ProfileVisibilityPreview.test.tsx`

**Interfaces:**
- Consumes: rotas das Tasks 5 e 7 e consentimentos já existentes.
- Produces: `ProfileVisibilityPreview({user, visibility, fields})`; `AccountPrivacyActions` gerencia download e ciclo do pedido sem alterar membro.

- [ ] **Step 1 — RED:** testar prévia com estado não salvo dos switches; download com Blob/nome/ revoke; erro sem arquivo; criar/ver/cancelar pedido; textos “Solicitar exclusão” e revisão, nunca remoção imediata; foco/loading/erro.
- [ ] **Step 2 — verificar RED:** `cd frontend && npm run test -- src/components/islands/member/privacy/MyDataTab.test.tsx src/components/islands/member/privacy/ProfileVisibilityPreview.test.tsx`.
- [ ] **Step 3 — GREEN:** montar duas colunas responsivas, prévia e ações; usar `authFetch`, Blob/`URL.createObjectURL`/revoke e `ModalConfirm`; manter marketing e visibilidade existentes.
- [ ] **Step 4 — verificar GREEN:** repetir os testes; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add frontend/src/components/islands/member/privacy && git commit -m "feat(member): adiciona autosserviço de privacidade"`.

### Task 9: Fila de exclusões na página de Membros

**Files:**
- Create: `frontend/src/components/islands/admin/hub/AccountDeletionRequests.tsx`
- Modify: `frontend/src/components/islands/admin/hub/AdminHubApp.tsx`
- Test: `frontend/src/components/islands/admin/hub/__tests__/admin-hub.test.tsx`

**Interfaces:**
- Consumes: Task 6 e `PaginationControls`/`ModalConfirm` existentes.
- Produces: fila dentro de `/admin`, sem rota nova.

- [ ] **Step 1 — RED:** testar loading/erro/retry, filtro status, paginação, conclusão confirmada e que nenhuma ação de membro é disparada pela conclusão.
- [ ] **Step 2 — verificar RED:** `cd frontend && npm run test -- src/components/islands/admin/hub/__tests__/admin-hub.test.tsx`.
- [ ] **Step 3 — GREEN:** criar componente com `authFetch`, `parseAuthJson`, envelope paginado e confirmação explícita do offboarding manual; integrar sob a gestão de membros.
- [ ] **Step 4 — verificar GREEN:** repetir o teste; esperado: PASS.
- [ ] **Step 5 — Commit:** `git add frontend/src/components/islands/admin/hub && git commit -m "feat(admin): gerencia solicitações de exclusão"`.

### Task 10: ADR, documentação viva e gates finais

**Files:**
- Create: `docs/adrs/019-privacy-self-service.md`
- Modify: `backend/package.json` (`1.2.0`)
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/plans/pos-1-0/README.md`
- Modify: `docs/plans/frontend-jornadas/README.md`
- Modify: `docs/modules/privacy/README.md`
- Modify: `docs/modules/privacy/treatments.md`
- Modify: `frontend/src/pages/sobre/privacidade.astro`
- Modify: `docs/superpowers/specs/2026-11-16-fase-9-paineis-design.md`
- Modify: `docs/superpowers/plans/2026-11-16-fase-9-paineis.md`

- [ ] **Step 1 — documentar somente o implementado:** ADR 019 com schema/export, pedidos revisados, invariantes, auditoria e rollout; atualizar índices, tratamentos, política e status sem antecipar conclusão.
- [ ] **Step 2 — gates backend:** `cd backend && npm run build && npx jest --silent`; esperado: build e suíte completa verdes.
- [ ] **Step 3 — E2E real:** `cd backend && npx jest --config ./test/jest-e2e.json --runInBand test/privacy.e2e-spec.ts`; esperado: exportação, ciclo, concorrência e autorização verdes em PostgreSQL.
- [ ] **Step 4 — gates frontend:** `make astro-verify && make astro-verify-tenants`; esperado: build/check/testes/URLs verdes.
- [ ] **Step 5 — higiene e revisão:** `git diff --check`, `git status --short`, remover somente artefatos gerados; revisão independente sem Critical/Important e Sonar sem issues/duplicação nova. Obter revisão jurídica/da diretoria antes de merge em `main`.
- [ ] **Step 6 — Commit:** `git add AGENTS.md backend/package.json docs frontend/src/pages/sobre/privacidade.astro && git commit -m "docs(fase-9): registra privacidade e rollout"`.
