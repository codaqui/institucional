<!-- AGENT-INDEX
purpose: Backend (NestJS) module overview — what each module does and key endpoints.
audience: Backend devs, AI agents working on backend/.
sections:
  - Módulos (auth, members, ledger, stripe, expenses, transfers, reimbursements, vendors, audit, storage)
  - Endpoints principais
related-docs:
  - ../AGENTS.md §9 Backend Financial Modules — ledger conventions, referenceId, persistWithLedger pattern
  - ../DEVELOPMENT.md#backend-nestjs — setup, env vars, Stripe CLI
agent-protocol: For setup go to DEVELOPMENT.md. For architecture patterns (referenceId, persistWithLedger) go to AGENTS.md §9.
-->

# Backend — Codaqui

API REST do monorepo Codaqui (NestJS + TypeORM + PostgreSQL). Núcleo financeiro baseado em **ledger de dupla partida** (`Account` + `Transaction`); todos os módulos especializados (Stripe, despesas, transferências, reembolsos, fornecedores) gravam suas próprias entidades e registram a transação correspondente no ledger via `LedgerService.recordTransaction(...)`, identificada por um `referenceId` com prefixo único.

> Setup, env vars e Stripe CLI: **[../DEVELOPMENT.md#backend-nestjs](../DEVELOPMENT.md#backend-nestjs)**.
> Padrões de código, convenção de `referenceId` e `persistWithLedger`: **[../AGENTS.md §9 Backend Financial Modules](../AGENTS.md)**.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Linguagem | TypeScript 5.7 |
| ORM | TypeORM 0.3.28 + `@nestjs/typeorm` 11 |
| Banco | PostgreSQL 18 (`postgres:18-alpine`) |
| Autenticação | GitHub OAuth + JWT (`passport-github2` + `passport-jwt`, `@nestjs/passport`, `@nestjs/jwt`), httpOnly cookie |
| Validação | `class-validator` 0.14 + `class-transformer` (ValidationPipe global, whitelist + transform) |
| Rate Limiting | `@nestjs/throttler` 6.5 |
| API Docs | `@nestjs/swagger` 11.2 |
| Pagamentos | Stripe SDK 21 (Checkout Sessions + Webhooks com validação obrigatória de assinatura) |
| Storage | ⚠ Sem upload pelo backend — comprovantes são **links externos** (allowlist HTTPS: Google Drive/Docs, Dropbox, OneDrive, Imgur). Sem S3/MinIO/disco local. |
| Reverse Proxy | Traefik (infra externa do servidor ARM64) |
| Container | Podman Compose |
| Imagem prod | `ghcr.io/codaqui/institucional-backend:latest-arm64-v8` |

---

## Comandos

```bash
npm run start:dev       # Watch mode → http://localhost:4000
npm run build           # Compila → dist/  (rode antes de qualquer PR)
npm run test            # Unit tests (Jest, 18 suites · 205 tests)
npm run test:e2e        # E2E tests
npm run test:cov        # Cobertura de testes
```

### Migrations (TypeORM)

```bash
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

> `synchronize: false` em todos os ambientes — schema só muda via migration. Em produção (`NODE_ENV=production`) as migrations rodam automaticamente no boot (`migrationsRun: true`).
>
> Migrations atuais (`backend/src/migrations/`):
> - `Migration001_20260402` — schema inicial (members, accounts, transactions, etc.)
> - `Migration002_20260406` — ajustes pós-001
> - `Migration003_Vendors` — vendors + vendor_payments + transaction_templates
> - `Migration004_RefundAnonymousDonation` — fluxo de refund Stripe
> - `Migration005_VendorReceipts` — rename `paidAt → occurredAt` / `paidByUserId → registeredByUserId`, add `direction` em templates, cria `vendor_receipts`

---

## Módulos

| Módulo | Responsabilidade | Endpoints principais |
|--------|------------------|---------------------|
| `AuthModule` | GitHub OAuth → JWT em cookie httpOnly. Guards: `JwtAuthGuard`, `RolesGuard`. | `GET /auth/github` · `GET /auth/github/callback` · `GET /auth/me` · `GET /auth/logout` |
| `MembersModule` | Cadastro, perfil, papéis (admin/member/donor). | `GET /members` · `GET /members/donors` · `GET /members/me` · `GET /members/by-handle/:handle` · `GET /admin/members` · `PATCH /admin/members/:id` |
| `LedgerModule` | ⭐ Núcleo financeiro: contas + transações double-entry. Cria contas com proteção contra race condition (advisory lock). | `POST /ledger/accounts` · `POST /ledger/transactions` · `GET /ledger/community-balances` · `GET /ledger/transparency-stats` · `GET /ledger/accounts/:id/balance` · `GET /ledger/accounts/:id/transactions` |
| `StripeModule` | Doações via Checkout (one-shot + subscription) + webhooks. Refund anônimo. Idempotência por `referenceId`. | `POST /stripe/checkout-session` · `POST /stripe/webhook` · `GET /stripe/my-donations` · `GET /stripe/my-subscriptions` · `DELETE /stripe/subscriptions/:id` |
| `ExpensesModule` | Despesas com fluxo request → approve → pay (3 estados). | `POST /expenses` · `GET /expenses` · `GET /expenses/:id` · `POST /expenses/:id/approve` · `POST /expenses/:id/pay` |
| `TransfersModule` | Transferências entre contas internas com aprovação atômica (pessimistic lock). | `POST /account-transfers` · `GET /account-transfers` · `PATCH /account-transfers/:id/approve` · `PATCH /account-transfers/:id/reject` |
| `ReimbursementsModule` | Reembolsos a membros (request → approve+pay atômico → optional revert). | `POST /reimbursements` · `GET /reimbursements/public/:id` · `GET /reimbursements/my` · `GET /reimbursements` · `PATCH /reimbursements/:id/approve` · `PATCH /reimbursements/:id/reject` · `PATCH /reimbursements/:id/revert` · `DELETE /reimbursements/:id` |
| `VendorsModule` | ⭐ Fornecedores **bidirecional**: pagamentos a fornecedor + recebimentos de fornecedor (ex: Sympla repassando ingressos). Templates parametrizados por `direction`. | `GET /vendors` · `GET /vendors/with-counters` · `POST /vendors` · `PATCH /vendors/:id` · `DELETE /vendors/:id` · **payments:** `GET /vendors/payments` · `POST /vendors/payments` · `GET /vendors/payments/by-reference/:refId` · `DELETE /vendors/payments/:id` · **receipts:** `GET /vendors/receipts` · `POST /vendors/receipts` · `GET /vendors/receipts/by-reference/:refId` · `DELETE /vendors/receipts/:id` · **templates:** CRUD em `/vendors/templates` |
| `AuditModule` | Log de auditoria de ações sensíveis (mutações financeiras). Apenas leitura/cleanup admin. | `GET /audit/logs` · `POST /audit/cleanup` |
| `StorageModule` | Valida URLs de comprovante (apenas links externos — não há upload pelo backend). Aceita HTTPS de uma allowlist: Google Drive/Docs, Dropbox, OneDrive (`1drv.ms`), Imgur. Rejeita não-HTTPS e domínios fora da allowlist. O time sobe os arquivos manualmente nos serviços confiáveis. | `POST /storage/validate-receipt-url` |

---

## Convenção de `referenceId` (ledger)

Cada movimento no `transactions` tem um `referenceId` com prefixo identificador da origem — o frontend usa esse prefixo (em `src/utils/transaction.tsx`) para classificar a transação e enriquecer a UI. Detalhes completos em **[../AGENTS.md §9](../AGENTS.md)**:

| Origem | Prefixo |
|--------|---------|
| Stripe donation | `stripe-pi:<paymentIntentId>` |
| Reimbursement | `reimbursement:<id>` |
| Transfer | `transfer:<id>` |
| Vendor payment | `vendor-payment:<id>` |
| Vendor receipt | `vendor-receipt:<id>` |
| Expense | `expense:<id>` |
| Reversals (delete) | `<prefix>-reversal:<id>:<ts>` |

> ⚠️ Sempre construa o `referenceId` **APÓS** o `repo.save()` (UUID só existe depois do insert). No `VendorsService` use `persistWithLedger(repo, entity, (saved) => ({ referenceId: \`prefix:${saved.id}\` }))` — factory function, não objeto literal.

---

## Testando Webhooks do Stripe localmente

```bash
# Instale a CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:4000/stripe/webhook
# A CLI imprime o STRIPE_WEBHOOK_SECRET temporário — cole no .env
```

> A validação de assinatura é **sempre obrigatória** — não há bypass em desenvolvimento.
