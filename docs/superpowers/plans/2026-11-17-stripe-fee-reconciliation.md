<!-- AGENT-INDEX
purpose: Plano TDD da reconciliação manual idempotente de taxas Stripe no admin.
audience: Implementers e revisores
status: Concluída em develop com TDD, verificação integrada e gates; produção pendente de deploy
sections:
  - Constraints e review focus
  - Tasks 1–3
  - Gates finais
related-docs:
  - ../specs/2026-11-17-stripe-fee-reconciliation-design.md — evidências e desenho
agent-protocol: Executar em ordem, sem subagentes, com teste antes de cada mudança e sem commits automáticos.
-->

# Stripe Fee Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir que um admin consulte um PaymentIntent e crie apenas a taxa Stripe ausente no ledger, com repetição segura.

**Architecture:** Um endpoint em `StripeController` reutiliza `StripeService.recordStripeFee`, agora com resultado explícito e tratamento de corrida pela unique constraint. Uma aba admin no painel de lançamentos chama o endpoint e apresenta o resultado, sem migration ou nova rota de proxy.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, Stripe SDK 21, Jest 30, React 19, MUI 9, Vitest, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-17-stripe-fee-reconciliation-design.md`

## Global Constraints

- Não escrever na API Stripe, não recriar doações e não alterar a doação real durante os testes.
- Idempotência por `stripe-fee:<balanceTransactionId>` e pela unique constraint existente.
- Endpoint somente para `admin`; sem prefixo `/admin/` na API e sem migration.
- Usar `useAuth`/`authFetch`, MUI 9 e os padrões atuais das ilhas.
- Não fazer commits automáticos nem alterar versões/release neste branch de trabalho.

## Review Focus

- PaymentIntent com charge ou balance transaction ainda não expandido: retornar 409, sem escrita (Task 1).
- Balance transaction com fee zero: retornar `no_fee`, sem escrita (Task 1).
- PaymentIntent sem doação correspondente: retornar 404, sem escrita (Task 1).
- Duas chamadas concorrentes: a perdedora relê a taxa e retorna `already_exists` (Task 1).
- Falha de Stripe ou ledger: resposta de erro, nunca sucesso parcial (Tasks 1 e 3).

---

### Task 1: Núcleo idempotente e endpoint

**Files:**
- Modify: `backend/src/stripe/stripe.service.ts`
- Test: `backend/src/stripe/stripe.service.spec.ts`
- Modify: `backend/src/stripe/stripe.controller.ts`
- Test: `backend/src/stripe/stripe.controller.spec.ts`

**Interfaces:**
- Produces: `StripeService.reconcileFee(paymentIntentId: string)` retornando `{status: 'created'|'already_exists'|'no_fee', paymentIntentId, chargeId, balanceTransactionId, feeReferenceId, feeCents, transactionId?}`.
- Produces: `POST /stripe/reconcile-fee` com body `{paymentIntentId: string}`.
- Consumes: `recordStripeFee(chargeId, paymentIntentId, bt)` e `LedgerService.recordTransaction` existentes.

- [x] **Step 1: Escrever testes falhos do service**

Adicionar cenários para criação com fee 837, segunda execução `already_exists`, unique violation convertida em `already_exists`, `no_fee`, doação ausente (404), BT ausente (409), ID inválido (400) e retrieve Stripe rejeitado (502). Verificar que nenhum caminho de erro chama `recordTransaction`.

- [x] **Step 2: Rodar os testes e confirmar a falha**

Run: `cd backend && npx jest src/stripe/stripe.service.spec.ts --runInBand`
Expected: FAIL porque `reconcileFee` não existe.

- [x] **Step 3: Implementar o núcleo**

Fazer `recordStripeFee` retornar `created`, `already_exists` ou `not_recorded`, preservando o comportamento best-effort dos webhooks. No catch de gravação, reler `feeReferenceId`; se existir, retornar `already_exists`, senão logar e retornar `not_recorded`. Implementar `reconcileFee` com retrieve expandido e mapear `not_recorded` para `no_fee`, 404 ou erro de persistência conforme o estado.

- [x] **Step 4: Rodar os testes do service**

Run: `cd backend && npx jest src/stripe/stripe.service.spec.ts --runInBand`
Expected: PASS.

- [x] **Step 5: Escrever o teste do controller e implementar a rota**

Verificar delegação do body ao service. Adicionar `JwtAuthGuard`, `RolesGuard`, `@Roles('admin')` e documentação Swagger a `POST /stripe/reconcile-fee`. Rodar `stripe.controller.spec.ts` até PASS.

### Task 2: Auditoria da reconciliação

**Files:**
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit-category.ts`
- Modify: `backend/src/audit/audit-category.spec.ts`
- Modify: `backend/src/stripe/stripe.module.ts`
- Modify: `backend/src/stripe/stripe.controller.ts`
- Test: `backend/src/stripe/stripe.controller.spec.ts`

