<!-- AGENT-INDEX
purpose: Plano TDD da Fase 10.3 — completar conversão empresarial, corrigir base da API e padronizar tabelas admin.
audience: Implementadores e revisores.
status: Pronto para execução após a Fase 10.2 e revisão do plano.
related-docs:
  - ../specs/2026-11-18-journeys-mockups-design.md — limites da robustez administrativa.
agent-protocol:
  - Não mudar regras financeiras, idempotência ou status da conversão; nenhuma conversão real pertence à verificação.
-->

# Fase 10.3 — Robustez Administrativa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Eliminar omissões silenciosas na conversão empresarial e padronizar resolução de API, paginação, loading e retry nas telas administrativas tocadas.

**Architecture:** Uma consulta admin por responsável substitui filtragem da primeira página de empresas; cursor nativo de Stripe Search substitui o limite único. No frontend, as ilhas continuam usando os contratos atuais, com `PaginationControls` e helpers de API já existentes.

**Tech Stack:** NestJS 11, Stripe SDK 21, TypeORM, React 19, MUI v9, Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-11-18-journeys-mockups-design.md`

## Global Constraints

- Não alterar checkout, preço, assinatura, ledger, wallet, idempotência ou autorização da conversão.
- Não executar mutações reais no Stripe nem conversões de produção.
- Não adicionar dependências, contadores de sidebar ou dashboard agregado.
- Usar `resolveApiUrl(import.meta.env.SITE)`/`authFetch`; não alargar a allow-list do proxy.
- Paginação somente onde existe contrato real; não inventar envelope ou página no cliente.

## Review Focus

- Mais de 100 empresas/assinaturas: espera-se continuação sem omitir candidato; Tasks 1–2 testam cursores e consulta direta.
- Cursor repetido/1.000 resultados: espera-se erro explícito em vez de loop ou falsa lista completa; Task 2 testa guarda.
- Falha de uma página Stripe após página válida: espera-se erro e nenhuma conversão automática; Task 2 testa propagação.
- Filtro que reduz totalPages: espera-se página válida e nenhum request impossível; Task 4 testa clamp/reset.
- Falha de reload após sucesso anterior: espera-se erro visível sem falso sucesso e retry preservando filtros; Task 5 testa.

---

### Task 1: Empresas do membro sem atravessar a listagem geral

**Files:**
- Modify: `backend/src/companies/companies.service.ts`
- Modify: `backend/src/companies/companies.controller.ts`
- Test: `backend/src/companies/companies.service.spec.ts`
- Test: `backend/src/companies/companies.controller.spec.ts`

**Interfaces:**
- Produces: `CompaniesService.findAdminByResponsible(memberId: string): Promise<Company[]>`.
- Route admin: `GET /companies/admin/members/:memberId/companies`, com UUID validado.
- Consumes: `companyRepo.find({where:{responsibleMemberId},order:{name:'ASC'}})` e campos já usados pelo painel.

- [x] **Step 1: Escrever testes falhos**
  Cobrir admin autorizado, UUID inválido 400, somente empresas do membro, múltiplas empresas além da página geral, ordenação por nome e ausência de métricas/wallets desnecessárias.

- [x] **Step 2: Confirmar a falha**
  Run: `cd backend && npx jest src/companies/companies.service.spec.ts src/companies/companies.controller.spec.ts --runInBand`
  Expected: FAIL pelo método/rota ausentes.

- [x] **Step 3: Implementar consulta estreita**
  Manter `JwtAuthGuard`, `RolesGuard` e admin; retornar entidades/projeção com id, responsibleMemberId, status e campos de perfil necessários. Declarar a rota antes de parâmetros dinâmicos que possam capturá-la.

- [x] **Step 4: Verificar**
  Run: `cd backend && npx jest src/companies/companies.service.spec.ts src/companies/companies.controller.spec.ts --runInBand`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add backend/src/companies/companies.service.ts backend/src/companies/companies.controller.ts backend/src/companies/*.spec.ts && git commit -m "feat(fase-10): consulta empresas do membro no admin"`

### Task 2: Paginação completa e defensiva do Stripe Search

**Files:**
- Modify: `backend/src/companies/company-subscription-conversion.service.ts`
- Test: `backend/src/companies/company-subscription-conversion.service.spec.ts`

