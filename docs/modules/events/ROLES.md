<!-- AGENT-INDEX
purpose: Mapa vivo de roles manuais, roles derivadas por designations, staff por evento e autorização de horas/guests.
audience: AI agents, mantenedores, admins
sections:
  - Visão geral das roles globais
  - Designations e roles derivadas
  - Roles de eventos (globais + staff por evento)
  - Matriz de permissões por módulo
  - Horas, declarações e guests
  - Onde as permissões são verificadas no código
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ../../adrs/001-event-platform.md — plataforma de eventos
  - ../../adrs/006-directorates-designations.md — fundação de designations
  - ../../adrs/013-hour-ledger.md — ownership, horas e guests na Fase 2
  - ../../adrs/007-community-registry.md — responsible @ community
  - ./CODE_MANUAL.md — manual do código para agents
-->

# Mapa de Papéis e Habilidades

## 1. Visão geral

As roles globais vivem em `members.roles` (`text[]`) e são expostas na sessão JWT. A strategy recarrega as roles do banco a cada request; portanto, grant/revoke não exige um novo login. O frontend usa `useAuth()` e `user.roles` para navegação, mas toda autorização efetiva fica no backend.

| Role global | Origem | Descrição |
|---|---|---|
| `admin` | Manual (outro admin/bootstrap) | Acesso total, inclusive designations, diretorias, comunidades, horas, settings e auditoria. |
| `finance-analyzer` | Manual | Lê finanças, transparência e relatórios; exporta transações e aprova/rejeita horas pendentes. |
| `event_organizer` | Manual | Cria/edita eventos, ativa features e gerencia staff; eventos externos também exigem ownership. |
| `event_finance` | Manual | Reembolsa pedidos de ingressos e vê comprovantes/relatórios. |
| `event_checker` | Manual | Usa o scanner de check-in; sem staff no evento, não acessa a lista de participantes. |
| `membro` | Padrão ao logar | Membro regular da associação. |

## 2. Designations e roles derivadas

`member_designations` é a única fonte dos vínculos novos. `POST /designations`, confirmação e revogação são admin e sincronizam as roles abaixo na mesma transação. `MembersService.adminUpdate` rejeita adição ou remoção manual de qualquer role derivada.

| Vínculo ativo | Role derivada | Uso entregue |
|---|---|---|
| `director @ directorate` | `diretor`, `voluntario` | Edita somente a própria diretoria e lança `directorate_activity` para si nesse escopo. |
| `volunteer @ directorate` | `voluntario` | Papel organizacional; não concede edição da diretoria nem aprovação de horas. |
| `organizer @ event` | Nenhuma | Fonte canônica dos scopes de ownership; eventos externos continuam exigindo a role global `event_organizer`. |
| `mentor @ program(mentoria)` ou `mentor @ extension_project` | `mentor` | Derivação implementada; módulos de mentoria/extensão ainda não entregues. |
| `manager @ program(universitario)` | `gestor_universitario` | Derivação implementada; módulo universitário ainda não entregue. |

`responsible @ community` não cria uma role global. O `DesignationsGuard` autoriza o responsible ativo a editar a própria comunidade e solicitar selo; somente admin concede o selo, que exige responsible ativo. Da mesma forma, `director @ directorate` é verificado no guard e novamente no service no `PATCH /directorates/:id`.

`GET /designations/me` alimenta `useMyDesignations` e a navegação contextual. Na Fase 2, `GET /events/organizers` e `getOwnedScopes()` passaram a ler `organizer @ event`. A tabela `event_organizer_ownerships` permanece sem drop e recebe dual-write transacional junto das designations; `event_staff` continua sendo o modelo separado de staff por evento.

## 3. Roles de eventos

### 3.1 Globais

- `admin` e `event_organizer` podem gerenciar eventos; para externos, organizer também precisa de designation `organizer @ event` compatível com o scope exato ou wildcard.
- `event_finance` pode reembolsar qualquer pedido pago e acessar relatórios financeiros de eventos.
- `event_checker` global usa somente o scanner de QR quando não é staff do evento.

