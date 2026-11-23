<!-- AGENT-INDEX
purpose: Plano TDD de doações empresariais únicas para Tesouro e comunidades Integradas, separadas do CLUB Business.
audience: Implementadores e revisores.
status: Implementado em 1.10.0 com TDD, jornada PostgreSQL e evidência visual; revisão final e PR para develop em preparação.
related-docs:
  - ../specs/2026-11-23-company-one-time-donations-design.md — contrato aprovado.
  - ../../adrs/003-club-business-pj.md — regras da assinatura preservadas.
agent-protocol:
  - Executar na develop em tasks sequenciais; cada task termina com testes verdes e commit próprio.
  - Não realizar pagamento real, ativação real, migration ou alteração de benefícios.
-->

# Doações Empresariais Únicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o responsável por uma empresa `pending` ou `active` faça doações únicas para Tesouro ou comunidades Integradas, com recibo e ledger corretos, sem patrocínio ou benefícios adicionais.

**Architecture:** Um endpoint Stripe dedicado cria `mode: payment` com metadata empresarial, enquanto o webhook existente registra a doação e o responsável no ledger. No frontend, um seletor PJ apresenta assinatura ou pagamento único, compartilhando identidade da empresa e o catálogo de destinos.

**Tech Stack:** NestJS 11, TypeORM/PostgreSQL, Stripe Checkout, Astro 7, React 19, MUI v9, Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-11-23-company-one-time-donations-design.md`

## Global Constraints

- Somente `pending` e `active`; nunca alterar status, `subscriptionAmountCents`, vitrine, selo, badges ou SortCoins.
- Não usar `recurring`, `subscription_data`, `setSubscriptionAmount` ou `customer_creation`; não persistir novo customer para doação única.
- Preservar assinatura e deep links existentes; sem migration, cobrança real ou ativação real.
- Usar dupla partida, `referenceId` idempotente e validação server-side de comunidade e valor.
- Trabalhar na `develop`; ao final bump minor 1.10.0 e PR de `develop` para `main`.

## Review Focus

- Checkout assíncrono ainda `unpaid`: não registrar ledger antes de `async_payment_succeeded`; Task 2 cobre a transição.
- Empresa `past_due`, `suspended` ou `cancelled`: bloquear antes do Stripe com orientação de regularização; Task 1 testa cada status.
- Comunidade inexistente/inativa: nenhum Checkout Session é criado; Task 1 testa validação antes do provider.
- Empresa nova doando uma vez: aparece em Minhas doações e transparência, mas continua `pending` e fora de patrocinadores; Tasks 2 e 6 provam o conjunto.
- Assinatura existente: metadata, valor, invoice, recibo e SortCoins não mudam; Tasks 1, 2, 3 e 5 mantêm testes existentes e regressões explícitas.

---

### Task 1: Checkout empresarial avulso dedicado

**Files:**
- Create: `backend/src/stripe/dto/company-one-time-checkout.dto.ts`
- Modify: `backend/src/stripe/stripe.controller.ts:112-198`
- Modify: `backend/src/stripe/stripe.controller.spec.ts`
- Modify: `backend/src/stripe/stripe.service.ts:635-715`
- Modify: `backend/src/stripe/stripe.service.spec.ts:2170-2280`

**Interfaces:**
- Consumes: `CompanyStatus`, `findActiveForDonations`, `resolveOrigin`, sanitização de retorno e Stripe existentes.
- Produces: `POST /stripe/checkout-session/company/one-time` e `createCompanyOneTimeCheckoutSession(input)` com `mode: payment`.

- [x] **Step 1: Escrever testes falhos do controller e service**

Cobrir 401 sem login, responsável incorreto, cada status bloqueado, valor fora da faixa, Tesouro, comunidade ativa/inativa, `mode: payment`, PMC, customer existente/e-mail sem nova persistência, metadata completa e retorno sanitizado. Afirmar ausência de `recurring`, `subscription_data`, `setSubscriptionAmount` e `customer_creation`.

- [x] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/stripe/stripe.controller.spec.ts src/stripe/stripe.service.spec.ts --runInBand`
Expected: FAIL porque rota e método avulso não existem.

- [x] **Step 3: Implementar DTO, rota e service**

Definir `{companyId, amount, communityId, uiMode?, returnPath?}` no DTO. Implementar `createCompanyOneTimeCheckoutSession({companyId, memberId, email?, amountCents, communityId, originUrl, uiMode, returnPath})`, validando empresa `pending|active`, responsável, valor e comunidade antes de criar a sessão com metadata `entityType=business`, `companyId`, `memberId`, `communityId`, `amountCents`, `isSubscription=false`.

- [x] **Step 4: Verificar contratos e regressão da assinatura**

Run: `cd backend && npx jest src/stripe/stripe.controller.spec.ts src/stripe/stripe.service.spec.ts --runInBand`
Expected: novos e existentes PASS.

- [x] **Step 5: Commit**

