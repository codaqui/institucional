<!-- AGENT-INDEX
purpose: Mapa vivo de roles manuais, roles derivadas por designations e staff por evento.
audience: AI agents, mantenedores, admins
sections:
  - Visão geral das roles globais
  - Designations e roles derivadas
  - Roles de eventos (globais + staff por evento)
  - Matriz de permissões por módulo
  - Onde as permissões são verificadas no código
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ../adrs/001-event-platform.md — plataforma de eventos
  - ../adrs/006-directorates-designations.md — fonte única de vínculos e derivação
  - ../adrs/007-community-registry.md — responsible @ community
  - ./CODE_MANUAL.md — manual do código para agents
-->

# Mapa de Papéis e Habilidades

## 1. Visão geral

As roles globais vivem em `members.roles` (`text[]`) e são expostas na sessão JWT. A strategy recarrega as roles do banco a cada request; portanto, grant/revoke não exige um novo login. O frontend usa `useAuth()` e `user.roles` para navegação, mas toda autorização efetiva fica no backend.

| Role global | Origem | Descrição |
|---|---|---|
| `admin` | Manual (outro admin/bootstrap) | Acesso total, inclusive designations, diretorias, comunidades, settings e auditoria. |
| `finance-analyzer` | Manual | Lê finanças, transparência e relatórios; exporta transações de todas as contas. |
| `event_organizer` | Manual | Cria/edita eventos, ativa features e gerencia staff; eventos externos também exigem ownership. |
| `event_finance` | Manual | Reembolsa pedidos de ingressos e vê comprovantes/relatórios. |
| `event_checker` | Manual | Usa o scanner de check-in; sem staff no evento, não acessa a lista de participantes. |
| `membro` | Padrão ao logar | Membro regular da associação. |

## 2. Designations e roles derivadas

`member_designations` é a única fonte dos vínculos novos. `POST /designations`, confirmação e revogação são admin e sincronizam as roles abaixo na mesma transação. `MembersService.adminUpdate` rejeita adição ou remoção manual de qualquer role derivada.

| Vínculo ativo | Role derivada | Uso entregue na Fase 1a |
|---|---|---|
| `director @ directorate` | `diretor`, `voluntario` | Lista diretorias em gestão e edita somente a própria diretoria. |
| `volunteer @ directorate` | `voluntario` | Papel organizacional; não concede edição da diretoria. |
| `mentor @ program(mentoria)` ou `mentor @ extension_project` | `mentor` | Derivação implementada; módulos de mentoria/extensão ainda não entregues. |
| `manager @ program(universitario)` | `gestor_universitario` | Derivação implementada; módulo universitário ainda não entregue. |

`responsible @ community` não cria uma role global. O `DesignationsGuard` autoriza o responsible ativo a editar a própria comunidade e solicitar selo; somente admin concede o selo, que exige responsible ativo. Da mesma forma, `director @ directorate` é verificado no guard e novamente no service no `PATCH /directorates/:id`.

`GET /designations/me` alimenta `useMyDesignations` e a navegação contextual. Designations não substituem `event_organizer_ownership` nem `event_staff`.

## 3. Roles de eventos

### 3.1 Globais

- `admin` e `event_organizer` podem gerenciar qualquer evento; para externos, organizer também precisa de ownership.
- `event_finance` pode reembolsar qualquer pedido pago e acessar relatórios financeiros de eventos.
- `event_checker` global usa somente o scanner de QR quando não é staff do evento.

### 3.2 Staff por evento (`event_staff`)

Atribuídas dentro de um evento específico por `admin`/`event_organizer`:

| Staff role | Habilidades |
|---|---|
| `host` | Edita dados básicos do evento, vê inscritos e relatório, faz check-in. |
| `checker` | Faz check-in pelo scanner e pela lista do evento em que é staff. |
| `finance` | Vê relatório financeiro do evento. |

> O staff `checker` de um evento específico pode usar a lista manual; o role global `event_checker` sem staff só usa o scanner, evitando exposição de participantes de eventos que ele não opera.

## 4. Matriz de permissões de eventos

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

## 5. Pontos de verificação no código

- **Designations:** `backend/src/designations/designations.service.ts` (derivação), `designations.guard.ts` (escopo) e `backend/src/members/members.service.ts` (proteção contra edição manual).
- **Diretorias/comunidades:** controllers aplicam JWT/Roles/Designations; `directorates.service.ts` repete a checagem de escopo do diretor e `communities.service.ts` valida responsible ativo antes do selo.
- **Eventos:** `backend/src/events/events.service.ts` — `canManageAll`, `assertCanViewEvent`, `assertCanEditEvent`, `isStaff` e checagens de orders/refund/check-in.
- **Frontend check-in:** `frontend/src/components/islands/admin/checkin/CheckinApp.tsx` — `CHECKIN_ROLES` e `LIST_ROLES` separam scanner e busca manual.
- **Frontend admin:** controles de visibilidade complementam, nunca substituem, os guards do backend.

## 6. Adicionar uma nova role

1. Se for manual, adicione ao enum em `backend/src/members/entities/member.entity.ts` e atualize guards e telas afetadas.
2. Se representar um vínculo, modele primeiro uma designation e sua regra em `DERIVED_ROLE_RULES`; não permita edição manual da role resultante.
3. Inclua testes de concessão, revogação, escopo e proteção da role, e registre o comportamento neste documento e na ADR correspondente.
