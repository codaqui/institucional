<!-- AGENT-INDEX
purpose: Desenho curto da reconciliação manual e idempotente de taxas Stripe no admin.
audience: AI agents, maintainers
status: implementado e verificado em develop; reconciliação em produção pendente de deploy
sections:
  - Contexto e evidências
  - Abordagens
  - Contrato escolhido
  - Interface e segurança
  - Verificação
related-docs:
  - ../../../backend/src/stripe/stripe.service.ts
  - ../../modules/MONOREPO_OPERATIONS.md
-->

# Reconciliação de taxas Stripe — desenho

## Contexto e evidências

A doação `pi_3UcXAwFtPCSoiGky0ZY7eljt`, de R$ 200, está no dump sem taxa no ledger. O Stripe confirma `txn_3UcXAwFtPCSoiGky0ar3JmFv`, com fee de 837 centavos. Os eventos de cobrança e Checkout foram criados antes da gravação da doação. O fluxo atual descarta taxa quando ainda não encontra a doação e também transforma falhas de consulta/gravação em logs sem retry durável; os logs internos necessários para distinguir o ramo exato não estão no dump.

Objetivo: permitir que um admin consulte novamente um PaymentIntent e registre somente a taxa ausente. Não recriar doações, não alterar valores no Stripe e não duplicar taxas em tentativas repetidas ou concorrentes.

## Abordagens

- **Escolhida — reconciliação sob demanda no módulo Stripe:** reutiliza a captura atual, adiciona resultado explícito e mantém `stripe-fee:<balanceTransactionId>` como chave idempotente. É pequena, cobre webhooks fora de ordem e falhas temporárias e não exige migration.
- **Fila automática nova:** daria retry durável, mas exigiria entidade, worker e operação adicionais. Não é necessária para a correção manual pedida.
- **Lançamento manual pelo ledger:** já seria possível, mas exigiria valor e contas digitados, sem conferência com Stripe e com maior risco de erro. Rejeitada.

## Contrato escolhido

`POST /stripe/reconcile-fee`, protegido por JWT e role `admin`, recebe `{paymentIntentId}` e valida o formato `pi_...`.

O service recupera o PaymentIntent com `latest_charge.balance_transaction` expandidos e usa o mesmo núcleo `recordStripeFee` dos webhooks. Resultados possíveis:

- `created`: taxa criada no ledger, com IDs e valor em centavos;
- `already_exists`: taxa já presente, sem nova gravação;
- `no_fee`: balance transaction sem taxa, sem gravação.

Charge/BT ainda indisponível retorna 409; doação original ausente retorna 404; falha da consulta Stripe retorna 502; falha de gravação não é convertida em sucesso. A coluna única `transactions.referenceId` permanece como proteção final. Se outra execução vencer a corrida, a violação de unicidade é relida como `already_exists`; demais erros continuam falhando.

Uma criação gera auditoria de governo `stripe.fee_reconciled`, sem dados pessoais. Não há migration nem escrita na API Stripe.

## Interface e segurança

Nova aba **Taxas Stripe** em `/admin/lancamento`, apenas para admin. O formulário informa que a operação lê o Stripe e só cria a taxa ausente, aceita o PaymentIntent, mostra progresso e apresenta sucesso, já existente, sem taxa ou erro sem apagar o input. Usa `useAuth`/`authFetch`, MUI e o proxy `/stripe/` já existente.

## Verificação

- Testes do service: criação, repetição, corrida por unique, ausência de taxa/doação/BT e erro Stripe.
- Teste do controller: delegação e auditoria somente após criação.
- Testes da ilha: envio, resultados e erro; acesso restrito no painel.
- Gates: build e Jest do backend; Vitest, check e build codaqui; builds tenants por haver ilha compartilhada.
- A doação real não será alterada durante os testes. Após publicação, o admin poderá reconciliar `pi_3UcXAwFtPCSoiGky0ZY7eljt`; a segunda chamada deve retornar `already_exists`.