`git add backend/src/stripe && git commit -m "feat(doacoes): adiciona checkout empresarial unico"`

### Task 2: Webhook, ledger e histórico do responsável

**Files:**
- Modify: `backend/src/stripe/stripe.service.ts:438-496,1501-1591,1612-1636`
- Modify: `backend/src/stripe/stripe.service.spec.ts`

**Interfaces:**
- Consumes: metadata da Task 1 e `recordDonationToLedger` existente.
- Produces: “Doação empresarial única” com empresa e `[memberId]`, idempotente e recuperável em Minhas doações.

- [x] **Step 1: Escrever testes falhos de projeção e classificação**

Verificar que `companyId`, `companyName`, `memberId` e comunidade chegam ao ledger; descrição única contém `Empresa:` e `[memberId]`; assinatura preserva texto anterior; `unpaid` não registra; `async_payment_succeeded` registra uma vez; repetição não duplica; fee continua capturada.

- [x] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/stripe/stripe.service.spec.ts --runInBand`
Expected: FAIL porque metadata empresarial avulsa é descartada e o rótulo é sempre assinatura.

- [x] **Step 3: Implementar projeção empresarial avulsa**

Resolver `companyName`, ampliar `resolveCheckoutDonationMetadata` com `companyId/companyName` e ajustar `recordDonationToLedger` para escolher o rótulo por `isSubscription`. Incluir `[memberId]` somente na descrição única, mantendo PII no padrão PF e o contrato das assinaturas.

- [x] **Step 4: Verificar webhook e consulta**

Run: `cd backend && npx jest src/stripe/stripe.service.spec.ts --runInBand`
Expected: PASS, incluindo consulta de Minhas doações pelo `[memberId]`.

- [x] **Step 5: Commit**

`git add backend/src/stripe && git commit -m "feat(doacoes): registra doacao empresarial unica no ledger"`

### Task 3: Identidade empresarial compartilhada no frontend

**Files:**
- Create: `frontend/src/components/islands/useCompanyIdentity.ts`
- Create: `frontend/src/components/islands/__tests__/useCompanyIdentity.test.tsx`
- Modify: `frontend/src/components/islands/CompanyDonationIsland.tsx`
- Modify: `frontend/src/components/islands/__tests__/CompanyDonationIsland.test.tsx` (criar se ausente)

**Interfaces:**
- Consumes: `useAuth`, `authFetch`, `POST /companies` e `GET /companies/me`.
- Produces: `useCompanyIdentity({enabled, authFetch})` com dados/loading/error, setters e `registerCompany(): Promise<Company>`.

- [x] **Step 1: Escrever testes falhos do hook e da assinatura**

Cobrir empresa existente, ausência, erro, CNPJ/nome obrigatórios, cadastro `pending`, preenchimento dos campos e preservação do checkout mensal. Não executar cadastro quando `enabled=false`.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/useCompanyIdentity.test.tsx src/components/islands/__tests__/CompanyDonationIsland.test.tsx`
Expected: FAIL porque o hook compartilhado não existe.

- [x] **Step 3: Extrair identidade sem mudar comportamento**

Centralizar fetch, dados, `formatCnpj` e registro no hook; adaptar a ilha de assinatura ao novo contrato, mantendo tiers, copy e Stripe atuais. Não alterar o endpoint nem ativação.

- [x] **Step 4: Verificar hook e assinatura**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/useCompanyIdentity.test.tsx src/components/islands/__tests__/CompanyDonationIsland.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

`git add frontend/src/components/islands && git commit -m "refactor(doacoes): compartilha identidade empresarial"`

### Task 4: Escolha PJ e fluxo de doação única

**Files:**
- Create: `frontend/src/components/islands/CompanySupportIsland.tsx`
- Create: `frontend/src/components/islands/CompanyOneTimeDonationIsland.tsx`
- Create: `frontend/src/components/islands/__tests__/CompanySupportIsland.test.tsx`
- Create: `frontend/src/components/islands/__tests__/CompanyOneTimeDonationIsland.test.tsx`
- Create: `frontend/src/lib/donation-targets.ts`
- Modify: `frontend/src/lib/donation-targets.test.ts`
- Modify: `frontend/src/components/islands/DonationFlowIsland.tsx`
- Modify: `frontend/src/pages/participe/apoiar.astro`

**Interfaces:**
- Consumes: `useCompanyIdentity` da Task 3, `DONATION_TARGETS`, StripeCheckoutDialog e endpoint da Task 1.
- Produces: `CompanySupportIsland` com assinatura default e `?modo=empresa&apoio=unica` para o fluxo avulso.

- [x] **Step 1: Escrever testes falhos da escolha e submissão**

