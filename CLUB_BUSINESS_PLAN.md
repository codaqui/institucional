<!-- AGENT-INDEX
purpose: Implementation plan and design spec for Clube Codaqui Business (apoio via Pessoa Jurídica).
audience: Backend devs implementing the club-business feature, AI agents planning related work.
status: planning document — nada implementado ainda.
sections:
  - Resumo (objetivo, escopo, diferenças do CLUB individual)
  - Regras de Negócio
  - Arquitetura Backend (NestJS) — entities, services, endpoints
  - Integração Stripe
  - Integração com Clube Individual (SortCoins)
  - Migração de Banco
  - Frontend
  - Comprovante de Doação (PDF)
  - Benefícios e Visibilidade
  - Extensibilidade
  - Checklist de Implementação
related-docs:
  - CLUB_PLAN.md — design do Clube individual (SortCoins, Wallet, Raffle)
  - AGENTS.md §9 Backend Financial Modules — padrão ledger-backed
  - DEVELOPMENT.md — setup, migrations, deploy
agent-protocol: >
  This is a plan, not authoritative code. The companies module does NOT exist yet.
  Verify backend/src/ before assuming any entity exists.
  CNPJ is mandatory for PJ support. Company wallet is separate from representative's wallet.
-->

# Clube Codaqui Business — Apoio via Pessoa Jurídica

Plano técnico para o sistema de apoio empresarial recorrente da Codaqui, com carteira própria de SortCoins, benefícios de visibilidade e comprovante de doação.

---

## Resumo

O **Clube Codaqui Business** permite que empresas (Pessoas Jurídicas) apoiem a Codaqui de forma recorrente, acumulando **SortCoins em carteira própria** e obtendo benefícios de visibilidade e acesso a eventos. O acesso é vinculado a um **responsável pessoa física** (GitHub OAuth), que representa a empresa no sistema.

### Diferenças em relação ao CLUB individual

| Dimensão | CLUB (PF) | CLUB_BUSINESS (PJ) |
|---|---|---|
| **Identificação** | GitHub pessoal | CNPJ obrigatório + responsável PF |
| **Valor mínimo** | R$ 10/mês | **R$ 200/mês** |
| **Recorrência** | Opcional | **Obrigatória** |
| **Carteira** | `club_wallets` (1 por membro) | `company_wallets` (1 por empresa) |
| **SortCoins** | Na carteira do membro | Na carteira da **empresa** |
| **Benefícios extras** | — | Logo no site, badge no responsável, entradas em eventos, descontos |
| **Comprovante** | Comprovante Stripe | Comprovante assinado com dados PJ (PDF sob demanda) |

---

## Regras de Negócio

| Regra | Detalhe |
|---|---|
| CNPJ | **Obrigatório** e único por empresa — sem CNPJ não há cadastro PJ |
| Responsável | Um membro ativo (GitHub) vincula-se como `responsibleMember` — pode ser alterado por admin |
| Valor mínimo | R$ 200/mês (20.000 centavos) — rejeitado abaixo disso no backend |
| Recorrência | Sempre `interval: 'month'` — sem opção de pagamento único |
| Taxa de conversão | 1 BRL = 1 SortCoin (mesmo padrão do CLUB individual) |
| Crédito de coins | A cada `invoice.payment_succeeded` com `metadata.entityType: 'business'` |
| Congelamento | Carteira congelada em `customer.subscription.deleted` ou status `past_due` por >3 dias |
| Descongelamento | Automático em novo `invoice.payment_succeeded` |
| Nota Fiscal | **Não emitida** — ONG é isenta. Apenas comprovante assinado sob demanda |
| Benefícios ativos | Visível no site e nos sorteios somente enquanto `status: 'active'` |
| Saldo negativo | Nunca permitido — validar antes de qualquer débito |
| Sorteios | Empresa pode usar SortCoins em sorteios (mesmo pool `sort_coin` do CLUB) |

---

## Arquitetura Backend (NestJS)

### Módulo: `companies`

Localização: `backend/src/companies/`

```
backend/src/companies/
├── companies.module.ts
├── companies.controller.ts       # Rotas REST
├── companies.service.ts          # Lógica de negócio + integração ledger
├── entities/
│   ├── company.entity.ts         # Dados cadastrais da empresa
│   ├── company-wallet.entity.ts  # Carteira de SortCoins da empresa
│   └── company-wallet-tx.entity.ts # Histórico de créditos/débitos
└── dto/
    ├── create-company.dto.ts     # CNPJ, razão social, logo, site
    └── update-company.dto.ts     # Patch parcial
```

