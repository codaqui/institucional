# Backend — Codaqui

API REST do monorepo Codaqui. Responsável por pagamentos (Stripe), contabilidade (Ledger), autenticação (Keycloak/JWT), armazenamento (MinIO) e gestão de membros, reembolsos e transferências.

> Para setup completo, variáveis de ambiente e deploy, consulte o **[DEVELOPMENT.md](../DEVELOPMENT.md#backend-nestjs)**.
> Para padrões de código e decisões de arquitetura, consulte o **[AGENTS.md](../AGENTS.md)**.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | NestJS (TypeScript) |
| ORM | TypeORM + PostgreSQL 15 |
| Autenticação | Keycloak 22 + JWT (RS256) |
| Pagamentos | Stripe (Checkout Sessions + Webhooks) |
| Armazenamento | MinIO (S3-compatible) |
| Validação | `class-validator` + `class-transformer` |
| Reverse Proxy | Traefik v2.10 |
| Container | Podman Compose |

---

## Comandos

```bash
npm run start:dev       # Watch mode → http://localhost:4000
npm run build           # Compila → dist/  (rode antes de qualquer PR)
npm run test            # Unit tests
npm run test:e2e        # E2E tests
npm run test:cov        # Cobertura de testes
```

### Migrations (TypeORM)

```bash
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

> Em produção (`NODE_ENV=production`) as migrations rodam automaticamente no boot (`migrationsRun: true`).
> Em desenvolvimento o schema é sincronizado via `synchronize: true` — use migrations para validar antes de fazer deploy.

---

## Módulos

| Módulo | Endpoints principais | Descrição |
|--------|---------------------|-----------|
| `AuthModule` | `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` | GitHub OAuth → JWT httpOnly cookie. Guards: `JwtAuthGuard`, `RolesGuard`. |
| `MembersModule` | `GET /members` · `PATCH /members/:id` | Cadastro e perfil de membros. |
| `LedgerModule` | `GET /ledger/community-balances` · `GET /ledger/accounts/:id/transactions` | Contabilidade dupla partida por `projectKey`. Contas criadas automaticamente com proteção contra race condition. |
| `StripeModule` | `POST /stripe/checkout-session` · `POST /stripe/webhook` | Cria sessões de checkout e processa webhooks (com validação de assinatura obrigatória e idempotência por `referenceId`). |
| `ReimbursementsModule` | `POST /reimbursements` · `PATCH /reimbursements/:id/approve` · `PATCH /reimbursements/:id/reject` | Solicitações de reembolso com aprovação atômica (pessimistic lock). |
| `TransfersModule` | `POST /account-transfers` · `PATCH /account-transfers/:id/review` | Transferências entre contas com aprovação atômica (pessimistic lock). |
| `StorageModule` | `POST /storage/upload` · `GET /storage/:key` | Upload e acesso a arquivos via MinIO. |
| `AuditModule` | `GET /audit` | Log de auditoria para operações sensíveis. |

---

## Testando Webhooks do Stripe localmente

```bash
# Instale a CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:4000/stripe/webhook
# A CLI imprime o STRIPE_WEBHOOK_SECRET temporário — cole no .env
```

> A validação de assinatura é **sempre obrigatória** — não há bypass em desenvolvimento.