Cobrir default assinatura, deep link único, alternância preservando `modo=empresa`, Tesouro/comunidades, valor e CNPJ com erros após interação/submit, ausência de login, cadastro compartilhado, POST correto, abertura do checkout, cancelamento/sucesso e CTA com valor exato.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/CompanySupportIsland.test.tsx src/components/islands/__tests__/CompanyOneTimeDonationIsland.test.tsx src/lib/donation-targets.test.ts`
Expected: FAIL porque wrapper, fluxo e catálogo compartilhado não existem.

- [x] **Step 3: Implementar catálogo, wrapper e fluxo avulso**

Extrair `DonationTarget`, `TESOURO` e `DONATION_TARGETS` sem mudar PF. Criar wrapper com um fluxo visível por vez e sincronização de URL, e a ilha avulsa usando `useCompanyIdentity`, `POST /stripe/checkout-session/company/one-time`, copy “sem patrocínio e sem benefícios”, `<form>` e estados acessíveis.

- [x] **Step 4: Verificar fluxos PF/PJ**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/CompanySupportIsland.test.tsx src/components/islands/__tests__/CompanyOneTimeDonationIsland.test.tsx src/components/islands/DonationFlowIsland.test.tsx src/lib/donation-targets.test.ts src/lib/donation.test.ts`
Expected: PASS sem regressão PF.

- [x] **Step 5: Commit**

`git add frontend/src && git commit -m "feat(doacoes): permite doacao empresarial unica para comunidades"`

### Task 5: Detalhe da transação e recibo empresarial

**Files:**
- Modify: `frontend/src/components/islands/TransactionDetailDialog.tsx:301-360`
- Modify: `frontend/src/components/islands/__tests__/transaction-detail-dialog.test.tsx`
- Modify: `frontend/src/components/islands/DonationReceiptPdf/index.test.tsx`
- Modify: `frontend/src/lib/transaction.test.ts`

**Interfaces:**
- Consumes: descrição “Doação empresarial única” da Task 2 e `generateReceiptPdf` existente.
- Produces: apresentação “Pagamento único” e recibo com rótulo compatível; assinaturas inalteradas.

- [x] **Step 1: Escrever testes falhos de leitura**

Usar transação empresarial única para afirmar `donation-business`, empresa/CNPJ, “Pagamento único” e tipo no PDF; repetir com assinatura para provar texto existente e ausência de regressão.

- [x] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/transaction-detail-dialog.test.tsx src/components/islands/DonationReceiptPdf/index.test.tsx src/lib/transaction.test.ts`
Expected: FAIL pelo texto fixo de assinatura mensal.

- [x] **Step 3: Ajustar somente a apresentação condicional**

Derivar o texto de pagamento único vs recorrência a partir de `isSubscription` e manter geração do PDF no caminho atual; não criar endpoint mensal de recibo.

- [x] **Step 4: Verificar detalhe e recibos**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/transaction-detail-dialog.test.tsx src/components/islands/DonationReceiptPdf/index.test.tsx src/lib/transaction.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

`git add frontend/src && git commit -m "fix(doacoes): distingue pagamento empresarial unico no recibo"`

### Task 6: Jornada isolada, gates, documentação e release

**Files:**
- Create: `backend/test/company-one-time-donation.e2e-spec.ts`
- Modify: `docs/adrs/003-club-business-pj.md`
- Modify: `PRODUCT.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/superpowers/specs/2026-11-23-company-one-time-donations-design.md`
- Modify: `docs/superpowers/plans/2026-11-23-company-one-time-donations.md`
- Modify: `CHANGELOG.md`
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- Consumes: fluxos das Tasks 1–5 e gates padrão.
- Produces: evidência full-stack e release 1.10.0 documentada.

- [x] **Step 1: Exercitar a jornada isolada RED→GREEN**

Em dump PostgreSQL isolado e Stripe totalmente mockado, validar cadastro `pending` → checkout único Tesouro/comunidade → unpaid sem ledger → async success → uma entrada ledger → Minhas doações/transparência → empresa continua `pending` e fora de patrocinadores; assinatura existente não muda. Guardar logs fora do commit.

- [x] **Step 2: Rodar gates das camadas**

Run: `cd backend && npm run build && npx jest --silent`
Run: `cd frontend && npm run check && npm run test`
Expected: todos PASS; corrigir regressões antes de continuar.

- [x] **Step 3: Rodar gates integrados e inspeção visual**

Run: `make astro-verify && make astro-verify-tenants`
Inspecionar assinatura e doação única em 390×844 e 1440×900, claro/escuro, incluindo deep link, erro, cancelamento e sucesso mockado; sem cobrança real.

- [x] **Step 4: Atualizar versão e documentação**

Run: `cd frontend && npm version 1.10.0 --no-git-tag-version && cd ../backend && npm version 1.10.0 --no-git-tag-version`
Atualizar ADR 003, PRODUCT, planos e CHANGELOG com comportamento real, testes executados e rollout backend→frontend. Marcar apenas passos verificados.

- [ ] **Step 5: Revisar, commitar e preparar PR para main**

Run: `git diff --check && git status --short`
Remover artefatos de teste/build e dados temporários. Commitar `feat(doacoes): entrega doacao empresarial unica 1.10.0`, enviar `develop` somente com autorização e abrir PR de `develop` para `main`.
