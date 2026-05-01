<!-- AGENT-INDEX
purpose: Implementation plan and design spec for Clube Codaqui (SortCoins gamification system).
audience: Backend devs implementing the club/wallet feature, AI agents planning related work.
status: planning document — not all parts are implemented yet.
sections:
  - Resumo (objetivo, escopo)
  - Regras de Negócio
  - Arquitetura Backend (NestJS) — entities, services, endpoints
  - Migração de Banco
  - Frontend
  - Extensibilidade (Wallet System)
  - Checklist de Implementação
related-docs:
  - AGENTS.md §9 Backend Financial Modules — pattern for ledger-backed modules
  - DEVELOPMENT.md — setup
agent-protocol: This is a plan, not an authoritative reference. Verify against actual code in backend/src/ before assuming any feature exists.
-->

# Clube Codaqui — SortCoins

Plano técnico para o sistema de recompensas dos apoiadores mensais da Codaqui.

---

## Resumo

O **Clube Codaqui** recompensa doadores mensais com **SortCoins** (1 BRL = 1 SortCoin).
Apoiadores com assinatura ativa acumulam moedas a cada cobrança e podem usá-las para entrar em sorteios criados pelos admins.

---

## Regras de Negócio

| Regra | Detalhe |
|---|---|
| Taxa de conversão | 1 BRL = 1 SortCoin |
| Crédito | Ocorre a cada `invoice.payment_succeeded` |
| Congelamento | Wallet congelada quando assinatura é cancelada (`customer.subscription.deleted`) |
| Descongelamento | Automático ao reativar assinatura (novo `invoice.payment_succeeded`) |
| Participação em sorteios | Somente donors com assinatura **ativa** no momento de entrada |
| Custo do sorteio | Fixo por sorteio, definido pelo admin (em SortCoins) |
| Dedução | Coins deduzidos no momento da inscrição no sorteio |
| Vencedor | Selecionado aleatoriamente entre as entradas; admin dispara o sorteio manualmente |
| Saldo negativo | Nunca permitido — validar antes de debitar |

---

## Arquitetura Backend (NestJS)

### Módulo: `club`

Localização: `backend/src/club/`

```
backend/src/club/
├── club.module.ts
├── club.controller.ts         # Rotas REST
├── club.service.ts            # Lógica de negócio
├── raffle.service.ts          # Sorteio e seleção de vencedor
├── entities/
│   ├── wallet.entity.ts       # Carteira por membro + walletType
│   ├── wallet-tx.entity.ts    # Histórico de créditos/débitos
│   ├── raffle.entity.ts       # Sorteio criado pelo admin
│   └── raffle-entry.entity.ts # Inscrição de membro em sorteio
└── dto/
    ├── create-raffle.dto.ts
    └── enter-raffle.dto.ts
```

---

### Entidades TypeORM

#### `Wallet` — uma por membro

Uma única linha por membro. Os saldos ficam em colunas JSONB, permitindo adicionar novos tipos
de moeda **sem migration de schema**. Todas as operações de débito/crédito devem usar
**transação DB com `SELECT ... FOR UPDATE`** para evitar race conditions.