> **Sem módulo separado de subscription** — o Stripe Subscription fica referenciado
> diretamente na entidade `Company` (`stripeSubscriptionId`, `stripeCustomerId`), evitando
> uma entidade extra para um relacionamento 1:1.

---

### Entidades TypeORM

#### `Company`

```typescript
export enum CompanyStatus {
  PENDING  = 'pending',   // cadastrada, aguardando 1ª cobrança
  ACTIVE   = 'active',    // assinatura ativa e em dia
  PAST_DUE = 'past_due',  // cobrança falhou (< 3 dias → ainda exibe benefícios)
  SUSPENDED = 'suspended',// past_due > 3 dias → benefícios suspensos
  CANCELLED = 'cancelled',// assinatura cancelada
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** CNPJ somente números, ex: "44593429000105" — validado pelo backend */
  @Column({ unique: true, length: 14 })
  cnpj: string;

  @Column()
  name: string;                   // Razão social ou nome fantasia

  @Column({ nullable: true, type: 'varchar' })
  logoUrl: string | null;         // URL absoluta ou /static/img/...

  @Column({ nullable: true, type: 'varchar' })
  websiteUrl: string | null;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.PENDING,
  })
  status: CompanyStatus;

  /** FK → members.id — quem representa a empresa */
  @Column({ unique: true })
  responsibleMemberId: string;

  /** Stripe Customer ID — criado no primeiro checkout */
  @Column({ nullable: true, unique: true })
  stripeCustomerId: string | null;

  /** Stripe Subscription ID — null até 1ª cobrança */
  @Column({ nullable: true, unique: true })
  stripeSubscriptionId: string | null;

  /** Valor da assinatura em centavos (≥ 20.000 = R$ 200) */
  @Column({ type: 'int', default: 20000 })
  subscriptionAmountCents: number;

  /**
   * Indica se o logo deve aparecer na página /patrocinadores.
   * Controlado pelo admin — false por padrão até aprovação manual.
   */
  @Column({ default: false })
  showOnSponsorsPage: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> **Validação de CNPJ**: usar biblioteca `cpf-cnpj-validator` (já padrão no ecossistema NestJS BR).
> Apenas dígitos aceitos — remover máscaras antes de persistir.
> Calcular dígitos verificadores no DTO/service antes de salvar.

---

#### `CompanyWallet`

Espelha o design de `club_wallets` (CLUB individual). Uma linha por empresa, saldos em JSONB.
Todas as operações de crédito/débito devem usar **transação DB com `SELECT ... FOR UPDATE`**.

```typescript
@Entity('company_wallets')
export class CompanyWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  companyId: string;              // FK → companies.id

  /**
   * Saldos por tipo de coin — ex: { "sort_coin": 1240 }
   * Atualizar apenas dentro de transaction + SELECT FOR UPDATE.
   */
  @Column({ type: 'jsonb', default: '{}' })
  balances: Record<string, number>;

  /**
   * Coins congelados — array nativo Postgres (text[]).
   * Congelado quando assinatura cancela ou fica past_due > 3 dias.
   */
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  frozenTypes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

#### `CompanyWalletTransaction`

```typescript
export enum CompanyWalletTxSource {
  STRIPE_INVOICE = 'stripe_invoice',  // crédito mensal automático
  MANUAL_ADMIN   = 'manual_admin',    // ajuste manual pelo admin
  RAFFLE_ENTRY   = 'raffle_entry',    // débito ao entrar num sorteio
  RAFFLE_REFUND  = 'raffle_refund',   // estorno se sorteio cancelado
}

@Entity('company_wallet_transactions')
@Unique(['source', 'referenceId', 'coinType'])  // ⚠️ Idempotência obrigatória
export class CompanyWalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompanyWallet)
  wallet: CompanyWallet;

  @Column({ default: 'sort_coin' })
  coinType: string;

  @Column({ type: 'int' })
  amount: number;               // positivo = crédito, negativo = débito

  @Column({ type: 'enum', enum: CompanyWalletTxSource })
  source: CompanyWalletTxSource;

  @Column({ nullable: true })
  referenceId: string;          // invoice.id, raffle-entry.id, etc.

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

### Endpoints REST

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/companies` | Membro logado | Cria cadastro PJ (vincula CNPJ ao responsável) |
| `GET` | `/companies/me` | Membro logado | Retorna empresa do responsável logado |
| `GET` | `/companies` | Admin | Lista todas as empresas |
| `GET` | `/companies/sponsors` | Público | Lista empresas com `showOnSponsorsPage: true` e `status: active` |
| `PATCH` | `/companies/:id` | Admin | Atualiza dados / aprova logo / ativa `showOnSponsorsPage` |
| `GET` | `/companies/:id/wallet` | Responsável ou Admin | Saldo + histórico de SortCoins |
| `GET` | `/companies/:id/receipt` | Responsável ou Admin | Gera comprovante de doação (dados para PDF) |
| `POST` | `/stripe/checkout-session` | Responsável (JWT) | Checkout PJ — detectado por `entityType: 'business'` no body |

