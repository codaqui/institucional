<!-- AGENT-INDEX
purpose: Plan for storing event override metadata in this repo as the source of truth (GitHub-as-Database pattern).
audience: Devs extending the events sync pipeline, AI agents adding new sources/overrides.
status: Fase 1 (overrides) — design confirmed, always-PR model with codaqui-bot auto-merge, implementation pending. Fase 2 (plataforma de gestão de eventos) — desenho detalhado em revisão, nada implementado.
sections:
  - Visão Geral
  - Fase 2 — Plataforma de Gestão de Eventos (roadmap 2a–2e, papéis, modelo de dados, ingressos Stripe, sync de participantes, check-in, relatórios, decisões em aberto)
  - Fontes de Eventos Atuais e Futuras
  - Schema do Override
  - CRUD de Overrides (GitHub-as-Database)
  - Dois Caminhos para Editar
  - GitHub App: codaqui-bot (validação + auto-merge)
  - GitHub Action: Validação e Auto-Merge de Overrides
  - Merge de Dados: Base + Override (frontend)
  - Backend: Variáveis de Ambiente
  - Padrão Reutilizável: GitHub-as-Database
  - UI da Página de Evento: Dados Máximos
  - Testes Necessários
  - Checklist de Implementação
related-docs:
  - AGENTS.md §7 Events System — actual implemented events flow (snapshot pipeline)
agent-protocol: This is the EXTENDED plan. For the currently implemented snapshot pipeline, see AGENTS.md §7 first.
-->

# Event Organizer — Metadados via GitHub como Banco de Dados

Plano técnico para o sistema de correção de metadados de eventos externos por organizadores confiáveis,
usando o próprio repositório GitHub como fonte de verdade (GitHub-as-Database pattern).

---

## Visão Geral

Os eventos da Codaqui vêm de fontes externas (Discord, Meetup, OCGroups/CNCF, Sympla) via snapshots JSON gerados automaticamente.
O **Event Organizer** é um membro confiável com permissão de sobrescrever campos desses eventos
(título, imagem, descrição, localização, tags) sem depender de banco de dados externo.

A correção é persistida como um arquivo `.override.json` commitado no repositório, versionado pelo Git,
e aprovado automaticamente por um bot. O frontend lê e mescla os dois arquivos na página do evento.

---

## Fase 2 — Plataforma de Gestão de Eventos

> **Status:** desenho detalhado em revisão. **Nada desta seção está implementado** (confirmado
> em 2026-07: não existe `backend/src/events/`, módulo de e-mail, nem página `/admin/eventos`).
> Itens marcados com ⤴ dependem da Fase 1 (overrides + migração multi-role).

Além dos overrides de metadados, o plano evolui para uma **plataforma de gestão de eventos completa**,
tanto para eventos próprios da Codaqui (source `internal` — tipo já previsto em `EventSourceType`
em `src/data/events.ts`) quanto para eventos externos parceiros.

### Princípios

1. **A Codaqui não substitui a fonte original** quando a comunidade já tem uma (Meetup, Sympla…).
   A plataforma gerencia eventos *próprios* e oferece ferramentas opcionais para parceiros.
2. **Reuso antes de criar** — o desenho abaixo reutiliza deliberadamente o que já existe:
   - Stripe Checkout + webhook (`backend/src/stripe/`, metadata `entityType` já é o discriminador);
   - Ledger (`getOrCreateCommunityAccount(projectKey)` + `recordTransaction(...)`);
   - Padrão de módulo do `companies` (entidade + tracking + `@Cron` via `@nestjs/schedule`);
   - `GitHubDBService` ⤴ para qualquer escrita no repositório.
3. **Todo dinheiro passa pelo ledger** com `referenceId` prefixado, como os demais módulos.
4. **LGPD/opt-in** em toda comunicação com participantes.
5. **Listagem pública continua 100% estática** — eventos próprios entram no pipeline de
   snapshots como mais uma fonte (`internal:codaqui`), sem exigir backend no caminho de leitura.

### Roadmap em sub-fases

| Sub-fase | Escopo | Depende de |
|---|---|---|
| **2a — Fundação** | Migração multi-role ⤴, módulo `events` no backend, CRUD de eventos próprios, staff por evento, inscrições gratuitas (RSVP interno), snapshot `internal:codaqui` na listagem | Fase 1 |
| **2b — Ingressos pagos** | Tipos de ingresso e lotes, checkout Stripe, ledger + comprovante, refunds, controle anti-oversell | 2a |
| **2c — Check-in e comunicação** | QR code por inscrição, endpoint de check-in (role `event_checker`), e-mails transacionais (confirmação, lembrete D-1) | 2b |
| **2d — Sync de participantes + relatórios** | Importação de inscritos das fontes externas, relatórios de receita/presença/conversão | 2c |
| **2e — Real Network** | Networking/matchmaking entre participantes | 2d — longo prazo |

### Papéis e permissões

Novos valores no enum `MemberRole` (além de `EVENT_ORGANIZER` da Fase 1): `EVENT_FINANCE`,
`EVENT_HOST`, `EVENT_CHECKER`. **Pré-requisito ⤴:** hoje `Member.role` é enum single-value
(`backend/src/members/entities/member.entity.ts:40`) e o `RolesGuard` faz
`requiredRoles.includes(user.role)` (`backend/src/auth/guards/roles.guard.ts:27`) — a migração
para `roles text[]` planejada na Fase 1 precisa estar concluída, pois um mesmo membro
acumulará papéis (ex.: `['membro', 'event_organizer', 'event_checker']`).

| Papel | Escopo | Permissões |
|---|---|---|
| `event_organizer` | Global (atribuído por admin) + staff por evento | Criar/editar/publicar eventos próprios, gerenciar tipos de ingresso, overrides ⤴, ver relatórios |
| `event_finance` | Global | Relatórios financeiros de eventos, reembolsos de ingressos, exportações |
| `event_host` | Por evento (tabela `event_staff`) | Editar dados do próprio evento, ver lista de inscritos |
| `event_checker` | Por evento (tabela `event_staff`) | Somente check-in (endpoint dedicado) |

