<!-- AGENT-INDEX
purpose: Plano TDD da correção de confiança informacional, acessibilidade e descoberta nas jornadas públicas.
audience: Implementadores e revisores.
status: Concluída em 1.9.1 na PR #664 para develop, com TDD, gates, evidência visual e revisão independente sem achados críticos/importantes.
related-docs:
  - ../specs/2026-11-23-frontend-trust-discovery-design.md — desenho aprovado.
  - ../../plans/frontend-jornadas/README.md — inventário vivo.
agent-protocol:
  - Executar as tasks em ordem; não ampliar para admin, dados de insights ou noscript.
  - Não commitar ou publicar sem solicitação explícita; cada task termina com testes verdes e diff revisado.
-->

# Confiança e Descoberta no Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar falsos zeros financeiros, corrigir as barreiras de acessibilidade identificadas e tornar `/empresas` e `/regex` descobribles pelo rodapé.

**Architecture:** Manter as ilhas React/MUI e o shell Astro atuais, separando explicitamente loading, erro, ausência e dados válidos. Alterações semânticas preservam os variants visuais, enquanto o mapa compartilhado de navegação passa a incluir os dois destinos somente no footer.

**Tech Stack:** Astro 7, React 19, MUI v9, Tailwind v4, tokens `--cq-*`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-frontend-trust-discovery-design.md`

## Global Constraints

- Preservar framework, tokens primitivos, layout, URLs, redirects e conteúdo factual.
- Zero só aparece quando retornado por uma resposta válida; erro ou ausência de conta usa `—`.
- Não adicionar dependências nem alterar a navegação principal.
- Não editar snapshots gerados ou conteúdo canônico fora do escopo.
- Atualizar documentação viva e changelog somente após verificação.

## Review Focus

- Falha de uma fonte com sucesso da outra: espera-se preservar os dados válidos e oferecer retry somente na fonte com erro; Tasks 1 e 2 testam independência.
- Zero legítimo retornado pela API: espera-se `R$ 0,00`, não `—`; Tasks 1 e 2 incluem esse caso.
- Comunidade sem conta em resposta válida: espera-se `—` e empty state, não saldo zero; Task 2 fixa o comportamento.
- Tema escuro e claro: espera-se o par semântico de ação em chips/CTA, sem foreground fixo incompatível; Task 3 testa a fonte e a verificação visual cobre ambos.
- Sucesso após retry: espera-se substituição de `—` pelos valores reais sem desmontar atividades/tabela; Tasks 1 e 2 exercitam a transição.

---

### Task 1: KPIs globais sem falso zero

**Files:**
- Create: `frontend/src/components/islands/__tests__/TransparencyApp.test.tsx`
- Modify: `frontend/src/components/islands/TransparencyApp.tsx:44-180,277-302`

**Interfaces:**
- Consumes: `CommunityBalance[]`, `TransparencyStats`, `formatBRL`, `resolveApiUrl` e `TransactionTable` existentes.
- Produces: estados independentes para saldos e estatísticas, retry nomeado por fonte e valores `ReactNode` com `—` quando desconhecidos.

- [x] **Step 1: Escrever testes falhos de erro, zero e retry**

Mockar `TransactionTable` e as duas URLs. Testar: HTTP 503 nas duas fontes produz cinco `—` e nenhum `R$ 0,00`; resposta válida com todos os valores zero preserva `R$ 0,00`; clicar em **Tentar novamente estatísticas** recupera somente estatísticas sem desmontar a tabela de saldos; valores de KPI não expõem heading de nível 4.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/TransparencyApp.test.tsx`
Expected: FAIL pelos zeros, retry/estados ausentes e headings atuais.

- [x] **Step 3: Implementar estados e retry independentes**

Extrair loaders com `useCallback`, manter `balancesError`/`statsError`, limpar somente o erro da fonte em nova tentativa e usar `KpiCard` com `component="p"`. Alertas de erro oferecem botões **Tentar novamente saldos** e **Tentar novamente estatísticas**; remover a afirmação de disponibilidade em produção.

- [x] **Step 4: Verificar a task**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/TransparencyApp.test.tsx src/lib/ui-production-review.test.ts`
Expected: PASS.

- [x] **Step 5: Revisar o diff da task**

Run: `git diff --check -- frontend/src/components/islands/TransparencyApp.tsx frontend/src/components/islands/__tests__/TransparencyApp.test.tsx`
Expected: exit 0, sem mudanças fora da Task 1.

### Task 2: Saldo comunitário desconhecido não é zero

**Files:**
- Modify: `frontend/src/components/islands/CommunityTransparencyIsland.tsx:43-74,211-284`
- Test: `frontend/src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`

**Interfaces:**
- Consumes: projeção de atividades e `TransactionTable` existentes.
- Produces: `retry` no hook de saldo e apresentação distinta para loading, erro, conta ausente e saldo numérico.

- [x] **Step 1: Ampliar os testes falhos**

No teste de ledger 503, afirmar `—` e ausência de `R$ 0,00`; no teste de comunidade sem conta, afirmar `—`; adicionar saldo zero legítimo e retry **Tentar novamente saldo**, com atividades e tabela válidas preservadas.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`
Expected: FAIL pelo `formatBRL(0)` e retry ausente.

- [x] **Step 3: Implementar retry e valor desconhecido**

Adicionar contador de tentativa ao hook, resetar erro/loading por tentativa, expor `retry`, usar `balance ? formatBRL(balance.balance) : "—"` e ligar o alerta ao botão acessível **Tentar novamente saldo**.