---

### Lógica de negócio — `companies.service.ts`

#### `createCompany(dto, memberId)`

```typescript
async createCompany(dto: CreateCompanyDto, memberId: string): Promise<Company> {
  // 1. Validar CNPJ (dígitos verificadores)
  if (!isValidCnpj(dto.cnpj)) throw new BadRequestException('CNPJ inválido');

  // 2. Verificar se CNPJ já existe
  const existing = await this.repo.findOne({ where: { cnpj: dto.cnpj } });
  if (existing) throw new ConflictException('CNPJ já cadastrado');

  // 3. Verificar se membro já é responsável por outra empresa
  const byMember = await this.repo.findOne({ where: { responsibleMemberId: memberId } });
  if (byMember) throw new ConflictException('Membro já é responsável por uma empresa');

  // 4. Persistir (status: PENDING — aguarda 1ª cobrança Stripe)
  return this.repo.save({ ...dto, responsibleMemberId: memberId });
}
```

#### `creditFromInvoice(companyId, amountBRL, invoiceId)`

```typescript
async creditFromInvoice(companyId: string, amountBRL: number, invoiceId: string): Promise<void> {
  await this.dataSource.transaction(async (em) => {
    const wallet = await em.findOne(CompanyWallet, {
      where: { companyId },
      lock: { mode: 'pessimistic_write' },
    }) ?? await em.save(CompanyWallet, { companyId, balances: {}, frozenTypes: [] });

    // Descongela se estava frozen
    wallet.frozenTypes = wallet.frozenTypes.filter(t => t !== 'sort_coin');

    const delta = Math.floor(amountBRL);  // 1 BRL = 1 SortCoin, sem fração
    wallet.balances = {
      ...wallet.balances,
      sort_coin: (wallet.balances['sort_coin'] ?? 0) + delta,
    };
    await em.save(wallet);

    // Idempotente: ON CONFLICT (source, referenceId, coinType) DO NOTHING
    await em.createQueryBuilder()
      .insert().into(CompanyWalletTransaction)
      .values({
        wallet,
        coinType: 'sort_coin',
        amount: delta,
        source: CompanyWalletTxSource.STRIPE_INVOICE,
        referenceId: invoiceId,
        description: `Crédito mensal — fatura ${invoiceId}`,
      })
      .orIgnore()
      .execute();
  });

  // Atualiza status da empresa para ACTIVE
  await this.repo.update({ id: companyId }, { status: CompanyStatus.ACTIVE });
}
```

#### `freezeWallet(companyId)`

```typescript
async freezeWallet(companyId: string): Promise<void> {
  await this.dataSource.transaction(async (em) => {
    const wallet = await em.findOne(CompanyWallet, {
      where: { companyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) return;
    if (!wallet.frozenTypes.includes('sort_coin')) {
      wallet.frozenTypes = [...wallet.frozenTypes, 'sort_coin'];
      await em.save(wallet);
    }
  });
  await this.repo.update({ id: companyId }, { status: CompanyStatus.CANCELLED });
}
```

---

## Integração Stripe

### Checkout PJ

Adicionar ao body de `POST /stripe/checkout-session`:

```typescript
{
  amount: number;           // centavos ≥ 20000
  communityId: string;
  entityType: 'business';   // novo campo — identifica fluxo PJ
  companyId: string;        // UUID da empresa (já cadastrada)
  recurring: { interval: 'month' };  // sempre obrigatório para PJ
}
```

O `stripe.service.ts` detecta `entityType === 'business'` e:

1. Busca ou cria `Stripe Customer` com `metadata.companyId`
2. Persiste `stripeCustomerId` na entidade `Company`
3. Cria `Price` (ou usa price dinâmico) com `metadata.companyId` e `metadata.entityType: 'business'`
4. Retorna `clientSecret` (modo embedded) ou `url` (modo hosted)

### Webhook — novos handlers

Modificar `stripe.service.ts` para despachar baseado em `metadata.entityType`:

```
invoice.payment_succeeded
  ├─ metadata.entityType === 'business'
  │    └─ companiesService.creditFromInvoice(metadata.companyId, amountBRL, invoice.id)
  └─ (individual — fluxo existente)

customer.subscription.deleted  |  status: past_due (>72h)
  ├─ metadata.entityType === 'business'
  │    └─ companiesService.freezeWallet(metadata.companyId)
  └─ (individual — fluxo existente)
```

