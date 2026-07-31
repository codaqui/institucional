<!-- AGENT-INDEX
purpose: ADR do Clube Codaqui (SortCoins). Registra a decisão de gamificar doações mensais com uma wallet interna e sorteios.
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
  - ../modules/events/ROLES.md — papéis do sistema
  - DEVELOPMENT.md — setup e deploy
-->

# ADR 002 — Clube Codaqui (SortCoins)

- **Data da decisão:** 2026-05
- **Status:** Implementado
- **Escopo:** backend/src/club/, páginas /clube e /membros/perfil

## Contexto

A Codaqui precisava reter e engajar doadores mensais. Em vez de apenas agradecimentos, decidimos criar um sistema de moeda virtual (**SortCoins**) vinculado às assinaturas Stripe, permitindo que apoiadores acumulem saldo e gastem em sorteios exclusivos.

## Decisão

Implementar um módulo `club` no backend com:

1. **Uma wallet por membro**, com saldos em JSONB (`balances`) e tipos congeláveis (`frozenTypes: text[]`).
2. **Conversão fixa:** 1 BRL doado = 1 SortCoin creditado.
3. **Crédito automático** via webhook Stripe `invoice.payment_succeeded`.
4. **Congelamento** ao cancelar assinatura (`customer.subscription.deleted`) ou após >3 dias em `past_due`.
5. **Sorteios** (`Raffle`) com custo fixo em SortCoins, vencedor sorteado proporcionalmente aos tickets acumulados (`coinsSpent`), com seed auditável (SHA-256).

## Regras de negócio

| Regra | Detalhe |
|-------|---------|
| Taxa de conversão | 1 BRL = 1 SortCoin |
| Crédito | `invoice.payment_succeeded` |
| Congelamento | Cancelamento ou `past_due` > 3 dias |
| Descongelamento | Novo `invoice.payment_succeeded` |
| Inscrição em sorteio | Apenas wallet ativa; dedução atômica |
| Saldo negativo | Nunca permitido |
| Vencedor | Proporcional aos tickets; seed salvo para re-verificação |

## Arquitetura backend

- **Módulo:** `backend/src/club/`
- **Entidades:** `Wallet`, `WalletTransaction`, `Raffle`, `RaffleEntry`
- **Tabelas:** `club_wallets`, `club_wallet_transactions`, `club_raffles`, `club_raffle_entries`
- **Atualizações de saldo:** sempre em transação DB com `SELECT ... FOR UPDATE` e unique constraint `(source, referenceId, coinType)` para idempotência de webhook.
- **Endpoints:** `/club/wallet`, `/club/raffles`, `/club/raffles/:id/enter`, `/club/raffles` (admin), `/club/raffles/:id/draw` (admin), `/club/raffles/:id/cancel` (admin).

## Consequências

- **Positivas:** engajamento recorrente; modelo extensível para outras moedas (`event_coin`, etc.); auditoria completa de créditos/débitos.
- **Negativas:** lógica de concorrência na wallet exige cuidado com locks; sorteios precisam de seed auditável para evitar contestações.

## Links relacionados

- Código: `backend/src/club/`
- Frontend: `src/pages/clube/`, `src/pages/membros/perfil.tsx`
