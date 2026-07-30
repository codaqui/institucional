<!-- AGENT-INDEX
purpose: Mapa de papéis (roles) e habilidades do backend/frontend da Codaqui.
audience: AI agents, mantenedores, admins
sections:
  - Visão geral das roles globais
  - Roles de eventos (globais + staff por evento)
  - Matriz de permissões por módulo
  - Onde as roles são verificadas no código
related-docs:
  - AGENTS.md — guia geral do monorepo
  - docs/EVENT_PLAN_EXECUTION.md — execução do plano de eventos
  - docs/CODE_MANUAL.md — manual do código para agents
-->

# Mapa de Papéis e Habilidades

## 1. Visão geral

As roles globais vivem na coluna `members.roles` (text[]) do backend. A sessão JWT
também as expõe em `JwtPayload.roles`. O frontend usa o hook `useAuth()` e a
propriedade `user.roles` para tomar decisões de UI.

| Role global | Descrição | Concedida por |
|-------------|-----------|---------------|
| `admin` | Acesso total ao sistema e às comunidades. | Manual (outro admin). |
| `finance-analyzer` | Lê finanças, transparência e relatórios. | Manual. |
| `event_organizer` | Cria/edita eventos, ativa features e gerencia staff. | Manual. |
| `event_finance` | Reembolsa pedidos de ingressos e vê comprovantes. | Manual. |
| `event_checker` | Faz check-in via QR/scanner. Não acessa lista de participantes. | Manual. |
| `member` / `membro` | Membro regular da associação. | Padrão ao logar. |

## 2. Roles de eventos

### 2.1 Globais (aplicam-se a todos os eventos)

- `admin` e `event_organizer` podem gerenciar **qualquer** evento.
- `event_finance` pode reembolsar **qualquer** pedido pago.
- `event_checker` só pode usar o scanner de QR na tela de check-in.

### 2.2 Staff por evento (`event_staff`)

Atribuídas dentro de um evento específico por `admin`/`event_organizer`:

| Staff role | Habilidades |
|------------|-------------|
| `host` | Edita dados básicos do evento, vê inscritos, vê relatório, faz check-in. |
| `checker` | Faz check-in (scanner + lista, se for staff do evento). |
| `finance` | Vê relatório financeiro do evento. |

> **Diferença importante:** o staff `checker` de um evento específico pode usar a
> lista manual; o role global `event_checker` (sem ser staff) só pode usar o
> scanner. Isso evita que um credenciador genérico veja dados pessoais de
> participantes de eventos que ele não está operando.

## 3. Matriz de permissões

| Ação | admin | event_organizer | event_finance | event_checker | host | checker | finance |
|------|-------|-----------------|---------------|---------------|------|---------|---------|
| Criar/editar eventos | ✅ | ✅ | ❌ | ❌ | dados básicos* | ❌ | ❌ |
| Gerenciar tipos de ingresso | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver pedidos de ingressos | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Reembolsar pedido | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver lista de inscritos | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Fazer check-in (scanner) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Fazer check-in (lista manual) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Importar participantes CSV | ✅ | ✅ | ❌ | ❌ | ✅** | ❌ | ❌ |
| Ver transparência completa | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Host pode editar dados básicos do próprio evento.
\*\* Eventos externos: owner da ativação ou admin/organizer.

## 4. Pontos de verificação no código

- **Backend:** `backend/src/events/events.service.ts` — métodos `canManageAll`,
  `assertCanViewEvent`, `assertCanEditEvent`, `isStaff` e checagens inline nos
  endpoints de orders/refund/check-in.
- **Frontend check-in:** `src/pages/admin/eventos-checkin.tsx` — constantes
  `CHECKIN_ROLES` e `LIST_ROLES` controlam scanner vs. busca manual.
- **Frontend admin de eventos:** `src/pages/admin/eventos.tsx` — acesso restrito
  a `isAdmin || isEventOrganizer`.

## 5. Adicionar uma nova role

1. Adicione ao enum/conjunto de strings do backend (`MemberRole` em
   `backend/src/members/entities/member.entity.ts`).
2. Atualize os guards/checks em todos os módulos afetados.
3. Atualize o frontend em todas as telas que usam a role.
4. Registre neste documento.