### `referenceId` no Ledger

Manter consistência com a convenção existente (ver AGENTS.md §9):

| Origem | referenceId |
|---|---|
| Assinatura PJ (pagamento) | `stripe-pi:<paymentIntentId>` |
| Cancelamento/estorno PJ | `stripe-refund:<paymentIntentId>:<refundId>` |

O ledger financeiro **não muda** — o crédito no ledger continua sendo `stripe_income → community`
independentemente de ser PF ou PJ. A wallet de SortCoins é **separada** do ledger.

---

## Integração com Clube Individual (SortCoins)

As carteiras PJ usam o **mesmo pool de sorteios** (`club_raffles`) do CLUB individual.

Para isso, o `raffle.service.ts` (CLUB_PLAN.md) precisa de uma abstração que aceite
tanto `memberId` (wallet PF) quanto `companyId` (wallet PJ):

```typescript
// Abordagem recomendada: passar walletType + ownerId
interface RaffleEntryRequest {
  walletType: 'member' | 'company';
  ownerId: string;            // memberId ou companyId
  raffleId: string;
}
```

O serviço resolve a wallet correta antes de debitar coins.

> **Considerar no futuro**: uma view unificada de "participantes de sorteio" que mostra
> tanto membros PF quanto representantes PJ.

---

## Migração de Banco

Uma migration TypeORM com as 3 novas tabelas:

```
backend/src/migrations/TIMESTAMP-CompanyTables.ts
```

Tabelas criadas:

```sql
-- companies
CREATE TABLE companies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                    VARCHAR(14) UNIQUE NOT NULL,
  name                    VARCHAR NOT NULL,
  logo_url                VARCHAR,
  website_url             VARCHAR,
  status                  company_status_enum DEFAULT 'pending',
  responsible_member_id   UUID NOT NULL UNIQUE,
  stripe_customer_id      VARCHAR UNIQUE,
  stripe_subscription_id  VARCHAR UNIQUE,
  subscription_amount_cents INT DEFAULT 20000,
  show_on_sponsors_page   BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- company_wallets
CREATE TABLE company_wallets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID UNIQUE NOT NULL REFERENCES companies(id),
  balances     JSONB DEFAULT '{}',
  frozen_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- company_wallet_transactions
CREATE TABLE company_wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES company_wallets(id),
  coin_type     VARCHAR DEFAULT 'sort_coin',
  amount        INT NOT NULL,
  source        company_wallet_tx_source_enum NOT NULL,
  reference_id  VARCHAR,
  description   VARCHAR,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, reference_id, coin_type)  -- idempotência webhook
);
```

---

## Frontend

### 1. Página `/participe/apoiar` (existente — adicionar tab/seção PJ)

Adicionar uma seção "Apoio Empresarial" após o formulário individual:

```
┌─────────────────────────────────────────────────────────┐
│  🏢 Apoio Empresarial                                   │
│  Sua empresa pode apoiar a Codaqui mensalmente          │
│  com a partir de R$ 200/mês.                            │
│                                                         │
│  Benefícios:                                            │
│  ✅  Logo da empresa na página de patrocinadores        │
│  ✅  Badge "Apoiador Empresarial" no seu perfil         │
│  ✅  Entradas em eventos privados de capacitação        │
│  ✅  Descontos em eventos das comunidades parceiras     │
│  🪙  SortCoins na carteira da empresa                   │
│                                                         │
│  [Quero apoiar como empresa →]                          │
└─────────────────────────────────────────────────────────┘
```

### 2. Fluxo de cadastro PJ (novo — `/participe/apoiar?tipo=empresa`)

```
Passo 1 → CNPJ + Razão Social + Logo URL + Site
Passo 2 → Escolha o valor mensal (≥ R$ 200, presets: 200, 500, 1000)
Passo 3 → Stripe Checkout (recorrente obrigatório)
```

> O cadastro da empresa é criado no backend **antes** de iniciar o checkout.
> O `companyId` resultante vai como `metadata.companyId` no Stripe.

### 3. Página `/patrocinadores` (nova)

Lista pública das empresas apoiadoras com `showOnSponsorsPage: true`:

```
┌────────────────────────────────────────────────────────┐
│  🏆 Patrocinadores                                     │
│  Empresas que apoiam a Codaqui e suas comunidades      │
│                                                        │
│  [Logo]  Empresa A        [Logo]  Empresa B            │
│  exemplo.com.br           empresa-b.com.br             │
│                                                        │
│  [Logo]  Empresa C                                     │
│  empresa-c.com.br                                      │
└────────────────────────────────────────────────────────┘
```