```typescript
@Entity('club_wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  memberId: string;              // FK → members.id  (1 wallet por membro)

  /**
   * Saldos por tipo de coin — ex: { "sort_coin": 142, "event_coin": 5 }
   * NUNCA atualizar sem transação + SELECT FOR UPDATE.
   * Usar: UPDATE SET balances = jsonb_set(balances, '{sort_coin}',
   *   (COALESCE(balances->>'sort_coin','0')::int + :amount)::text::jsonb)
   */
  @Column({ type: 'jsonb', default: '{}' })
  balances: Record<string, number>;

  /**
   * Tipos de coin congelados — array PG nativo para queries seguras.
   * Ex: ["sort_coin"]
   */
  @Column({ type: 'simple-array', default: '' })
  frozenTypes: string[];         // ⚠️ usar 'text' array no SQL nativo; simple-array é fallback TypeORM

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> **Atualização segura do saldo (pseudocódigo TypeORM):**
> ```typescript
> await this.walletRepo.manager.transaction(async (em) => {
>   const wallet = await em.findOne(Wallet, { where: { memberId }, lock: { mode: 'pessimistic_write' } });
>   const current = wallet.balances[coinType] ?? 0;
>   if (current + delta < 0) throw new BadRequestException('Saldo insuficiente');
>   wallet.balances = { ...wallet.balances, [coinType]: current + delta };
>   await em.save(wallet);
>   await em.insert(WalletTransaction, { wallet, coinType, amount: delta, source, referenceId });
> });
> ```

---

#### `WalletTransaction`

```typescript
@Entity('club_wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet)
  wallet: Wallet;

  @Column({ default: 'sort_coin' })
  coinType: string;             // qual moeda foi movimentada

  @Column({ type: 'int' })
  amount: number;               // positivo = crédito, negativo = débito

  @Column({
    type: 'enum',
    enum: WalletTxSource,
  })
  source: WalletTxSource;

  @Column({ nullable: true })
  referenceId: string;          // Stripe invoice.id, raffle-entry.id, etc.

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

```typescript
export enum WalletTxSource {
  STRIPE_INVOICE   = 'stripe_invoice',    // crédito mensal
  RAFFLE_ENTRY     = 'raffle_entry',      // débito ao entrar num sorteio
  RAFFLE_REFUND    = 'raffle_refund',     // estorno se sorteio cancelado
  MANUAL_ADMIN     = 'manual_admin',      // ajuste manual
}
```

> **⚠️ Idempotência de webhook obrigatória:**
> Adicionar unique constraint `(source, referenceId, coinType)` na tabela para evitar
> duplo-crédito em retentativas do Stripe. Inserir transação com ON CONFLICT DO NOTHING.



---

#### `Raffle`

```typescript
@Entity('club_raffles')
export class Raffle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ type: 'int' })
  costInCoins: number;        // custo por participante

  @Column({
    type: 'enum',
    enum: RaffleStatus,
    default: RaffleStatus.OPEN,
  })
  status: RaffleStatus;

  @Column({ nullable: true })
  winnerId: string | null;    // memberId do vencedor

  @Column({ nullable: true })
  drawAt: Date | null;        // timestamp do sorteio

  @Column()
  closesAt: Date;             // prazo de inscrição

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Member)
  createdBy: Member;          // admin que criou
}
```

```typescript
export enum RaffleStatus {
  OPEN      = 'open',       // aceitando inscrições
  CLOSED    = 'closed',     // prazo encerrado, aguardando sorteio
  DRAWN     = 'drawn',      // vencedor selecionado
  CANCELED  = 'canceled',   // sorteio cancelado (coins estornados)
}
```

---

#### `RaffleEntry`

```typescript
@Entity('club_raffle_entries')
@Unique(['raffle', 'memberId'])  // um membro = uma entrada por sorteio (sem duplicatas)
export class RaffleEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Raffle)
  raffle: Raffle;

  @Column()
  memberId: string;

  @Column({ type: 'int' })
  coinsSpent: number;

  @CreateDateColumn()
  enteredAt: Date;
}
```

> Se múltiplos ingressos por membro forem necessários no futuro, adicionar campo `tickets: number`
> e remover a constraint única — mas decidir explicitamente antes de implementar.

---

### Fluxo de Crédito (Stripe Webhook)

```
invoice.payment_succeeded
  └─ handleInvoicePaymentSucceeded() [existente em stripe.service.ts]
       └─ NOVO: clubService.creditFromInvoice(memberId, amountBRL, invoiceId)
            ├─ getOrCreateWallet(memberId)              ← 1 wallet por membro
            ├─ descongelar 'sort_coin' se estava frozen
            ├─ DB transaction + SELECT FOR UPDATE: balances['sort_coin'] += Math.floor(amountBRL)
            └─ WalletTransaction com unique check (source=STRIPE_INVOICE, referenceId=invoice.id)

customer.subscription.deleted  |  customer.subscription.updated (status: past_due | unpaid | paused)
  └─ NOVO: clubService.freezeCoinType(memberId, 'sort_coin')
       └─ frozenTypes += 'sort_coin'  (saldo preservado, sem acumular nem gastar)
```

> **Regra de raffle entry:** verificar `!frozenTypes.includes('sort_coin')` no momento da inscrição —
> não confiar apenas no evento de freeze anterior (estado pode ter mudado entre webhooks).

---

### Endpoints REST

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/club/wallet` | Membro | Retorna saldo + frozen + histórico |
| `GET` | `/club/raffles` | Público | Lista sorteios abertos |
| `GET` | `/club/raffles/:id` | Público | Detalhe do sorteio |
| `POST` | `/club/raffles/:id/enter` | Membro ativo | Inscreve no sorteio (debita coins) |
| `POST` | `/club/raffles` | Admin | Cria sorteio |
| `POST` | `/club/raffles/:id/draw` | Admin | Executa sorteio (seleciona vencedor) |
| `POST` | `/club/raffles/:id/cancel` | Admin | Cancela sorteio + estorna coins |

> Autenticação via GitHub OAuth + JWT (mesmo padrão do módulo `auth` existente — `JwtAuthGuard` + `RolesGuard`).

---

### Lógica de Sorteio

```typescript
// raffle.service.ts
async draw(raffleId: string, adminId: string): Promise<Member> {
  const entries = await this.raffleEntryRepo.find({ where: { raffle: { id: raffleId } } });
  if (!entries.length) throw new BadRequestException('Sem participantes');

  // Usar crypto.randomInt para auditabilidade — nunca Math.random()
  const { randomInt } = await import('crypto');
  const winnerEntry = entries[randomInt(entries.length)];
  raffle.status   = RaffleStatus.DRAWN;
  raffle.winnerId = winnerEntry.memberId;
  raffle.drawAt   = new Date();
  await this.raffleRepo.save(raffle);

  return this.membersService.findById(winnerEntry.memberId);
}
```

---

## Migração de Banco

Uma migration TypeORM com as 4 tabelas novas:

```
backend/src/migrations/TIMESTAMP-ClubTables.ts
```

Tabelas criadas:
- `club_wallets`
- `club_wallet_transactions`
- `club_raffles`
- `club_raffle_entries`

---

## Frontend

### Página `/membros/perfil` (existente)

Adicionar seção **"Clube Codaqui"** visível apenas para o próprio membro logado:

```
┌─────────────────────────────────────┐
│  🪙 Clube Codaqui                   │
│  Saldo: 142 SortCoins               │
│  Status: ativo ✅  (ou congelado 🔒) │
│  [Ver histórico] [Ver sorteios]      │
└─────────────────────────────────────┘
```

### Página `/clube` (nova)

Lista os sorteios abertos, com:
- Título, descrição, prêmio
- Custo em SortCoins
- Prazo de inscrição
- Botão **"Participar"** (desabilitado se wallet congelada ou saldo insuficiente)

### Painel Admin (futuro)

- Criar sorteio
- Ver participantes
- Executar sorteio
- Cancelar sorteio

---

## Extensibilidade (Wallet System)

O design de **1 wallet por membro** com JSONB é naturalmente extensível:

- Adicionar `event_coin`: nenhuma migration de schema necessária — basta começar a escrever `balances['event_coin']` e criar transações com `coinType: 'event_coin'`
- Congelar apenas uma moeda (ex: `sort_coin` congelado por assinatura cancelada, `event_coin` ativo) é controlado pelo array `frozenTypes`
- O frontend recebe um objeto único com todos os saldos: `{ sort_coin: 142, event_coin: 5 }`

| coinType | Fonte | Uso previsto |
|---|---|---|
| `sort_coin` | Doação mensal (Stripe) | Sorteios do Clube |
| `event_coin` | Presença em eventos | Benefícios de eventos (futuro) |
| _(outros)_ | A definir | Conquistas, badges, etc. |

---

## Checklist de Implementação

- [ ] Criar módulo `club` com entidades e migration
- [ ] Injetar `clubService.creditFromInvoice()` em `stripe.service.ts` (`invoice.payment_succeeded`)
- [ ] Injetar `clubService.freezeWallet()` em `stripe.service.ts` (`customer.subscription.deleted`)
- [ ] Endpoints REST com guards Keycloak
- [ ] Testes unitários: `club.service.spec.ts`, `raffle.service.spec.ts`
- [ ] Seção "Clube" em `/membros/perfil`
- [ ] Página `/clube` com listagem de sorteios
- [ ] Migration testada em ambiente local (compose.yaml)
