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

## Conversão de assinatura pessoal e configuração pelo admin (Fase 8b.3)

Admin pode revisar nome legal, nome fantasia, logo e website de uma empresa e salvar separadamente por `PATCH /companies/:id`, com update parcial e auditoria `company.profile_updated`. CNPJ não muda nessa edição; o responsável mantém seu acesso. Logo/website usam HTTPS por URL, sem upload.

A conversão de assinatura pessoal exige admin, assinatura mensal ativa e membro correspondente. `GET /companies/admin/personal-subscriptions` lista candidatos sem PII e `POST /companies/admin/subscription-conversions` atualiza somente os metadados da **mesma assinatura**, sem checkout, cancelamento, refund, mudança de preço ou backfill. Migration 052 registra a conversão com unique/lock por assinatura e permite recuperação pós-Stripe.

Empresa existente preserva status. Empresa nova permanece `pending` e não ganha vitrine, selo ou badge automaticamente. A wallet empresarial é criada sem transferir moedas pessoais; somente eventos futuros seguem os metadados empresariais. Repetição retorna `already_converted`.

### Consulta completa e candidatos (1.8.0)

`GET /companies/admin/members/:memberId/companies`, restrito a admin, consulta diretamente as empresas do responsável e projeta somente os campos necessários ao painel, sem métricas/wallet ou filtro da primeira página geral. O painel usa essa rota e apresenta o fim do período em pt-BR.

A busca de candidatos segue os cursores de Stripe Search até esgotar os resultados. Cursor ausente/repetido, falha do provider ou mais de 1.000 registros gera erro explícito; nenhuma lista parcial é apresentada como completa. A validação e a conversão continuam exigindo assinatura mensal ativa e metadata do membro. Doações avulsas repetidas mensalmente não se tornam assinaturas nem entram nesse fluxo por semelhança temporal.

## Doações empresariais únicas (1.10.0)

`POST /stripe/checkout-session/company/one-time` permite que o responsável por uma empresa `pending` ou `active` faça pagamento único para Tesouro ou comunidade Integrada ativa. O endpoint exige responsável e CNPJ, valida valor/comunidade e cria `mode: payment` com a configuração de métodos do fluxo avulso PF. Não usa `recurring`, `subscription_data`, `setSubscriptionAmount` ou `customer_creation`; não altera assinatura, status, vitrine, selo, badge ou SortCoins. Outros status são bloqueados com orientação de regularização.

O webhook preserva confirmação assíncrona e idempotência, registra **Doação empresarial única** com empresa/comunidade/responsável e mantém **Assinatura mensal empresarial** para recorrências. O responsável encontra a transação em Minhas doações e gera o PDF pelo diálogo de transparência. Empresa nova continua `pending` e fora de `/patrocinadores`; empresa ativa não tem benefícios alterados pela doação avulsa.

## Consequências

- **Positivas:** fonte de receita corporativa; visibilidade para patrocinadores; wallet separada evita confusão com saldo pessoal.
- **Negativas:** onboarding mais burocrático (CNPJ, ativação manual); necessidade de tracking de status de assinatura e cron de congelamento.

## Links relacionados

- Código: `backend/src/companies/`
- Frontend: `src/pages/empresas/`, `src/pages/membros/perfil.tsx`
- ADR relacionada: [002-club-sortcoins.md](./002-club-sortcoins.md)