- [x] **Step 4: Verificar a task**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`
Expected: PASS.

- [x] **Step 5: Revisar o diff da task**

Run: `git diff --check -- frontend/src/components/islands/CommunityTransparencyIsland.tsx frontend/src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`
Expected: exit 0, sem mudanças fora da Task 2.

### Task 3: Contraste e headings das jornadas

**Files:**
- Modify: `frontend/src/pages/comunidades/index.astro:67-104`
- Modify: `frontend/src/components/islands/DiscordWidgetIsland.tsx:128-146`
- Modify: `frontend/src/lib/ui-production-review.test.ts`
- Create: `frontend/src/components/islands/__tests__/DiscordWidgetIsland.test.tsx`

**Interfaces:**
- Consumes: tokens `bg-action`/`text-on-action` e variants MUI existentes.
- Produces: chip/CTA com foreground semântico e título do Discord como heading nível 2, sem alteração visual de escala.

- [x] **Step 1: Escrever testes falhos de estrutura**

Adicionar teste estático exigindo `bg-action text-on-action` nos dois elementos e rejeitando `text-white` no CTA. No teste do Discord, mockar um payload mínimo válido e afirmar `getByRole("heading", { level: 2, name: "Codaqui no Discord" })` sem heading nível 5.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/lib/ui-production-review.test.ts src/components/islands/__tests__/DiscordWidgetIsland.test.tsx`
Expected: FAIL pelas classes e pelo heading atual.

- [x] **Step 3: Aplicar semântica preservando aparência**

Trocar somente as classes de foreground/fundo indicadas e adicionar `component="h2"` ao `Typography` do título do Discord, mantendo `variant={compact ? "h6" : "h5"}`.

- [x] **Step 4: Verificar a task**

Run: `cd frontend && npx vitest run src/lib/ui-production-review.test.ts src/components/islands/__tests__/DiscordWidgetIsland.test.tsx`
Expected: PASS.

- [x] **Step 5: Revisar o diff da task**

Run: `git diff --check -- frontend/src/pages/comunidades/index.astro frontend/src/components/islands/DiscordWidgetIsland.tsx frontend/src/lib/ui-production-review.test.ts frontend/src/components/islands/__tests__/DiscordWidgetIsland.test.tsx`
Expected: exit 0, sem mudanças fora da Task 3.

### Task 4: Descoberta de Empresas e Regex

**Files:**
- Modify: `frontend/src/lib/site-navigation.ts:64-87`
- Test: `frontend/src/lib/site-navigation.test.ts:65-80`

**Interfaces:**
- Consumes: `FOOTER_NAVIGATION` e `SiteFooter.astro` já integrados.
- Produces: links **Empresas apoiadoras** (`/empresas`) e **Guia de Regex** (`/regex`).

- [x] **Step 1: Escrever o teste falho**

Exigir os dois pares label/href nos grupos **Participar** e **Conteúdo e contato**, respectivamente, e afirmar que `SITE_NAVIGATION` permanece inalterado.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/lib/site-navigation.test.ts`
Expected: FAIL porque os destinos ainda não existem no footer.

- [x] **Step 3: Adicionar somente os links do footer**

Inserir os dois `NavigationLink` nos grupos aprovados, sem alterar `SITE_NAVIGATION` ou redirects.

- [x] **Step 4: Verificar a task**

Run: `cd frontend && npx vitest run src/lib/site-navigation.test.ts src/lib/header-menu.test.ts`
Expected: PASS.

- [x] **Step 5: Revisar o diff da task**

Run: `git diff --check -- frontend/src/lib/site-navigation.ts frontend/src/lib/site-navigation.test.ts`
Expected: exit 0, sem mudanças fora da Task 4.

### Task 5: Gates, evidência visual e release documental

**Files:**
- Modify: `docs/plans/frontend-jornadas/README.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/superpowers/specs/2026-11-23-frontend-trust-discovery-design.md`
- Modify: `docs/superpowers/plans/2026-11-23-frontend-trust-discovery.md`
- Modify: `CHANGELOG.md`
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- Consumes: resultados das Tasks 1–4 e evidências dos gates.
- Produces: release documental 1.9.1 com escopo, verificação e pendências reais.

- [x] **Step 1: Rodar gates do frontend**

Run: `cd frontend && npm run check && npm run test && npm run build`
Expected: todos aprovados; investigar qualquer regressão antes de prosseguir.

- [x] **Step 2: Rodar gates integrados**

Run: `make astro-verify && make astro-verify-tenants`
Expected: portal, Function, smoke, URLs e quatro builds aprovados.

- [x] **Step 3: Verificar as jornadas renderizadas**

Inspecionar `/comunidades`, `/eventos` e `/transparencia` em 390×844 e 1440×900, claro/escuro, com `impeccable shot` e `detect --json <url> --viewport <WxH>`. Exercitar erros/retry com mocks locais quando possível; registrar limitações de backend autenticado sem declarar sucesso não observado.

- [x] **Step 4: Atualizar versão e documentação**

Run: `cd frontend && npm version 1.9.1 --no-git-tag-version && cd ../backend && npm version 1.9.1 --no-git-tag-version`
Atualizar AGENT-INDEX/status, inventário, índice, spec/plano e `CHANGELOG.md` com data 2026-11-23, testes efetivamente executados, estado em develop e ausência de migration.

- [x] **Step 5: Revisão final do workspace**

Run: `git diff --check && git status --short`
Expected: sem whitespace errors, artefatos de build, logs ou mudanças fora do escopo; marcar somente os passos efetivamente concluídos.
