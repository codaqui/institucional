<!-- AGENT-INDEX
purpose: Estado de execução do EVENT_PLAN.md — o que já foi implementado, o que falta e pendências conhecidas.
audience: AI agents, mantenedores, product owners
sections:
  - Resumo do escopo
  - Status por sub-fase (2a–2e)
  - Bugs corrigidos neste ciclo
  - Pendências e débitos técnicos
  - Próximos passos recomendados
related-docs:
  - docs/EVENT_PLAN.md — plano original
  - docs/ROLES.md — mapa de papéis
  - docs/CODE_MANUAL.md — manual do código
-->

# Execução do Plano de Eventos

> Última atualização: 2026-07-30
>
> Este documento complementa o `docs/EVENT_PLAN.md` original. Em caso de divergência, o código e este
> registro têm precedência sobre o plano de alto nível.

## 1. Resumo

As Fases 1 (overrides GitHub-as-Database) e 2a–2d (plataforma de gestão de eventos) estão
**implementadas**. A Fase 2e (Real Network) permanece como plano futuro.

O sistema hoje suporta:

- Eventos próprios (`internal:codaqui`) com CRUD, publicação e snapshot.
- Eventos externos com overrides de metadados e ativação à la carte de features.
- Tipos de ingresso / lotes (free, paid, community, company).
- Checkout Stripe para ingressos pagos (internos e externos).
- Ledger com `referenceId` prefixado (`event-ticket:*`, `event-ticket-refund:*`).
- Check-in por QR (scanner + lista manual).
- Importação CSV de participantes para eventos externos.
- Certificados sob demanda (perfil público + verificação pública).
- Histórico público de participações.
- Checkout embedded na página do evento (Stripe Embedded Checkout).
- Página dedicada de termos de compra e política de reembolso (`/termos-de-compra`).
- Reembolso/despesa vinculada a evento (interno ou externo) via módulo de reembolsos.
- Transparência geral mostrando receita e quantidade de ingressos vendidos por comunidade.

## 2. Status por sub-fase

### 2a — Fundação ✅

- Multi-role (`members.roles text[]`) migrado.
- CRUD de eventos próprios (`/admin/eventos`).
- Staff por evento (`host`, `checker`, `finance`).
- Inscrições gratuitas via `POST /events/:id/register` (conta obrigatória).
- Snapshot `internal:codaqui` integrado ao pipeline (`scripts/sync-events.mjs`).

### 2b — Ingressos pagos ✅

- Tipos de ingresso com quota atômica anti-oversell.
- Checkout Stripe (`/events/:id/checkout`, `/events/external/:eventKey/checkout`).
- Checkout embedded na página do evento (`uiMode: 'embedded'`), usando
  `<StripeEmbeddedCheckoutDialog>`; fallback `hosted` mantido.
- Webhook `checkout.session.completed` gera registrations e ledger.
- Reembolso total/partial (`POST /events/orders/:id/refund`).
- Comprovante (`GET /events/orders/:id/receipt`).
- Termos de compra versionados (`2026-07-v1`) e aceite obrigatório; página dedicada
  `/termos-de-compra` centraliza o texto legal.

### 2c — Check-in, comunicação e certificados ✅ (com ressalvas)

- QR code por inscrição (`/membro`, aba Eventos).
- Check-in idempotente por token (`/admin/eventos-checkin`).
- E-mails transacionais de confirmação (SMTP via Gmail, com `email_logs`).
- Certificados sob demanda no perfil público.
- Verificação pública de certificado (`/events/certificates/verify/:code`).

**Ressalvas:**
- UI de opt-in de comunicações pós-evento **pendente** (`members.eventCommsOptIn` existe, mas não há toggle na UI; transacionais ignoram a flag).
- Painel `/admin/emails` **implementado** — lista logs por template/status/evento com analytics e reenvio manual de falhas.

### 2d — Externos à la carte, participantes e relatórios ✅ (com ressalvas)

