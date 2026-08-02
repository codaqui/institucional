<!-- AGENT-INDEX
purpose: ADR do Clube Codaqui Business (apoio empresarial via PJ). Registra a decisão de permitir doações recorrentes de pessoas jurídicas com carteira própria de SortCoins.
audience: AI agents, mantenedores
status: implementado
sections:
  - Contexto
  - Decisão
  - Regras de negócio
  - Arquitetura backend
  - Consequências
  - Links relacionados
related-docs:
  - ./002-club-sortcoins.md — Clube individual
  - ../modules/events/ROLES.md — papéis do sistema
-->

# ADR 003 — Clube Codaqui Business (Apoio via PJ)

- **Data da decisão:** 2026-05
- **Status:** Implementado
- **Escopo:** backend/src/companies/, páginas /empresas e /membros/perfil

## Contexto

Além de doadores individuais, a Codaqui queria captar apoio corporativo recorrente. O modelo deveria ser distinto do Clube individual: exigir CNPJ, valor mínimo maior, recorrência obrigatória e benefícios de visibilidade para a empresa.

## Decisão

Criar o módulo `companies` no backend para cadastro e gestão de empresas apoiadoras:

1. **Cadastro vinculado a um responsável PF** (GitHub OAuth) e **CNPJ obrigatório**.
2. **Assinatura recorrente mínima de R$ 200/mês** via Stripe.
3. **Carteira própria da empresa** (`company_wallets`), separada da wallet individual.
4. **Ativação manual por admin** após conferência dos dados; status não muda automaticamente no primeiro pagamento.
5. **Congelamento automático** após >3 dias em `past_due` via cron diário.
6. **Comprovante de doação assinado** sob demanda, com dados PJ.

## Regras de negócio

| Regra | Detalhe |
|-------|---------|
| CNPJ | Obrigatório e único |
| Responsável | Membro PF vinculado; alterável por admin |
| Valor mínimo | R$ 200/mês |
| Recorrência | Obrigatória (`interval: 'month'`) |
| Conversão | 1 BRL = 1 SortCoin |
| Ativação | Manual por admin |
| Nota fiscal | Não emitida; apenas comprovante |
| Benefícios | Visíveis somente com `status: 'active'` |

## Arquitetura backend

- **Módulo:** `backend/src/companies/`
- **Entidades:** `Company`, `CompanyWallet`, `CompanyWalletTransaction`, `CompanySubscriptionTracking`, `CompanyMember`
- **Tabelas:** `companies`, `company_wallets`, `company_wallet_transactions`, `company_subscription_tracking`, `company_members`
- **Stripe:** `stripeCustomerId` e `stripeSubscriptionId` diretamente na entidade `Company` (sem tabela extra).
- **Endpoints:** `/companies`, `/companies/:id`, `/companies/:id/receipt`, `/companies/me`, etc.

## Consequências

- **Positivas:** fonte de receita corporativa; visibilidade para patrocinadores; wallet separada evita confusão com saldo pessoal.
- **Negativas:** onboarding mais burocrático (CNPJ, ativação manual); necessidade de tracking de status de assinatura e cron de congelamento.

## Links relacionados

- Código: `backend/src/companies/`
- Frontend: `src/pages/empresas/`, `src/pages/membros/perfil.tsx`
- ADR relacionada: [002-club-sortcoins.md](./002-club-sortcoins.md)