Endpoint: `GET /companies/sponsors` → array de `{ name, logoUrl, websiteUrl }`.

### 4. Badge no perfil do responsável

Em `/membros/perfil` (futuro), exibir chip quando `GET /companies/me` retornar empresa ativa:

```
[🏢 Representa: Empresa X  ·  500 SortCoins]
```

### 5. Painel Admin (futuro)

- Listar empresas (todas, por status)
- Aprovar `showOnSponsorsPage`
- Trocar responsável
- Ajuste manual de wallet
- Download comprovante assinado

---

## Comprovante de Doação

A ONG é isenta de emitir Nota Fiscal. O sistema deve gerar um **comprovante de doação assinado**
com os dados da empresa, utilizável para fins contábeis do doador.

### Endpoint

```
GET /companies/:id/receipt?month=YYYY-MM
```

Resposta (JSON para renderização no frontend como PDF ou página de impressão):

```typescript
interface DonationReceiptDto {
  generatedAt: string;          // ISO timestamp
  company: {
    cnpj: string;               // formatado: XX.XXX.XXX/XXXX-XX
    name: string;
    responsibleName: string;    // nome do membro responsável
  };
  beneficiary: {
    name: 'Associação Codaqui';
    cnpj: '44.593.429/0001-05';
    address: string;
  };
  donation: {
    month: string;              // "Maio/2026"
    amountBRL: number;          // ex: 500.00
    stripeInvoiceId: string;
    paidAt: string;             // ISO date
  };
  signatureStatement: string;   // texto legal padrão de comprovante de doação
}
```

> **Implementação MVP**: retornar JSON e o frontend renderiza uma página de impressão (`window.print()`).
> Implementação de PDF server-side pode ser adicionada futuramente com `pdfkit` ou `puppeteer`.

---

## Extensibilidade

- **Múltiplos responsáveis por empresa**: atualmente 1:1. Para suportar N responsáveis,
  substituir `responsibleMemberId` (unique) por tabela `company_members` com roles. Não implementar agora.
- **Tiers de patrocínio** (Ouro/Prata/Bronze): adicionar `tier: 'gold' | 'silver' | 'bronze'`
  baseado em `subscriptionAmountCents`. Derivado — não precisa de migration, só lógica de negócio.
- **event_coin para empresas**: o JSONB de `company_wallets.balances` já suporta `event_coin` sem migration.
- **Domínio de comunidade whitelabel**: `POST /stripe/checkout-session` já suporta `returnPath` —
  empresas de comunidades específicas retornam para o domínio whitelabel correto.

---

## Checklist de Implementação

### Backend
- [ ] Dependência `cpf-cnpj-validator` instalada em `backend/`
- [ ] Entidade `Company` + migration `CompanyTables`
- [ ] Entidade `CompanyWallet` + `CompanyWalletTransaction` (incluída na mesma migration)
- [ ] `companies.service.ts`: `createCompany`, `creditFromInvoice`, `freezeWallet`, `getReceipt`
- [ ] `companies.controller.ts`: endpoints REST (tabela acima)
- [ ] `stripe.service.ts`: detectar `entityType: 'business'` no checkout
- [ ] `stripe.service.ts`: despachar para `companiesService` nos webhooks
- [ ] `stripe.controller.ts`: validar `amount >= 20000` e `recurring.interval === 'month'` para PJ
- [ ] `raffle.service.ts` (CLUB): abstrair `walletType + ownerId` para aceitar wallet PJ
- [ ] Testes unitários: `companies.service.spec.ts`
- [ ] Migration testada: `make migration-run`
- [ ] Build backend: `cd backend && npm run build`

### Frontend
- [ ] Seção "Apoio Empresarial" em `src/pages/participe/apoiar.tsx`
- [ ] Fluxo de cadastro PJ (formulário + checkout Stripe)
- [ ] Página `src/pages/patrocinadores.tsx` (grid de logos)
- [ ] Badge "Representa empresa" no perfil do responsável
- [ ] Página de comprovante de doação (impressão via `window.print()`)
- [ ] Exportar novos componentes em `src/components/index.ts`
- [ ] `npm run typecheck` sem erros
- [ ] `npm run build` sem erros

### Dados
- [ ] Rota `/patrocinadores` adicionada ao navbar (ou rodapé) após primeiros patrocinadores

### Admin
- [ ] Endpoint `PATCH /companies/:id` com guard `RolesGuard(MemberRole.ADMIN)`
- [ ] UI admin para aprovar `showOnSponsorsPage` (pode ser via painel existente em `/admin`)