- Ativação de features (`checkin`, `certificates`, `payments`) em eventos externos.
- Importação CSV idempotente com match por e-mail/GitHub.
- Re-match automático na criação de membro e manual via endpoint.
- Histórico público de participações.
- Relatório básico do evento (`GET /events/:id/report`).

**Ressalvas:**
- Sync automático por API das fontes externas é **bônus/parcial** — apenas Discord teria viabilidade técnica hoje.
- Relatório financeiro ainda não faz drill-down por evento no ledger (usamos `event_orders`).
- Painel de gestão de pedidos foi adicionado neste ciclo (`/admin/eventos` → "Pedidos").
- Reembolso/despesa vinculada a evento externo implementada via extensão do módulo de
  reembolsos (`POST /events/external/:eventKey/reimbursements`).

### 2e — Real Network 🚧

- Fora de escopo. Nenhum código implementado.

## 3. Bugs corrigidos / funcionalidades finalizadas neste ciclo

1. **Crash em `/membro`, aba Eventos** — registrations externas podem ter `event === null`;
   frontend agora renderiza defensivamente usando `activation.title`.
2. **Ingressos gratuitos escondidos em eventos externos** — agora exibidos em aba separada
   com CTA para a plataforma original.
3. **Caixa do evento não aparecia em `/transparencia`** — adicionados filtros
   `event-ticket` / `event-ticket-refund` no backend e no frontend `TransactionTable`.
4. **Gestão de pedidos inexistente** — criados endpoints `GET /events/:id/orders` e
   `GET /events/external/:eventKey/orders` + dialog de pedidos com reembolso.
5. **Mapa de funções do check-in confuso** — `event_checker` global só vê scanner;
   `admin`/`event_organizer`/`event_host` veem também a lista manual.
6. **Checkout redirecionava para fora do site** — checkout de ingressos agora usa Stripe
   Embedded Checkout (`<StripeEmbeddedCheckoutDialog>`) dentro da página do evento.
7. **Termos de compra espalhados** — criada página dedicada `/termos-de-compra` com política
   de reembolso (CDC art. 49); checkouts linkam para ela.
8. **Despesas de evento fora do ledger** — reembolsos/despesas agora podem ser vinculados a
   evento próprio ou externo, seguindo o fluxo de aprovação existente e registrando no ledger.

## 4. Pendências e débitos técnicos

| # | Item | Prioridade | Notas |
|---|------|------------|-------|
| 1 | Hub unificado de eventos no admin | Média | APIs existem; falta consolidar `/admin/eventos` + `/admin/overrides` em uma única tela com busca, filtros e ações contextuais por evento. Ver diretrizes em `docs/EVENT_PLAN.md §Diretrizes de UI/UX para organizadores`. |
| 2 | Toggle de opt-in de comunicações pós-evento | Média | Coluna existe; falta UI. |
| 3 | Drill-down financeiro por evento | Média | Parcial: despesas/reembolsos já podem ser vinculados a evento; falta filtro explícito por evento na transparência e relatório unificado de caixa. |
| 4 | Taxas Stripe de ingressos no ledger | Baixa | Hoje fees ficam fora do ledger. |
| 5 | Check-in de eventos externos na UI | Baixa | API existe; tela de check-in já lista ativações externas com `checkin`. |
| 6 | Sync automático Discord RSVP | Baixa | Viável, mas requer bot com escopo adicional. |
| 7 | Fase 2e — Real Network | Futuro | Fora de escopo. |

## 5. Próximos passos recomendados

1. **Validar E2E** a jornada completa: criar evento → criar lote pago → comprar ingresso →
   ver transação na transparência → fazer check-in → emitir certificado.
2. **Implementar hub unificado de eventos** no admin (consolidar `/admin/eventos` e
   `/admin/overrides`) conforme diretrizes de UI/UX em `docs/EVENT_PLAN.md`.
3. **Decidir** se vamos criar conta ledger por evento ou manter o drill-down por
   `referenceId` + `description`.
4. **Adicionar toggle de opt-in** de comunicações pós-evento no perfil do membro.