### 3.2 Staff por evento (`event_staff`)

Atribuídas dentro de um evento específico por `admin`/`event_organizer`:

| Staff role | Habilidades |
|---|---|
| `host` | Edita dados básicos do evento, vê inscritos e relatório, faz check-in e emite convites guest. |
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
| Emitir convite guest** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Fazer check-in (scanner) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Fazer check-in (lista manual) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Importar participantes CSV | ✅ | ✅ | ❌ | ❌ | ✅*** | ❌ | ❌ |
| Ver transparência completa | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Host pode editar dados básicos do próprio evento.

\*\* Managed event publicado e gratuito, com lote gratuito ativo. O claim público não exige role, mas exige token, consentimento e Turnstile.

\*\*\* Eventos externos: owner da ativação ou admin/organizer.

## 5. Horas, declarações e guests

| Ação | Autorização efetiva |
|---|---|
| `POST /hours` | Admin ou diretor ativo da diretoria informada em `sourceId`; somente `directorate_activity`, para o próprio membro e como `pending`. |
| `GET /hours/pending`, `POST /hours/:id/approve`, `POST /hours/:id/reject` | Admin ou `finance-analyzer`; somente entradas pendentes e rejeição com motivo. |
| `GET /hours/me`, `GET /hours/me/summary` | Membro autenticado, somente seus dados. |
| `GET /hours/members/:memberId/statement` | Somente o próprio membro; emite snapshot de horas aprovadas no período. |
| `GET /hours/public`, `GET /hours/members/:memberId/summary`, `GET /hours/verify/:code` | Público, mas horas, ano, extrato, declaração e selo respeitam `profileVisibility` e membro ativo. |
| `POST /events/organizers/reconcile` | Admin; reconciliação idempotente do legado para `organizer @ event`. |
| `POST /events/:id/guest-invites` | Actor autorizado a editar o evento: admin, organizer ou staff `host`, conforme o evento. |
| `POST /events/public/guest-claim` | Público com token válido, consentimento e Turnstile; não exige conta. |

O crédito `event_checkin` não depende de uma role do participante: depende de check-in autorizado pelo staff, inscrição com `memberId` e carga válida. Guest sem conta não recebe horas, inclusive retroativamente ao vincular uma conta.

## 6. Pontos de verificação no código

- **Designations:** `backend/src/designations/designations.service.ts` (derivação), `designations.guard.ts` (escopo) e `backend/src/members/members.service.ts` (proteção contra edição manual).
- **Diretorias/comunidades:** controllers aplicam JWT/Roles/Designations; `directorates.service.ts` repete a checagem de escopo do diretor e `communities.service.ts` valida responsible ativo antes do selo.
- **Horas:** `backend/src/hours/hours.controller.ts` aplica JWT/Roles; `hours.service.ts` repete escopo do diretor, transição pendente, idempotência e visibilidade.
- **Ownership:** `backend/src/event-organizer/event-organizer-ownership.service.ts` lê designations, faz dual-write e restringe reconcile a admin.
- **Eventos/guests:** `backend/src/events/events.service.ts` — `canManageAll`, `assertCanViewEvent`, `assertCanEditEvent`, `isStaff`, check-in, claim, vínculo e retenção.
- **Frontend check-in:** `frontend/src/components/islands/admin/checkin/CheckinApp.tsx` — todo membro autenticado consulta `/events/checkin-scope`; somente os eventos retornados entram no seletor e `canUseList` separa scanner e busca manual.
- **Frontend admin:** controles de visibilidade complementam, nunca substituem, os guards do backend.

## 7. Adicionar uma nova role

1. Se for manual, adicione ao enum em `backend/src/members/entities/member.entity.ts` e atualize guards e telas afetadas.
2. Se representar um vínculo, modele primeiro uma designation e sua regra em `DERIVED_ROLE_RULES`; não permita edição manual da role resultante.
3. Inclua testes de concessão, revogação, escopo e proteção da role, e registre o comportamento neste documento e na ADR correspondente.