> Enquanto a Fase 1 usa `static/events/organizers.json` para ownership de eventos **externos**,
> a Fase 2 usa a tabela `event_staff` (Postgres) para eventos **próprios** — o arquivo JSON
> não escala para permissões por evento criadas em runtime.

### Modelo de dados (novo módulo `backend/src/events/`)

```typescript
// managed_events — evento próprio da Codaqui
@Entity('managed_events')
export class ManagedEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;              // usado no snapshot e nas URLs
  @Column() title: string;
  @Column('text') summary: string;
  @Column({ nullable: true }) imageUrl: string | null;
  @Column() location: string;
  @Column({ type: 'timestamptz' }) startAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) endAt: Date | null;
  @Column({ default: 'America/Sao_Paulo' }) timezone: string;
  @Column() communityProjectKey: string;               // conta ledger que recebe a receita
  @Column({ type: 'enum', enum: ManagedEventStatus, default: ManagedEventStatus.DRAFT })
  status: ManagedEventStatus;                          // draft | published | canceled | completed
  @Column({ type: 'int', nullable: true }) capacity: number | null;
  @Column() createdByMemberId: string;
  @CreateDateColumn() createdAt: Date;
}

// ticket_types — tipo de ingresso / lote (2b)
@Entity('ticket_types')
export class TicketType {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() eventId: string;
  @Column() name: string;                              // "Lote 1 — Early bird", "Comunitário"
  @Column({ type: 'enum', enum: TicketKind }) kind: TicketKind; // free | paid | community | company
  @Column({ type: 'int', default: 0 }) priceCents: number;      // 0 para free
  @Column({ type: 'int' }) quantityTotal: number;
  @Column({ type: 'int', default: 0 }) quantitySold: number;
  @Column({ type: 'timestamptz', nullable: true }) salesStartAt: Date | null; // janela do lote
  @Column({ type: 'timestamptz', nullable: true }) salesEndAt: Date | null;
  @Column({ type: 'int', default: 4 }) maxPerOrder: number;
  @Column({ default: true }) isActive: boolean;
}

// event_orders — compra (1..n ingressos), espelha o padrão Stripe das doações (2b)
@Entity('event_orders')
export class EventOrder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() eventId: string;
  @Column({ nullable: true }) memberId: string | null; // null = guest
  @Column({ type: 'int' }) totalCents: number;
  @Column({ nullable: true }) stripeSessionId: string | null;
  @Column({ nullable: true }) stripePaymentIntentId: string | null;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;                                 // pending | paid | refunded | expired | cancelled
  @Column({ type: 'timestamptz' }) expiresAt: Date;    // reserva de quota expira (ex.: 30 min)
}

// event_registrations — 1 linha por ingresso individual (gratuito ou pago)
@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() eventId: string;
  @Column() ticketTypeId: string;
  @Column({ nullable: true }) orderId: string | null;  // null para RSVP gratuito direto
  @Column({ nullable: true }) memberId: string | null;
  @Column() attendeeName: string;
  @Column() attendeeEmail: string;
  @Column({ unique: true }) checkinToken: string;      // uuid — vai no QR code
  @Column({ type: 'timestamptz', nullable: true }) checkedInAt: Date | null;
  @Column({ nullable: true }) checkedInByMemberId: string | null;
  @Column({ type: 'enum', enum: RegistrationStatus, default: RegistrationStatus.CONFIRMED })
  status: RegistrationStatus;                          // confirmed | cancelled | refunded | waitlist
  @CreateDateColumn() createdAt: Date;
}

// event_staff — papéis por evento (host/checker/finance delegados)
@Entity('event_staff')
export class EventStaff {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() eventId: string;
  @Column() memberId: string;
  @Column({ type: 'enum', enum: EventStaffRole }) staffRole: EventStaffRole; // host | checker | finance
}
```

Migration seguindo a convenção atual (`backend/src/migrations/<ts>-Migration010_ManagedEvents.ts`).

### Eventos próprios no pipeline de snapshots

A listagem `/eventos` continua lendo apenas `static/events/index.json`. Eventos próprios entram
como a fonte `internal:codaqui`:

1. Backend expõe `GET /events/public/managed` (público, somente `status = published`,
   payload já no shape `EventItem` + `EventSourceConfig`).
2. `scripts/sync-events.mjs` ganha um resolver `internal` que consome esse endpoint
   (URL via env `INTERNAL_EVENTS_API_URL`; se o backend estiver fora, usa o último snapshot —
   mesmo comportamento de fallback das demais fontes).
3. O workflow de sync grava `static/events/internal/codaqui/*.json` e commita como já faz hoje.

> Alternativa considerada e descartada: backend commita o snapshot via `GitHubDBService` ⤴ a cada
> publicação. O endpoint público é mais simples, não cria PRs a cada edição e mantém um único
> pipeline de geração.

### Inscrições gratuitas (2a)

`POST /events/:id/register` com `OptionalJwtAuthGuard` — guest informa `attendeeName` +
`attendeeEmail`; logado, os dados vêm do JWT (mesmo espírito do DonationFlow: login encouraged,
não obrigatório). Retorna a `EventRegistration` com `checkinToken`. Regras:

- Respeita `capacity` do evento e quota do `ticket_type` free (mesma reserva atômica do 2b);
- E-mail de confirmação entra só na 2c — na 2a a confirmação é na tela (token visível ao inscrito);
- Cancelamento self-service via `DELETE /events/registrations/:id` (dono ou staff).

### Ingressos pagos via Stripe (2b)

Reutiliza o fluxo existente de doações em vez de criar um paralelo:

1. Frontend chama `POST /events/:id/checkout` (`JwtAuthGuard` — ingresso pago exige identidade
   para o check-in; ver decisão em aberto #2) com `{ ticketTypeId, quantity }`.
2. Backend valida janela de venda e faz **reserva atômica de quota** (anti-oversell):

   ```sql
   UPDATE ticket_types
      SET quantity_sold = quantity_sold + $1
    WHERE id = $2 AND is_active
      AND (sales_start_at IS NULL OR sales_start_at <= now())
      AND (sales_end_at   IS NULL OR sales_end_at   >= now())
      AND quantity_sold + $1 <= quantity_total
   RETURNING id;
   ```

   Se não retornar linha → 409 "lote esgotado". Cria `EventOrder` `pending` com `expiresAt`.
3. Cria a sessão via `StripeService.createCheckoutSession` com metadata estendida:
   `{ entityType: 'event-ticket', eventId, orderId, communityId: event.communityProjectKey }`.
4. Webhook `checkout.session.completed` (handler já existente em
   `backend/src/stripe/stripe.service.ts:220`) ganha um branch para `entityType === 'event-ticket'`:
   marca order `paid`, gera as `EventRegistration` (uma por ingresso, com `checkinToken` próprio)
   e registra no ledger.
5. **Cron** (padrão `@Cron` do módulo `companies`) a cada 5 min expira orders `pending`
   vencidas e devolve a quota.
6. Refund via `charge.refunded` (já tratado): order → `refunded`, registrations → `refunded`,
   quota devolvida.

**Convenção de `referenceId` (adicionar à tabela da seção 9 do AGENTS.md quando implementar):**

| Módulo | Padrão | Reversal |
|---|---|---|
| Event ticket | `event-ticket:<orderId>` | `event-ticket-refund:<orderId>:<ts>` |

**Fluxo no ledger:** origem = conta `EXTERNAL` de pagadores Stripe (a mesma usada nas doações) →
destino = conta da comunidade dona do evento (`getOrCreateCommunityAccount(communityProjectKey)`).
O drill-down por evento é feito pelo prefixo do `referenceId` + `description`
(`"Ingressos — <título do evento>"`), sem criar conta por evento.

> ⚠️ O frontend classifica transações pelo prefixo do `referenceId` em
> `src/utils/transaction.tsx` (`TX_TYPE_CONFIG`) — adicionar a entrada `event-ticket`
> para a página de transparência renderizar corretamente.

Comprovante: `GET /events/orders/:id/receipt` (dono da order ou `event_finance`), JSON para
renderização/impressão — mesmo padrão do comprovante PJ de `companies`.

### Check-in e credenciamento (2c)

- Cada `EventRegistration` tem `checkinToken` (uuid) renderizado como QR code na página
  "Minhas inscrições" e no e-mail de confirmação.
- `POST /events/:id/checkin` com body `{ token }`, role `event_checker` (ou staff do evento):
  - **idempotente** — segunda leitura retorna `{ status: 'already_checked_in', checkedInAt }`
    com HTTP 200, nunca erro (leituras duplas são o caso normal na porta);
  - registra `checkedInAt` + `checkedInByMemberId`.
- Página mobile-first `/admin/eventos/checkin?event=<slug>`: câmera lê o QR, chama o endpoint,
  feedback verde/âmbar (já conferido)/vermelho (token inválido). Fallback: busca por nome/e-mail.
- Ação sensível → `audit` module, como os demais módulos financeiros.

### Comunicação (2c)

⚠️ **O backend não tem módulo de e-mail hoje** (nenhum mailer/SES/Resend no código) — esta é a
maior dependência nova da Fase 2. Criar `backend/src/notifications/` com provider configurável
(decisão em aberto #1) e templates:

| Template | Gatilho | Opt-in |
|---|---|---|
| Confirmação de inscrição (com QR) | order `paid` / RSVP confirmado | transacional (não precisa) |
| Lembrete D-1 | cron diário (padrão `companies`) | transacional |
| Certificado / pós-evento | conclusão + presença confirmada | **opt-in obrigatório** |

### Sincronização de participantes — fontes externas (2d)

Bidirecionalidade fonte por fonte, começando pelas com API acessível:

| Fonte | API de RSVP/participantes | Viabilidade |
|---|---|---|
| Discord | `GET /guilds/{guildId}/scheduled-events/{eventId}/users` (bot token) | ✅ Alta — já usamos `DISCORD_BOT_TOKEN` no sync de eventos |
| Sympla | API de participantes por evento (token do produtor) | 🟡 Média — depende de credencial de cada comunidade parceira |
| Meetup | RSVP via API exige OAuth do organizador | 🟡 Média — depende de credencial do DevParaná |
| OCGroups/Bevy | Sem API pública documentada de RSVP | ❌ Baixa — manter importação manual (CSV) |

Modelo: importação (fonte → plataforma) primeiro; exportação (plataforma → fonte) só onde a API
permitir escrita. Participantes importados viram `EventRegistration` com `orderId: null` e
origem registrada em campo `externalSource`/`externalId` (dedupe por par único).

### Relatórios (2d)

`GET /events/:id/report` (roles `event_organizer`, `event_finance` ou staff do evento):

- Inscritos por tipo de ingresso/lote e por dia (conversão);
- Receita — ledger filtrado por `referenceId LIKE 'event-ticket:%'` + `description` do evento;
- Taxa de presença (`checkedInAt IS NOT NULL / confirmados`);
- Export CSV da lista de participantes (com consentimento de dados).

### Endpoints da Fase 2 (resumo)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/public/managed` | Público | Eventos próprios publicados (consumido pelo sync) |
| `POST` | `/events` | event_organizer | Cria evento próprio (draft) |
| `PATCH` | `/events/:id` | event_organizer / staff | Edita evento |
| `POST` | `/events/:id/publish` | event_organizer | Publica (entra no próximo snapshot) |
| `POST` | `/events/:id/ticket-types` | event_organizer | Cria tipo/lote de ingresso |
| `POST` | `/events/:id/register` | Opcional (guest ou JWT) | Inscrição gratuita |
| `DELETE` | `/events/registrations/:id` | Dono ou staff | Cancela inscrição |
| `POST` | `/events/:id/checkout` | JwtAuthGuard | Checkout de ingressos pagos |
| `GET` | `/events/my-registrations` | JwtAuthGuard | Minhas inscrições + QR token |
| `POST` | `/events/:id/checkin` | event_checker / staff | Check-in por token (idempotente) |
| `GET` | `/events/:id/report` | event_organizer, event_finance | Relatório do evento |
| `GET` | `/events/orders/:id/receipt` | Dono ou event_finance | Comprovante da compra |

### Frontend da Fase 2

- `src/pages/admin/eventos.tsx` — CRUD de eventos próprios, tipos de ingresso, staff (segue o
  padrão de tela admin: guarda `useEffect([isLoggedIn])`, `authFetch`, `parseAuthJson`).
- `src/pages/admin/eventos-checkin.tsx` — tela de check-in mobile-first (câmera + fallback manual).
- Página pública do evento próprio — detalhe com formulário de inscrição/checkout embutido.
- `src/utils/transaction.tsx` — adicionar `event-ticket` ao `TX_TYPE_CONFIG` (transparência).

### Decisões em aberto (resolver antes de cada sub-fase)

1. **Provedor de e-mail** (2c): Resend vs Amazon SES vs SMTP transacional. Critérios: custo no
   volume esperado, domínio `codaqui.dev` já verificado, DX.
2. **Inscrição gratuita guest vs login** (2a): recomendação do plano é guest com nome+e-mail
   (login encouraged). Pagos: login obrigatório. Validar com o time.
3. **Conta ledger por evento?** (2b): recomendação é **não** — conta da comunidade + drill-down
   por `referenceId`. Criar conta por evento só se a transparência por evento virar requisito.
4. **Certificados** (2c+): PDF gerado no backend ou página pública de verificação por token?
5. **Refund parcial** (2b): em compra multi-ingresso, cancelar registrations individuais —
   confirmar se o fluxo de refund atual do Stripe (por charge) atende ou se precisa granularidade.
6. **Real Network** (2e): fora de escopo até 2a–2d estarem estáveis.

### Testes da Fase 2

- **Anti-oversell:** N requisições concorrentes disputando 1 vaga → exatamente 1 sucesso;
- **Idempotência de webhook:** mesmo `checkout.session.completed` entregue 2× → 1 order paga,
  1 transação no ledger (espelhar teste de doação existente);
- **Expiração de order:** cron devolve quota de order `pending` vencida;
- **Check-in:** segunda leitura do mesmo token → `already_checked_in` sem erro; token inválido → 404;
- **Multi-role:** após migração ⤴, membro com `['membro','event_checker']` acessa check-in mas
  não relatórios;
- **Snapshot interno:** evento `draft` não aparece em `/events/public/managed`.

---

## Fontes de Eventos Atuais e Futuras

| sourceKey | Plataforma | URL | Status |
|---|---|---|---|
| `discord:codaqui` | Discord | [Server Codaqui](https://discord.com/invite/xuTtxqCPpz) | ✅ Ativo |
| `meetup:devparana` | Meetup | [DevParaná](https://www.meetup.com/pt-BR/developerparana/) | ✅ Ativo |
| `ocgroups:cloud-native-maringa` | CNCF Open Community Groups | [ocgroups.dev/cncf/group/sq5vsqs](https://ocgroups.dev/cncf/group/sq5vsqs) | ✅ Ativo |
| `sympla:elasnocodigo` | Sympla | [sympla.com.br/produtor/elasnocodigo](https://www.sympla.com.br/produtor/elasnocodigo) | ✅ Ativo |
| `sympla:campostech` | Sympla | [sympla.com.br/produtor/camposvalley](https://www.sympla.com.br/produtor/camposvalley) | ✅ Ativo |

> As 5 fontes acima conferem com `events.config.json` (verificado em 2026-07). Existem ainda
> snapshots **legados** de `bevy:cloud-native-maringa` em `static/events/bevy/` — histórico da
> época da plataforma Bevy, antes da migração do CNCF para ocgroups.dev. A fonte não consta mais
> em `events.config.json` e não é sincronizada; os arquivos permanecem só para preservar o histórico.

### Nova role: `event_organizer`

> ⚠️ **`MemberRole` é single-value no schema atual.** Adicionar `event_organizer` diretamente
> pode sobrescrever `admin` ou `finance-analyzer` na mesma coluna.
> Antes de implementar, migrar para multi-role com array `text[]`:

```typescript
// backend/src/members/entities/member.entity.ts
// Novo enum:
export enum MemberRole {
  MEMBRO           = 'membro',
  EVENT_ORGANIZER  = 'event_organizer',  // ← novo
  FINANCE_ANALYZER = 'finance-analyzer',
  ADMIN            = 'admin',
}

// Coluna migrada de enum para array nativo do Postgres:
// Antes:   @Column({ type: 'enum', ... }) role: MemberRole;
// Depois (recomendado — array PG nativo, suporta GIN index e queries com ANY/&&):
@Column({ type: 'text', array: true, default: () => "ARRAY['membro']::text[]" })
roles: MemberRole[];   // ex: ['membro'], ['admin'], ['membro','event_organizer']

// ⚠️ Não use `simple-array` aqui: ele serializa em string CSV e perde
// as garantias de array nativo (queries seguras, indexação, constraints).
```

> Atualizar `RolesGuard` para usar `user.roles.includes(requiredRole)` em vez de igualdade.
> Atribuição: somente um `admin` pode adicionar/remover roles.

### Ownership de evento

Um `event_organizer` é "dono" de um conjunto de eventos externos. O mapeamento de ownership
é armazenado em `static/events/organizers.json` (também no repositório — sem banco):

```json
{
  "version": 1,
  "ownerships": [
    {
      "memberId": "uuid-do-membro",
      "githubHandle": "sehandle",
      "scope": ["meetup:devparana:*"]
    },
    {
      "memberId": "outro-uuid",
      "githubHandle": "outro",
      "scope": ["discord:codaqui:1234567890", "discord:codaqui:9876543210"]
    }
  ]
}
```

Escopo (`scope`) suporta:
- `source:sourceId:eventId` — evento específico
- `source:sourceId:*` — todos os eventos de uma fonte

O backend lê `organizers.json` em memória (cache de 5 min) para verificar permissão.

---

## Schema do Override

Arquivo: `static/events/<source>/<sourceId>/<eventId>.override.json`

Exemplo: `static/events/meetup/devparana/226163759.override.json`

```json
{
  "eventId": "226163759",
  "sourceKey": "meetup:devparana",
  "extendData": {
    "imageUrl": "https://res.cloudinary.com/...",
    "summary": "Resumo corrigido pelo organizador.",
    "location": "Nome correto do local",
    "tags": ["meetup", "devparana", "presencial", "mobile"],
    "featured": true
  },
  "ownerId": "uuid-do-membro",
  "ownerHandle": "githubHandle",
  "updatedAt": "2026-04-29T23:00:00-03:00",
  "reason": "Corrigindo título e adicionando banner do evento"
}
```

**Campos sobrescrevíveis** (`extendData`):

| Campo | Tipo | Notas |
|---|---|---|
| `imageUrl` | `string` | Banner/capa do evento |
| `summary` | `string` | Descrição override (max 500 chars) |
| `location` | `string` | Nome/endereço corrigido |
| `tags` | `string[]` | Lista completa (substitui, não adiciona) |
| `featured` | `boolean` | Destaque na página de eventos |
| `title` | `string` | Override de título (use com cautela) |

**Campos que nunca são sobrescrevíveis**: `id`, `startAt`, `endAt`, `href`, `source`, `sourceId`, `status`

---

## CRUD de Overrides (GitHub-as-Database)

Toda operação de override — criar, atualizar ou deletar — é tratada como uma
**operação de banco de dados via Git**: cada operação gera uma branch + PR,
que é validado e auto-mergeado pelo `codaqui-bot`. Nunca há commit direto em `main`.

| Operação | O que acontece no arquivo | Branch criada? | PR criado? |
|---|---|---|---|
| **Create** | Novo arquivo `.override.json` | ✅ | ✅ |
| **Read** | Leitura direta do arquivo em `main` | ❌ | ❌ |
| **Update** | Atualiza conteúdo do `.override.json` | ✅ | ✅ |
| **Delete** | Remove o arquivo `.override.json` | ✅ | ✅ |

### Convenção de branch

```
event-override/<sourceKey>-<eventId>-<timestamp>
Exemplo: event-override/meetup-devparana-226163759-1746823200000
```

### Ciclo de vida do PR

```
[Operação disparada]
        │
        ├── Backend cria branch → commita mudança no arquivo → abre PR
        │   ou owner cria branch diretamente no GitHub → edita arquivo → abre PR
        │
        ▼
[PR aberto com label "event-override"]
        │
        ▼
[codaqui-bot recebe webhook do PR]
        ├── Valida JSON do diff (campos proibidos, tipos, limites)
        ├── Se inválido → "Request changes" com comentário explicando o erro
        └── Se válido → Aprova PR → Habilita auto-merge (squash) → GitHub mergeia → deleta branch
```

---

## Dois Caminhos para Editar

O sistema suporta dois caminhos igualmente válidos. Ambos terminam no mesmo fluxo de PR + bot.

### Caminho A: Painel Admin (site)

1. `event_organizer` autenticado acessa `/admin/eventos`
2. Seleciona o evento e preenche o formulário de override
3. Clica em "Salvar" → backend:
   a. Valida os campos **antes** de qualquer chamada à GitHub API
   b. Cria branch `event-override/<sourceKey>-<eventId>-<ts>` via GitHub App token
   c. Commita o `.override.json` (create/update) ou deleta o arquivo (delete) na branch
   d. Abre PR com label `event-override`, título: `event: override <eventId> by @<handle> — <reason>`
4. `codaqui-bot` processa o PR (veja seção abaixo)
5. PR auto-mergeado em segundos; frontend vê o override na próxima requisição

### Caminho B: GitHub diretamente (web editor ou clone local)

1. `event_organizer` (ou qualquer membro autorizado) cria branch `event-override/<slug>-<ts>`
2. Cria, edita ou deleta o arquivo `.override.json` no caminho correto:
   `static/events/<source>/<sourceId>/<eventId>.override.json`
3. Abre PR com label `event-override` contra `main`
4. `codaqui-bot` valida o diff e auto-mergeia (mesmo fluxo do Caminho A)

> **Regra de segurança:** O `codaqui-bot` rejeita PRs que contenham alterações fora de
> `static/events/**/*.override.json`. PRs mistos (override + outro arquivo) são bloqueados.

---

## GitHub App: codaqui-bot (validação + auto-merge)

### Permissões necessárias

| Permissão | Nível | Para quê |
|---|---|---|
| `Contents` | Write | Criar branches e commitar arquivos (Caminho A) |
| `Pull requests` | Write | Criar PRs, aprovar, habilitar auto-merge |
| `Workflows` | Read | Ler status de checks antes de mergear |

> O repositório precisa ter **auto-merge habilitado** nas configurações:
> _Settings → General → Allow auto-merge_

### Lógica de validação do bot

```typescript
// Pseudocódigo do webhook handler do codaqui-bot
async function onPullRequestOpened(pr: PullRequest) {
  // 1. Verificar que todos os arquivos modificados são *.override.json
  const files = await listPRFiles(pr.number);
  const invalidFiles = files.filter(f => !f.filename.match(
    /^static\/events\/[^/]+\/[^/]+\/[^/]+\.override\.json$/
  ));
  if (invalidFiles.length > 0) {
    await requestChanges(pr.number, `PR contém arquivos fora do escopo permitido: ${invalidFiles.map(f => f.filename).join(', ')}`);
    return;
  }

  // 2. Para cada arquivo modificado (exceto deletions): validar JSON
  for (const file of files) {
    if (file.status === 'removed') continue;
    const content = await getFileContent(pr.head.sha, file.filename);
    const result = validateOverrideSchema(JSON.parse(content));
    if (!result.ok) {
      await requestChanges(pr.number, `JSON inválido em ${file.filename}: ${result.reason}`);
      return;
    }
  }

  // 3. Tudo válido: aprovar + habilitar auto-merge
  await approvePR(pr.number, '✅ Override validado automaticamente pelo codaqui-bot.');
  await enableAutoMerge(pr.number, 'SQUASH');
  // Após merge: GitHub deleta a branch automaticamente (configurar em Settings → Delete head branches)
}
```

### Validação do schema de override

```typescript
function validateOverrideSchema(data: unknown): { ok: boolean; reason?: string } {
  // Campos proibidos (nunca sobrescrevíveis)
  const forbidden = ['id', 'startAt', 'endAt', 'href', 'source', 'sourceId', 'status'];
  for (const key of forbidden) {
    if (key in (data as Record<string, unknown>).extendData ?? {}) {
      return { ok: false, reason: `Campo proibido: extendData.${key}` };
    }
  }
  // Limites
  if ((data as EventOverride).extendData?.summary?.length > 500)
    return { ok: false, reason: 'summary excede 500 caracteres' };
  if ((data as EventOverride).extendData?.tags?.length > 10)
    return { ok: false, reason: 'tags excede 10 itens' };
  if ((data as EventOverride).extendData?.speakers?.length > 10)
    return { ok: false, reason: 'speakers excede 10 itens' };
  return { ok: true };
}
```

---

## GitHub Action: Validação e Auto-Merge de Overrides

A GitHub Action abaixo é o ponto de entrada para o `codaqui-bot` processar PRs de override.
Ela é disparada em `pull_request` (não em push para `main`), garantindo validação **antes** do merge.

```yaml
# .github/workflows/validate-event-overrides.yml
name: Validate & auto-merge event overrides

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'static/events/**/*.override.json'

jobs:
  validate-and-merge:
    name: Validate override + auto-merge
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.GH_APP_ID }}
          private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}

      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          token: ${{ steps.app-token.outputs.token }}

      - uses: actions/setup-node@v6
        with: { node-version: '24' }

      - name: Validate override files
        run: node scripts/validate-overrides.mjs
        # Sai com código 1 se qualquer *.override.json for inválido

      - name: Approve PR (codaqui-bot)
        if: success()
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr review ${{ github.event.pull_request.number }} \
            --approve \
            --body "✅ Override validado automaticamente pelo codaqui-bot."

      - name: Enable auto-merge
        if: success()
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --squash \
            --auto \
            --delete-branch
```

> **Branch deletion automática:** o flag `--delete-branch` garante que a branch é deletada
> após o merge, mesmo para PRs criados pelo Caminho B (edição direta no GitHub).

---

## Merge de Dados: Base + Override (frontend)

A página `/eventos/[sourceKey]/[id]` (ou `/eventos?source=X&id=Y`) precisa mesclar:

```typescript
// src/utils/event-override.ts

export interface EventOverride {
  eventId: string;
  sourceKey: string;
  extendData: Partial<EventItem>;
  ownerHandle: string;
  updatedAt: string;
  reason?: string;
}

export async function loadEventWithOverride(
  source: string,
  sourceId: string,
  eventId: string
): Promise<{ event: EventItem; override: EventOverride | null }> {
  const basePath = `/events/${source}/${sourceId}/${eventId}.json`;
  const overridePath = `/events/${source}/${sourceId}/${eventId}.override.json`;

  const [baseRes, overrideRes] = await Promise.allSettled([
    fetch(basePath).then(r => r.json()),
    fetch(overridePath).then(r => r.json()),
  ]);

  const base: EventDetailFile = baseRes.status === 'fulfilled' ? baseRes.value : null;
  const override: EventOverride | null =
    overrideRes.status === 'fulfilled' ? overrideRes.value : null;

  if (!base) throw new Error(`Evento não encontrado: ${eventId}`);

  const event: EventItem = override
    ? { ...base.event, ...override.extendData }
    : base.event;

  return { event, override };
}
```

A página exibe um badge **"Metadados verificados por @handle"** quando override existe.

---

## Backend: Variáveis de Ambiente

```
# .env.example — adicionar:
GITHUB_REPO_OWNER=codaqui
GITHUB_REPO_NAME=institucional

# GitHub App — usado para criar branches + PRs (NUNCA token pessoal de membro):
GITHUB_APP_ID=                  # ID numérico do GitHub App `codaqui-bot`
GITHUB_APP_INSTALLATION_ID=     # ID da instalação no org `codaqui`
GITHUB_APP_PRIVATE_KEY=         # Chave privada PEM do GitHub App (multiline; usar base64 se necessário)
```

> ⚠️ **Não há `GITHUB_CREATE_PR` nem `GITHUB_COMMIT_DISABLED`** — o modelo é sempre-PR.
> O backend nunca commita direto em `main`. A autoria do organizador é registrada no campo
> `ownerHandle` do JSON override e no commit message — o committer real é sempre o GitHub App.

### Endpoints do módulo `event-organizer`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/organizers` | Admin | Lista mapeamento de ownership |
| `POST` | `/events/organizers` | Admin | Atribui eventos a um organizer |
| `DELETE` | `/events/organizers/:memberId` | Admin | Remove ownership |
| `PUT` | `/events/override/:sourceKey/:eventId` | event_organizer | Cria/atualiza override (abre PR) |
| `DELETE` | `/events/override/:sourceKey/:eventId` | event_organizer | Remove override (abre PR de delete) |
| `GET` | `/events/override/:sourceKey/:eventId` | Público | Retorna override atual (cache 5min) |
| `GET` | `/events/override/:sourceKey/:eventId/pr` | event_organizer | Retorna PR em aberto para o override |

---

## Padrão Reutilizável: GitHub-as-Database

Este fluxo (backend valida → **GitHub App** cria branch + PR → `codaqui-bot` auto-mergeia →
branch deletada) é reutilizável para qualquer dado que vive no repositório:

| Caso de uso | Arquivo alvo | Quem dispara (role) |
|---|---|---|
| Override de metadados de evento | `static/events/**/*.override.json` | event_organizer |
| Atualização de dados da equipe | `src/data/team.ts` | admin |
| Atualização de stats manuais (YouTube, Instagram) | `src/data/social.ts` | admin |
| Upload de fallback de eventos | `events.config.json` | admin |

> Em todos os casos o **committer é o GitHub App `codaqui-bot`**. O backend nunca usa
> tokens pessoais do membro para escrita — isso garante que:
> 1. Não dependemos do membro ser colaborador write do repo (`public_repo` scope OAuth não cobre);
> 2. Todos os tokens sensíveis ficam no servidor (não trafegam para o browser);
> 3. A auditoria fica centralizada (commits do bot, autoria lógica em `ownerHandle`).

### Biblioteca interna: `GitHubDBService`

```typescript
// backend/src/github-db/github-db.service.ts
@Injectable()
export class GitHubDBService {
  /**
   * Cria uma branch, commita a mudança e abre um PR.
   * O `actorHandle` é preservado no commit message e no título do PR.
   * O bot (`codaqui-bot`) valida e auto-mergeia o PR após aprovação.
   */
  async createPRWithFile(opts: {
    branch: string;         // nome da branch (ex: "event-override/meetup-devparana-123-ts")
    path: string;           // caminho do arquivo no repositório
    content: string;        // conteúdo em UTF-8 (undefined para deletar)
    commitMessage: string;  // "event: override <eventId> by @<actorHandle> — <reason>"
    prTitle: string;        // título do PR
    actorHandle: string;    // handle GitHub do membro (auditoria)
    labels?: string[];      // ex.: ["event-override"]
  }): Promise<{ prNumber: number; prUrl: string }>;

  async readFile(path: string): Promise<string | null>;

  /**
   * Cria branch + PR de delete (remove o arquivo override).
   * Mesmo fluxo: bot valida que só *.override.json está sendo removido e auto-mergeia.
   */
  async createPRDeleteFile(opts: {
    branch: string;
    path: string;
    commitMessage: string;
    prTitle: string;
    actorHandle: string;
  }): Promise<{ prNumber: number; prUrl: string }>;

  /** Retorna o PR aberto para uma branch (útil para polling de status) */
  async getPRForBranch(branch: string): Promise<{ number: number; state: string; mergedAt: string | null } | null>;
}
```

> Internamente o service usa `GITHUB_APP_ID` + `GITHUB_APP_INSTALLATION_ID` + `GITHUB_APP_PRIVATE_KEY`
> para gerar tokens de instalação de curta duração via `POST /app/installations/:id/access_tokens`.
> Nunca há `commitFile()` direto em `main` — todo write passa por branch + PR.

---

## UI da Página de Evento: Dados Máximos

O objetivo da UI é mostrar **o potencial máximo de um evento bem preenchido**,
inspirando organizadores a completar todos os campos. Quanto mais dados, mais rico o cartão.

### Campos disponíveis (base + override)

| Campo | Fonte | Preenchimento |
|---|---|---|
| `title` | sync / override | Automático |
| `summary` | sync / override | Automático + override recomendado |
| `imageUrl` | sync / **override** | **Organizer deve preencher** |
| `startAt` + `endAt` | sync | Automático |
| `timezone` | sync | Automático |
| `location` | sync / override | Automático + override para nome correto |
| `platform` | sync | Automático |
| `host` | sync | Automático |
| `tags` | sync / **override** | **Organizer deve adicionar** |
| `userCount` | sync | Automático (updated on sync) |
| `featured` | sync / **override** | **Organizer decide destacar** |
| `speakers[]` | **override only** | **Organizer preenche** |
| `slidesUrl` | **override only** | **Organizer preenche (pós-evento)** |
| `videoUrl` | **override only** | **Organizer preenche (pós-evento)** |
| `registrationUrl` | **override only** | **Organizer preenche** |

> Adicionar `speakers[]`, `slidesUrl`, `videoUrl`, `registrationUrl` ao schema de `extendData`.

### Wireframe: Evento com dados completos

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         [Banner 16:9 — imageUrl]                                 │
│              Fotografia ou arte do evento, fornecida pelo organizer              │
│                                                  ✅ Verificado por @handle       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  [Chip: AGENDADO ●]  [Chip: ☁️ Meetup]  [Chip: 📍 Maringá, PR]                  │
│                                                                                   │
│  DevParaná MeetUP #42                                                             │
│  ─────────────────────────────────────────────────────                           │
│  📅 Sáb, 10 Mai 2026 • 14h00 – 18h00 (America/Sao_Paulo)                       │
│  📍 FCV – Faculdade Cidade Verde · Av. Horácio Raccanello, 5950 – Novo Centro  │
│  👥 142 confirmados   🔁 Evento mensal                                           │
│                                                                                   │
│  [Inscrever-se]  [Compartilhar]  [Adicionar ao calendário]                       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  SOBRE O EVENTO                                                                   │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Teremos 4 palestras sobre Docker, Angular, Ionic e mais. Um encontro incrível  │
│  para quem trabalha ou quer entrar no mundo do desenvolvimento de software.     │
│                                                                                   │
│  🏷 kubernetes  cloud-native  devops  presencial  maringa  meetup                │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PALESTRANTES                                                                     │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Avatar] @fulano     [Avatar] @ciclano    [Avatar] @beltrano                   │
│   Título da palestra   Título da palestra   Título da palestra                  │
│   github.com/fulano    linkedin.com/...     github.com/...                       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  MATERIAIS  (visível pós-evento)                                                  │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [▶️ Ver gravação]   [📑 Ver slides]   [💬 Discussão no GitHub]                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  ORGANIZADO POR                                                                   │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Logo DevParaná]  DevParaná  ·  Meetup  ·  Ver todos os eventos                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Campos expandidos em `extendData`

```typescript
// Adicionar ao schema EventOverride.extendData:
interface ExtendData {
  // Campos existentes:
  imageUrl?: string;
  summary?: string;
  location?: string;
  tags?: string[];
  featured?: boolean;
  title?: string;

  // Campos novos para UI rica:
  speakers?: Array<{
    name: string;
    handle?: string;         // GitHub handle
    avatarUrl?: string;
    talkTitle?: string;
    profileUrl?: string;     // GitHub, LinkedIn, site
  }>;
  registrationUrl?: string;  // link de inscrição (se diferente de href)
  slidesUrl?: string;        // pós-evento: link para slides
  videoUrl?: string;         // pós-evento: YouTube, etc.
  discussionUrl?: string;    // GitHub Discussion, fórum, etc.
}
```

### Gamificação visual: Completude do Evento

Para motivar organizadores, exibir um **indicador de completude** no painel do organizer:

```
┌──────────────────────────────────────────────────────┐
│  Completude do evento: ████████░░ 80%                │
│  ✅ Imagem do evento                                  │
│  ✅ Descrição corrigida                               │
│  ✅ Tags adicionadas                                  │
│  ✅ Palestrantes (2 de 3)                             │
│  ⬜ Slides (disponível após o evento)                 │
│  ⬜ Gravação (disponível após o evento)               │
└──────────────────────────────────────────────────────┘
```

Quanto mais completo o evento, melhor o SEO e mais engajamento na página.

### Progressão do card na listagem

O card de evento na página `/eventos` também cresce conforme os dados:

| Nível | Campos preenchidos | Visual |
|---|---|---|
| Mínimo | título + data + plataforma | Chip + título + data |
| Básico | + summary + location | + resumo 2 linhas |
| Bom | + imageUrl + tags | + banner pequeno + chips de tags |
| Completo | + palestrantes + userCount + featured | + avatares + "142 confirmados" + destaque hero |

### Mudanças em `src/pages/eventos.tsx`

- Continua lendo `static/events/index.json` para a listagem
- `index.json` inclui campo `hasOverride: boolean` (adicionado pelo script de sync quando `.override.json` existe)
- Cards mostram `userCount` e primeiro palestrante se disponível
- Eventos `featured: true` aparecem em seção "Em destaque" no topo

### Nova página: `src/pages/eventos/[...slug].tsx` ou query params

- Lê o evento base + override (via `loadEventWithOverride()`)
- Banner hero com `imageUrl` (fallback: gradiente com emoji da fonte)
- Badge "Verificado por @handle" quando override existe
- Para `event_organizer` autenticado e dono do evento: botão "Editar metadados"
- Formulário de edição: todos os campos de `extendData` + campo "Motivo da alteração"
- Indicador de completude no formulário

### Componente: `EventOverrideBadge`

```tsx
// src/components/EventOverrideBadge/index.tsx
interface Props {
  override: EventOverride;
}
export default function EventOverrideBadge({ override }: Props) {
  return (
    <Chip
      size="small"
      color="success"
      icon={<VerifiedIcon />}
      label={`Verificado por @${override.ownerHandle}`}
      title={override.reason ?? 'Metadados corrigidos pelo organizador'}
    />
  );
}
```

---

## Testes Necessários

### Backend
- `github-db.service.spec.ts` — mock GitHub API, testa create/update/delete
- `events-override.controller.spec.ts` — permissões por role, validação de scope
- `organizers.service.spec.ts` — parse de scope glob (`meetup:devparana:*` vs específico)

### Frontend
- `event-override.test.ts` — merge de dados (extendData sobrescreve, campos ausentes preservados)
- `EventOverrideBadge.test.tsx` — render condicional
- Mock de `fetch` para `.override.json` retornando 404 (sem override) e 200 (com override)

### GitHub Action
- `scripts/validate-overrides.mjs` — valida todos os `*.override.json` modificados no PR:
  - Campos proibidos (startAt, endAt, id, source, status, href)
  - Tipos de cada campo de `extendData`
  - Limites (summary ≤ 500 chars, tags ≤ 10, speakers ≤ 10)
  - PRs mistos (override + outro arquivo) devem falhar

---

## Checklist de Implementação

- [ ] Criar GitHub App `codaqui-bot`:
  - Permissão `Contents: write` + `Pull requests: write`
  - Habilitar auto-merge no repositório (_Settings → General → Allow auto-merge_)
  - Habilitar delete automático de branches após merge (_Settings → General → Automatically delete head branches_)
- [ ] Migrar `MemberRole` de enum single-value para `text[]` + `RolesGuard` update
- [ ] Adicionar `EVENT_ORGANIZER` em `MemberRole` + migration Postgres
- [ ] Criar `static/events/organizers.json` com estrutura inicial vazia
- [ ] Criar módulo `backend/src/github-db/` com `GitHubDBService`:
  - `createPRWithFile()` — cria branch + commita + abre PR
  - `createPRDeleteFile()` — cria branch + remove arquivo + abre PR
  - `readFile()` — lê arquivo de `main`
  - `getPRForBranch()` — retorna estado do PR aberto
- [ ] Criar módulo `backend/src/event-organizer/` com endpoints de ownership e override
- [ ] Adicionar validação de override no backend (campos proibidos, tipos, limites) **antes** de criar branch
- [ ] Adicionar `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` em `.env.example`
- [ ] Criar workflow `.github/workflows/validate-event-overrides.yml` (on: pull_request → validate + approve + auto-merge)
- [ ] Criar script `scripts/validate-overrides.mjs`
- [ ] Atualizar script `scripts/sync-events.mjs` para incluir `hasOverride: boolean` no `index.json`
- [ ] Criar `src/utils/event-override.ts` com `loadEventWithOverride()`
- [ ] Criar `src/components/EventOverrideBadge/`
- [ ] Atualizar página de eventos para usar merge e badge
- [ ] Testes unitários (backend + frontend + validate-overrides.mjs)
- [ ] Atualizar `AGENTS.md` com novo role e padrão GitHub-as-DB (sempre-PR, sem commit direto)