**Interfaces:**
- Produces: `AuditAction.STRIPE_FEE_RECONCILED = 'stripe.fee_reconciled'`, classificado como `governance`.
- Consumes: resultado `created` da Task 1.

- [x] **Step 1: Escrever testes falhos**

Exigir categoria governance para a nova ação e auditoria com IDs/valor somente quando o endpoint retorna `created`; `already_exists` não audita uma nova criação.

- [x] **Step 2: Rodar e confirmar a falha**

Run: `cd backend && npx jest src/audit/audit-category.spec.ts src/stripe/stripe.controller.spec.ts --runInBand`
Expected: FAIL porque a ação e o provider não existem.

- [x] **Step 3: Implementar e verificar**

Importar `AuditModule` no módulo Stripe, injetar `AuditService` no controller e registrar target UUID da transação e detalhes não pessoais. Rodar os mesmos testes até PASS.

### Task 3: Aba admin e documentação viva

**Files:**
- Create: `frontend/src/components/islands/admin/lancamento/StripeFeeReconciliationPanel.tsx`
- Create: `frontend/src/components/islands/admin/lancamento/__tests__/stripe-fee-reconciliation.test.tsx`
- Modify: `frontend/src/components/islands/admin/lancamento/LancamentoApp.tsx`
- Test: `frontend/src/components/islands/admin/lancamento/__tests__/lancamento.test.tsx`
- Modify: `docs/modules/MONOREPO_OPERATIONS.md`

**Interfaces:**
- Consumes: `POST /stripe/reconcile-fee` da Task 1.
- Produces: aba `Taxas Stripe`, também acessível por `/admin/lancamento?tab=stripe`, visível somente para admin.

- [x] **Step 1: Escrever testes falhos da ilha**

Testar envio do PaymentIntent, fee criada formatada em BRL, retorno `already_exists`, erro HTTP mantendo o input e botão desabilitado durante a chamada. No teste do painel de lançamentos, verificar que admin vê a aba e finance-analyzer não.

- [x] **Step 2: Rodar e confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/lancamento`
Expected: FAIL porque o componente/aba não existe.

- [x] **Step 3: Implementar a interface**

Criar o painel com TextField, botão, progresso e Alerts para os quatro resultados. Integrar a terceira aba somente para admin e aceitar `tab=stripe`, preservando as abas existentes. Documentar endpoint, idempotência e operação no guia do monorepo.

- [x] **Step 4: Rodar os testes da interface**

Run: `cd frontend && npx vitest run src/components/islands/admin/lancamento`
Expected: PASS.

### Gates finais

- [x] `cd backend && npm run build && npx jest --silent`
- [x] `make astro-verify`
- [x] `make astro-verify-tenants`
- [x] Conferir links Markdown alterados, `git status` e remover banco/script temporários da investigação.
- [x] Reportar a taxa real identificada e deixar a execução em produção para depois do deploy, sem afirmar que foi corrigida no banco real.