**Interfaces:**
- Preserves: `listPersonalSubscriptions(memberId): Promise<PersonalSubscriptionOption[]>`.
- Consumes: `stripe.subscriptions.search({query,limit:100,page?})`, `has_more`, `next_page` e `data`.

- [x] **Step 1: Escrever testes falhos de múltiplas páginas**
  Simular duas páginas com business/anuais misturados; afirmar segunda chamada com `next_page`, resultado completo e filtros preservados. Testar ausência de `next_page` com `has_more=true`, cursor repetido e limite defensivo de 1.000, todos com erro explícito; testar falha da segunda página sem retornar parcial.

- [x] **Step 2: Confirmar a falha**
  Run: `cd backend && npx jest src/companies/company-subscription-conversion.service.spec.ts --runInBand`
  Expected: FAIL porque somente a primeira página é consultada.

- [x] **Step 3: Implementar loop por cursor**
  Acumular somente até 1.000 resultados crus, controlar cursores vistos e lançar `BadGatewayException`/erro de provider apropriado em paginação inválida/estouro. Aplicar a projeção mensal existente somente após a coleta completa; não chamar conversão.

- [x] **Step 4: Verificar**
  Run: `cd backend && npx jest src/companies/company-subscription-conversion*.spec.ts --runInBand`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add backend/src/companies/company-subscription-conversion.service.ts backend/src/companies/company-subscription-conversion.service.spec.ts && git commit -m "fix(fase-10): percorre todas as assinaturas pessoais elegíveis"`

### Task 3: Painel de conversão atualizado sem regressões

**Files:**
- Modify: `frontend/src/components/islands/admin/empresas/SubscriptionConversionPanel.tsx`
- Test: `frontend/src/components/islands/admin/empresas/SubscriptionConversionPanel.test.tsx`

**Interfaces:**
- Consumes: rota da Task 1 e contrato inalterado de assinaturas/conversão.
- Produces: formatação `formatSubscriptionPeriodEnd(value: string | null): string` em helper local ou lib existente, usando `Intl.DateTimeFormat('pt-BR')`.

- [x] **Step 1: Escrever testes falhos**
  Afirmar chamada à rota por membro em vez de `admin/list?page=1&limit=100`, seleção entre empresas retornadas, data válida em pt-BR, valor null como “Não informado” e preservação de salvar perfil/converter/`already_converted`.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/components/islands/admin/empresas/SubscriptionConversionPanel.test.tsx`
  Expected: FAIL pelas chamadas/formatação antigas.

- [x] **Step 3: Atualizar somente carregamento e apresentação**
  Remover filtro da primeira página, manter reset de estado e confirmação explícita. Usar formatter determinístico para data ISO e não alterar payloads da conversão.

- [x] **Step 4: Verificar**
  Run: `cd frontend && npx vitest run src/components/islands/admin/empresas`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/components/islands/admin/empresas/SubscriptionConversionPanel* && git commit -m "fix(fase-10): completa candidatos da conversão empresarial"`

### Task 4: Base de API e paginação acessível padronizadas

**Files:**
- Modify: `frontend/src/components/islands/admin/pagamentos/PagamentosApp.tsx`
- Modify: `frontend/src/components/islands/admin/recebimentos/RecebimentosApp.tsx`
- Modify: `frontend/src/components/islands/admin/reembolsos/ReembolsosApp.tsx`
- Modify: `frontend/src/components/islands/admin/eventos/EventosAdminApp.tsx`
- Modify: `frontend/src/components/islands/admin/overrides/OverridesApp.tsx`
- Modify: `frontend/src/components/islands/admin/overrides/OverridesTab.tsx`
- Modify: `frontend/src/components/islands/admin/overrides/EventOverrideHistory.tsx`
- Modify: `frontend/src/components/islands/admin/empresas/EmpresasApp.tsx`
- Modify: `frontend/src/components/islands/admin/emails/EmailsApp.tsx`
- Modify: `frontend/src/components/islands/admin/emails/EmailsCampaignsTab.tsx`
- Modify: `frontend/src/components/islands/admin/events/EventOrdersDialog.tsx`
- Modify: `frontend/src/components/islands/admin/ui/DataTable.tsx`
- Tests: testes existentes adjacentes a cada ilha; criar teste somente para comportamento novo ainda não coberto.

**Interfaces:**
- Consumes: `resolveApiUrl`, `useAuth.authFetch`, `PaginationControls({page,totalPages,onChange,itemLabel})` e helpers de `lib/pagination`.
- Preserves: envelopes, filtros e requests existentes.

- [x] **Step 1: Escrever/ajustar testes falhos**
  Cobrir URL resolvida nos fetchs protegidos/públicos e presença de `nav[aria-label="Paginação de …"]`/`aria-current` em empresas, eventos, e-mails, pedidos e DataTable. Testar mudança de filtro que reduz páginas, retornando página 1/clamp sem perder filtros.

- [x] **Step 2: Confirmar falhas focadas**
  Run: `cd frontend && npx vitest run src/components/islands/admin/empresas src/components/islands/admin/overrides src/components/islands/admin/emails src/components/islands/admin/events src/lib/api-url.test.ts`
  Expected: FAIL somente nos comportamentos novos ainda ausentes; falhas pré-existentes devem ser registradas, não mascaradas.

- [x] **Step 3: Migrar imports e controles**
  Remover `API_URL` produtivo dos sete arquivos listados; usar base resolvida para `fetch` público e `authFetch` relativo para sessão. Substituir `Pagination`/`TablePagination` pelos controles compartilhados, calculando `totalPages` do envelope real. Não alterar endpoints ou caps.

- [x] **Step 4: Verificar e varrer anti-pattern**
  Run: `cd frontend && npx vitest run src/components/islands/admin src/lib/api-url.test.ts && npm run check`
  Expected: PASS. Buscar `API_URL` nos arquivos produtivos listados e confirmar que restam apenas comentários realmente históricos, removendo referências obsoletas quando apropriado.

- [x] **Step 5: Commit**
  `git add frontend/src/components/islands/admin frontend/src/lib && git commit -m "fix(fase-10): padroniza API e paginação do admin"`

### Task 5: Skeleton, retry e verificação integrada do admin

**Files:**
- Modify: somente ilhas da Task 4 que ainda não possuem skeleton/retry.
- Tests: testes adjacentes das ilhas alteradas.
- Modify: `docs/superpowers/plans/2026-11-18-admin-robustness.md` com evidências.

- [x] **Step 1: Escrever testes falhos de recuperação**
  Para cada tabela alterada sem recuperação: loading usa Skeleton; erro oferece “Tentar novamente”; retry repete o request com página/filtros atuais; erro após dados anteriores não exibe sucesso falso nem limpa filtros.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/components/islands/admin`
  Expected: FAIL nos estados novos ausentes.

- [x] **Step 3: Implementar estados mínimos compartilhados**
  Reutilizar `parseAuthJson`, `extractErrorMessage`, Skeleton MUI e padrões existentes; não criar novo framework de fetching nem refatorar ilhas fora da lista.

- [x] **Step 4: Executar testes e jornada isolada de conversão**
  Run: `cd backend && npm run build && npx jest src/companies --runInBand`
  Run: `cd frontend && npx vitest run src/components/islands/admin`
  Em dump/Stripe mock isolado, exercitar membro com empresa fora das primeiras 100, duas páginas de assinaturas, primeira conversão `converted` e repetição `already_converted`; nenhum provider real sofre mutação.

- [x] **Step 5: Commit**
  `git add frontend/src/components/islands/admin docs/superpowers/plans/2026-11-18-admin-robustness.md && git commit -m "fix(fase-10): melhora recuperação das tabelas administrativas"`

## Evidência de execução — 2026-11-18

- Suíte administrativa: 38 arquivos/303 testes e `astro check` aprovados após skeleton/retry.
- Jornada PostgreSQL com provider Stripe totalmente mockado: empresa-alvo fora das primeiras 100 foi encontrada pela consulta direta; duas páginas de assinaturas foram percorridas; primeira conversão `converted`, repetição `already_converted` com o mesmo conversionId.
- Foram preservados uma conversão, uma wallet e uma única atualização de metadados; a empresa existente permaneceu `active`. Nenhum provider externo sofreu mutação.
- As fixtures respeitaram unique/not-null de CNPJ e responsável; banco e role temporários foram removidos.
