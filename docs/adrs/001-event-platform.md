<!-- AGENT-INDEX
purpose: ADR da Plataforma de Gestão de Eventos da Codaqui. Registra decisões arquiteturais de overrides, eventos próprios, ingressos pagos, check-in, certificados e integração com ledger.
audience: Devs, AI agents e mantenedores trabalhando no módulo de eventos.
status: Fase 1 (overrides) + Fase 2a–2d IMPLEMENTADAS (2026-07-30). Fase 2e (Real Network) é plano futuro.
sections:
  - Contexto e decisões
  - Fase 2 — Plataforma de Gestão de Eventos (princípios, roadmap 2a–2e, mapa detalhado de papéis, modelo de dados, ingressos Stripe, sincronização de participantes, check-in, certificados, relatórios, decisões de design)
  - Fontes de Eventos Atuais e Futuras
  - Schema do Override
  - CRUD de Overrides (API REST)
  - Merge de Dados: Base + Override (snapshots)
  - Backend: Variáveis de Ambiente
  - UI/UX para Organizadores (hub unificado, plugins, busca, caixa)
  - Testes Necessários
  - Checklist de Implementação
  - Registro de Implementação (2026-07)
related-docs:
  - ../AGENTS.md §7 Events System — fluxo real de snapshots e overrides
  - ../modules/events/CODE_MANUAL.md — manual prático do código do módulo de eventos
  - ../modules/events/ROLES.md — matriz de permissões global e por evento
agent-protocol: Fases 1 e 2a–2d estão IMPLEMENTADAS. Sempre consulte o "Registro de Implementação (2026-07)" ao final antes de assumir que o desenho textual reflete 100% o código. Para detalhes de implementação (arquivos, métodos, fluxos), use ../modules/events/CODE_MANUAL.md.
-->

# ADR 001 — Plataforma de Gestão de Eventos

- **Data da decisão:** 2024 → 2026-07-30
- **Status:** Implementado (Fases 1 e 2a–2d)
- **Escopo:** backend/src/events/, src/pages/eventos/, src/pages/admin/eventos*, scripts/sync-events.mjs

## Contexto

A Codaqui organiza eventos próprios e promove eventos de comunidades parceiras. Precisávamos de uma plataforma unificada para listar eventos, vender ingressos, fazer check-in, emitir certificados e manter transparência financeira, sem depender exclusivamente de plataformas externas.

## Decisões

1. **Soberania sobre eventos próprios** — a plataforma é a fonte de verdade para eventos organizados diretamente pela Codaqui. Para eventos de parceiros, mantemos uma cópia atualizada via snapshots + importação CSV.
2. **Reuso com KISS** — usamos Stripe Checkout + webhook, ledger existente, padrão de módulo do `companies`, e evitamos fluxos paralelos.
3. **Todo dinheiro passa pelo ledger** com `referenceId` prefixado (`event-ticket:*`, `event-ticket-refund:*`, `reimbursement:*`). Todo evento é associado a uma comunidade (`communityProjectKey`).
4. **LGPD/opt-in** em comunicações com participantes.
5. **Listagem pública 100% estática** — eventos próprios entram no pipeline de snapshots (`internal:codaqui`), sem backend no caminho de leitura.
6. **Overrides no PostgreSQL** — metadados de eventos externos são corrigidos via API REST (`/events/overrides`) e persistidos na tabela `event_overrides`. O sync aplica esses metadados nos snapshots.

## Consequências

- **Positivas:** plataforma unificada; transparência financeira automática; extensível para novas fontes de eventos; overrides imediatos sem PRs.
- **Negativas:** snapshot funciona como cache — eventos recém-publicados podem levar até 1h para aparecer na listagem pública; modelo de participantes externos exige importação manual de CSV.

## Visão Geral

Os eventos da Codaqui vêm de fontes externas (Discord, Meetup, OCGroups/CNCF, Sympla) via snapshots JSON gerados automaticamente.
O **Event Organizer** é um membro confiável com permissão de sobrescrever campos desses eventos
(título, imagem, descrição, localização, tags, palestrantes, carga horária).

A correção é salva no banco de dados via API REST (`/events/overrides`). O sync de snapshots
(`scripts/sync-events.mjs`) consome a API pública de overrides e aplica os metadados estendidos
diretamente nos eventos antes de gerar os arquivos estáticos. O frontend lê o snapshot já mesclado
em `/events/index.json` e `/events/<source>/<sourceId>/<id>.json`.

> **Histórico:** até 2026-07 os overrides viviam em arquivos `.override.json` no repositório
> (GitHub-as-Database pattern), versionados por PRs auto-mergeados. A complexidade operacional
> desse fluxo levou à migração para persistência em banco + API própria.

---

## Visão Geral

Os eventos da Codaqui vêm de fontes externas (Discord, Meetup, OCGroups/CNCF, Sympla) via snapshots JSON gerados automaticamente.
O **Event Organizer** é um membro confiável com permissão de sobrescrever campos desses eventos
(título, imagem, descrição, localização, tags, palestrantes, carga horária).

A correção é salva no banco de dados via API REST (`/events/overrides`). O sync de snapshots
(`scripts/sync-events.mjs`) consome a API pública de overrides e aplica os metadados estendidos
diretamente nos eventos antes de gerar os arquivos estáticos. O frontend lê o snapshot já mesclado
em `/events/index.json` e `/events/<source>/<sourceId>/<id>.json`.

> **Histórico:** até 2026-07 os overrides viviam em arquivos `.override.json` no repositório
> (GitHub-as-Database pattern), versionados por PRs auto-mergeados. A complexidade operacional
> desse fluxo levou à migração para persistência em banco + API própria.

---

## Fase 2 — Plataforma de Gestão de Eventos

> **Status:** Fases 2a–2d **IMPLEMENTADAS** (2026-07), aguardando revisão/deploy; 2e (Real
> Network) continua plano futuro. Os desvios e as decisões reais vs. este desenho estão na
> seção **"Registro de Implementação (2026-07)"** ao final do documento.
> Itens marcados com ⤴ dependem da Fase 1 (overrides + migração multi-role).

Além dos overrides de metadados, o plano evolui para uma **plataforma de gestão de eventos completa**,
tanto para eventos próprios da Codaqui (source `internal` — tipo já previsto em `EventSourceType`
em `src/data/events.ts`) quanto para eventos externos parceiros.

### Princípios

1. **Soberania sobre os eventos próprios** — a Codaqui visa **substituir** as plataformas
   externas e ser a fonte de verdade dos eventos que organiza diretamente. Quando a parceria
   impede a substituição (comunidade já consolidada no Meetup/Sympla), mantemos uma **cópia
   atualizada dos dados** na plataforma (snapshots + importação de participantes).
2. **Reuso com KISS** — o desenho reutiliza deliberadamente o que já existe, sem fluxos
   paralelos:
   - Stripe Checkout + webhook (`backend/src/stripe/`, metadata `entityType` já é o discriminador);
   - Ledger (`getOrCreateCommunityAccount(projectKey)` + `recordTransaction(...)`);
   - Padrão de módulo do `companies` (entidade + tracking + `@Cron` via `@nestjs/schedule`);
   - `GitHubDBService` ⤴ para qualquer escrita no repositório.
3. **Todo dinheiro passa pelo ledger** com `referenceId` prefixado, como os demais módulos.
   Consequência: **todo evento — interno ou externo — é associado a uma comunidade**
   (`communityProjectKey` obrigatório em `managed_events` e em `external_event_activations`),
   que é a conta destino da receita.
4. **LGPD/opt-in** em toda comunicação com participantes.
5. **Listagem pública continua 100% estática** — eventos próprios entram no pipeline de
   snapshots como mais uma fonte (`internal:codaqui`), sem exigir backend no caminho de leitura.
   ⚠️ O snapshot funciona como "cache" do backend: ótimo para leitura, mas exige cuidado com a
   defasagem — o sync roda de hora em hora, então um evento recém-publicado pode levar até 1h
   para aparecer na listagem (aceitável; se frescor virar problema, a página de detalhe pode
   consultar o backend direto).

### Roadmap em sub-fases

| Sub-fase | Escopo | Depende de |
|---|---|---|
| **2a — Fundação** | Migração multi-role ⤴, módulo `events` no backend, CRUD de eventos próprios, staff por evento, inscrições gratuitas (RSVP interno), snapshot `internal:codaqui` na listagem | Fase 1 |
| **2b — Ingressos pagos** | Tipos de ingresso e lotes, checkout Stripe, ledger + comprovante, refunds, controle anti-oversell | 2a |
| **2c — Check-in e comunicação** | QR code por inscrição, endpoint de check-in (role `event_checker`), e-mails transacionais (confirmação, lembrete D-1) | 2b |
| **2d — Externos à la carte + relatórios** | Ativação de features por evento externo (check-in, certificados, pagamentos), importação CSV de participantes, sync automático oportunista por fonte, relatórios | 2c |
| **2e — Real Network** | Networking/matchmaking entre participantes | 2d — longo prazo |

### Papéis e permissões

Novos valores no enum `MemberRole` (além de `event_organizer` da Fase 1):
`event_finance`, `event_host`, `event_checker`. **Pré-requisito ⤴:** a coluna
`Member.role` foi migrada para `roles text[]` (migration 010) e o `RolesGuard` usa
`user.roles.includes(requiredRole)`. Um mesmo membro acumula papéis
(ex.: `['membro', 'event_organizer', 'event_checker']`).

#### Mapa de papéis e habilidades

| Papel | Escopo | Quem atribui | Habilidades |
|---|---|---|---|
| `admin` | Global | Bootstrap / outro admin | Tudo: CRUD de eventos, todos os overrides, todas as ativações, todos os check-ins, relatórios financeiros, reembolsos, configuração de ownership. |
| `event_organizer` | Global + ownership de eventos externos + staff por evento próprio | Admin | Criar/editar/publicar eventos próprios; gerenciar tipos de ingresso e lotes; criar overrides de eventos externos que possui (ou todos, se admin delegar); ativar features (`checkin`, `certificates`, `payments`) em eventos externos que possui; gerenciar staff (`event_host`/`event_checker`) dos eventos próprios; ver relatórios e caixa do evento; lançar despesas/reembolsos vinculados ao evento. |
| `event_finance` | Global | Admin | Ver relatórios financeiros de todos os eventos; aprovar/rejeitar/pagar reembolsos de eventos; exportar CSV de pedidos/participantes; ver caixa consolidado. |
| `event_host` | Por evento (tabela `event_staff`) | Organizer/admin do evento | Editar metadados do próprio evento; ver lista de inscritos e pedidos; fazer check-in manual (lista + busca); emitir/ver certificados; lançar despesa do evento. |
| `event_checker` | Por evento (tabela `event_staff`) | Organizer/admin do evento | **Apenas check-in**: ler QR code e fazer busca manual por nome/e-mail. **Não** vê lista completa de inscritos, **não** vê valores financeiros, **não** edita o evento. |
| `membro` | Global | Automático no cadastro | Ver eventos públicos; comprar/reservar ingressos; ver próprias inscrições; emitir próprio certificado; ver histórico público de participações. |

> **Regra de ouro para eventos externos:** o ownership é definido em
> `static/events/organizers.json` (escopo exato `<sourceKey>:<eventId>` ou wildcard
> `<sourceKey>:*`). Um `event_organizer` só ativa features ou edita override de eventos
> que possui, a menos que também seja `admin`.
>
> **Regra de ouro para eventos próprios:** as permissões por evento usam a tabela
> `event_staff` (Postgres). O arquivo `organizers.json` não escala para permissões criadas
> em runtime.
>
> **Herança:** `admin` e `event_organizer` são papéis globais que já incluem as
> permissões de `event_host` sobre qualquer evento. `event_host` e `event_checker` são
> delegações pontuais feitas pelo organizer/admin dentro de cada evento próprio.

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
  @Column({ nullable: true }) memberId: string | null; // checkout exige login (decisão #2); nullable só por defensividade
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
  status: RegistrationStatus;                          // confirmed | pending_match | cancelled | refunded | waitlist
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

> **Generalização para eventos externos (2d):** `event_registrations`, `event_orders` e
> `ticket_types` passam a referenciar o evento por `managedEventId` (FK nullable) **ou**
> `externalActivationId` (FK nullable) — CHECK constraint garante exatamente um preenchido.
> `event_registrations` ganha ainda `externalSource`/`externalId` para dedupe de importações.
> Ver entidade `external_event_activations` na seção 2d.

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

`POST /events/:id/register` com `JwtAuthGuard` — **conta no site é obrigatória para se inscrever
e para fazer check-in** (decisão de design #2). Não há RSVP de guest: a identidade do
participante é sempre um `Member`, o que habilita match de CSV, certificados e histórico no
perfil. Retorna a `EventRegistration` com `checkinToken`. Regras:

- Respeita `capacity` do evento e quota do `ticket_type` free (mesma reserva atômica do 2b);
- E-mail de confirmação entra só na 2c — na 2a a confirmação é na tela (token visível ao inscrito);
- Cancelamento self-service via `DELETE /events/registrations/:id` (dono ou staff).

### Ingressos pagos via Stripe (2b)

Reutiliza o fluxo existente de doações em vez de criar um paralelo:

1. Frontend chama `POST /events/:id/checkout` (`JwtAuthGuard` — ingresso pago exige identidade
   para o check-in; decisão de design #2) com `{ ticketTypeId, quantity }`.
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
3. Cria a sessão via `StripeService.createEventTicketCheckoutSession` com metadata estendida:
   `{ entityType: 'event-ticket', eventId, orderId, communityId: event.communityProjectKey }`.
   O endpoint suporta `uiMode: 'hosted'` (redireciona para Stripe) ou `'embedded_page'`
   (retorna `clientSecret` para renderizar dentro da página do evento).
4. Webhook `checkout.session.completed` (handler já existente em
   `backend/src/stripe/stripe.service.ts:220`) ganha um branch para `entityType === 'event-ticket'`:
   marca order `paid`, gera as `EventRegistration` (uma por ingresso, com `checkinToken` próprio)
   e registra no ledger.
5. **Cron** (padrão `@Cron` do módulo `companies`) a cada 5 min expira orders `pending`
   vencidas e devolve a quota.
6. Refund via `charge.refunded` (já tratado): order → `refunded`, registrations → `refunded`,
   quota devolvida. **Conformidade legal (BR):** a política de reembolso precisa seguir a
   legislação de eventos no Brasil — CDC art. 49 (arrependimento em até 7 dias corridos para
   compra online), regras de cancelamento/adiamento do evento — e ser exibida com clareza:
   **termos de compra e política de reembolso aceitos no checkout**, com a versão do termo
   registrada na order. Para compra multi-ingresso, usar **refund parcial do Stripe**
   (`refunds.create` com `amount`), cancelando registrations individuais.

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

⚠️ **O backend não tem módulo de e-mail hoje** (nenhum mailer/SES/Resend no código). Decisão de
design #1: **SMTP via Gmail** (volume baixo hoje) atrás de um `backend/src/notifications/` com
provider configurável — migrar para SES/Resend no futuro é trocar só o adapter.

Todo envio é registrado em `email_logs` (destinatário, template, evento, status, erro,
timestamp) alimentando o **painel de e-mails enviados + analytics** (`/admin/emails`):
enviados/falhas por template e por evento, com reenvio manual de falhas.

| Template | Gatilho | Opt-in |
|---|---|---|
| Confirmação de inscrição (com QR) | order `paid` / RSVP confirmado | transacional (não precisa) |
| Lembrete D-1 | cron diário (padrão `companies`) | transacional |
| Pós-evento (agradecimento, pesquisa) | conclusão do evento | **opt-in obrigatório** |

> Certificados **não** vão por e-mail — ver seção seguinte.

### Certificados sob demanda (2c)

Mesmo sistema dos **comprovantes financeiros**: dados no backend, renderização/impressão no
frontend, gerado sob demanda — sem PDF armazenado, sem envio de e-mail.

- `GET /events/registrations/:id/certificate` — dono da inscrição, somente com presença
  confirmada (`checkedInAt IS NOT NULL`); retorna JSON (nome, evento, data, carga horária,
  código de verificação derivado do `checkinToken`).
- **Perfil público do membro** ganha o painel **"Histórico de eventos"** (mesmo espírito da
  página de transparência): eventos inscritos/presentes e botão **"Emitir certificado"** por
  evento, com verificação pública do código.
- Opt-in de dados: o nome exibido é o do perfil do membro, que controla se o histórico é
  público.

### Participantes: externos (CSV à la carte) vs internos (sync nativo) (2d)

A sincronização de participantes é **assimétrica por design**, por limitação das plataformas
parceiras. Nem toda fonte externa expõe API de RSVP, e quando expõe exige credenciais do
organizador/produtor. Por isso adotamos duas velocidades:

| | Eventos **internos** (`internal:*`) | Eventos **externos** (ativados) |
|---|---|---|
| Inscrições | Nativas na plataforma (RSVP gratuito + Stripe checkout) | **Importadas via CSV** pelo organizador; auto-sync onde a API permitir |
| Features | Plataforma completa, sempre habilitada | **À la carte por evento**: check-in, certificados, pagamentos |
| Fonte de verdade | Postgres + snapshots estáticos | Snapshot estático (metadados) + Postgres (ativação, participantes, pedidos) |

#### Regras do modelo assimétrico

1. **Eventos internos:** toda inscrição nasce na plataforma. Não há importação CSV — o próprio
   fluxo de `register` (gratuito) ou `checkout` (pago) cria `EventRegistration` vinculada a um
   `Member`. O sync automático é o snapshot `internal:codaqui`, que exporta metadados para
   `static/events/` a cada hora.
2. **Eventos externos ativados:** os metadados continuam vindo do snapshot da fonte original,
   mas o organizador cria uma **ativação** (`external_event_activations`) no Postgres para
   habilitar features. A lista de participantes é importada via CSV pelo organizador.
3. **Match obrigatório:** toda linha do CSV passa por `findMemberByIdentifier`, que casa por
   `email` (primário ou `secondaryEmails`) ou `githubHandle`. Sem match a inscrição fica
   `pending_match` e é sinalizada ao organizador. O participante cria conta no site e o match
   é refeito automaticamente no cadastro ou manualmente via `rematch`.
4. **Auto-sync oportunista:** quando a API da fonte permitir (Discord bot token é o caso mais
   viável), o backend pode sincronizar participantes automaticamente no mesmo modelo de
   `EventRegistration` com `externalSource`/`externalId`. Isso é um **bônus**, não baseline.
5. **Exportação para a fonte original:** não é suportada. A plataforma é leitura/ingresso
   próprio; o organizador continua usando a ferramenta original para divulgação e, quando
   necessário, exporta o CSV dela para importar aqui.

#### Ativação de features em evento externo

Eventos externos não existem no Postgres (são snapshots estáticos). Para habilitar features de
gestão, o **owner do evento** (conforme `organizers.json` ⤴) ou um admin cria uma **ativação** —
uma "sombra" do evento externo no banco:

```typescript
// external_event_activations — sombra no Postgres de um evento externo
@Entity('external_event_activations')
export class ExternalEventActivation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) eventKey: string;  // "<sourceKey>:<eventId>" — ex: "sympla:elasnocodigo:3321444"
  @Column({ type: 'text', array: true, default: '{}' })
  features: string[];                           // subconjunto de ['checkin', 'certificates', 'payments']
  @Column() communityProjectKey: string;        // conta ledger da comunidade organizadora (sempre obrigatório — princípio 3)
  @Column() enabledByMemberId: string;
  @CreateDateColumn() createdAt: Date;
}
```

Comportamento por feature em evento externo:

| Feature | Como funciona |
|---|---|
| `checkin` | Mesmo endpoint/QR da 2c. Participantes vêm do CSV importado; cada linha gera `checkinToken`. Entrega dos QR codes: download de CSV/PDF pelo organizador ou envio por e-mail (2c implementada) |
| `certificates` | Exige presença confirmada (check-in) + match com conta no site. Emissão sob demanda no perfil do membro (sem e-mail) |
| `payments` | A Codaqui vende ingressos do evento externo pelo próprio Stripe (ex.: comunidade quer cobrar fora da Sympla). `ticket_types` ligados à ativação; receita na conta `communityProjectKey`. Reconciliação com a lista da fonte via CSV (dedupe por e-mail) |

> Overrides (metadados no repositório) e ativação (participantes/features no Postgres) são
> **ortogonais**: um evento externo pode ter override sem ativação, ativação sem override,
> ou ambos.

#### Importação CSV de participantes

`POST /events/external/:eventKey/participants/import` (owner do evento ⤴ ou admin):

- **Formato canônico:** UTF-8, header obrigatório `name,email,ticket_type,external_id,github`
  (separador `;` ou `,` detectado automaticamente; `ticket_type`, `external_id` e `github` opcionais);
- **Pipeline:** parse → validação linha a linha (e-mail válido, nome presente) → **match com
  conta no site** (por e-mail da conta ou `githubHandle`) → dedupe → cria `EventRegistration`
  com `orderId: null`, `externalSource` + `externalId`, `memberId` (quando matched) e
  `checkinToken` novo;
- **Match obrigatório para check-in:** linhas sem match ficam com `memberId: null` e
  `status: pending_match`, sinalizadas **imediatamente ao organizador** no relatório de
  importação e na lista de participantes. O participante cria a conta no site e o match é
  refeito por e-mail — sob demanda via `POST /events/external/:eventKey/participants/rematch`
  ou automaticamente quando o membro se cadastra;
- **Idempotente:** re-upload do mesmo CSV não duplica — dedupe por `(externalSource, externalId)`
  ou, na ausência de `external_id`, por e-mail normalizado;
- **Retorno:** relatório `{ imported, matched, unmatched: [{ line, email }], skippedDuplicates, errors: [{ line, reason }] }`;
- **Limite:** 5 MB / 10 mil linhas por upload (eventos maiores: múltiplos uploads).

O mesmo endpoint serve para **reconciliação** quando `payments` está ativo: o CSV exportado da
fonte original (Sympla/Meetup) marca na plataforma quem se inscreveu/pagou por fora.

#### Sync automático por API — bônus oportunista

Onde a API da fonte permitir, a importação CSV é complementada por sync automático (mesmo
destino: `EventRegistration` com `externalSource`/`externalId`, mesmo dedupe):

| Fonte | API de RSVP/participantes | Viabilidade |
|---|---|---|
| Discord | `GET /guilds/{guildId}/scheduled-events/{eventId}/users` (bot token) | ✅ Alta — já usamos `DISCORD_BOT_TOKEN` no sync de eventos |
| Sympla | API de participantes por evento (token do produtor) | 🟡 Média — depende de credencial de cada comunidade parceira |
| Meetup | RSVP via API exige OAuth do organizador | 🟡 Média — depende de credencial do DevParaná |
| OCGroups/Bevy | Sem API pública documentada de RSVP | ❌ Baixa — CSV permanece o caminho |

Exportação (plataforma → fonte) só onde a API permitir escrita; **não é pré-requisito** de
nenhuma sub-fase.

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
| `POST` | `/events/:id/register` | JwtAuthGuard | Inscrição gratuita (conta obrigatória) |
| `DELETE` | `/events/registrations/:id` | Dono ou staff | Cancela inscrição |
| `POST` | `/events/:id/checkout` | JwtAuthGuard | Checkout de ingressos pagos |
| `GET` | `/events/my-registrations` | JwtAuthGuard | Minhas inscrições + QR token |
| `POST` | `/events/:id/checkin` | event_checker / staff | Check-in por token (idempotente) |
| `GET` | `/events/:id/report` | event_organizer, event_finance | Relatório do evento |
| `GET` | `/events/orders/:id/receipt` | Dono ou event_finance | Comprovante da compra |
| `GET` | `/events/registrations/:id/certificate` | Dono (presença confirmada) | Dados do certificado (sob demanda) |
| `POST` | `/events/:id/reimbursements` | Organizer/admin/staff do evento | Lança reembolso/despesa vinculada ao evento próprio |
| `POST` | `/events/external/:eventKey/reimbursements` | Owner/ativador/admin do evento externo | Lança reembolso/despesa vinculada ao evento externo |
| `POST` | `/events/external/:eventKey/activate` | Owner do evento ⤴ ou admin | Ativa features à la carte no evento externo |
| `POST` | `/events/external/:eventKey/participants/import` | Owner ou admin | Importa CSV de participantes (idempotente, com match) |
| `POST` | `/events/external/:eventKey/participants/rematch` | Owner ou admin | Refaz match de participantes `pending_match` |
| `GET` | `/events/external/:eventKey/participants` | Owner, event_finance | Lista participantes importados |
| `GET` | `/notifications/emails` | admin | Painel de e-mails enviados + analytics |

### Frontend da Fase 2

- `src/pages/admin/eventos.tsx` — CRUD de eventos próprios, tipos de ingresso, staff (segue o
  padrão de tela admin: guarda `useEffect([isLoggedIn])`, `authFetch`, `parseAuthJson`).
- `src/pages/admin/eventos-checkin.tsx` — tela de check-in mobile-first (câmera + fallback manual).
- `src/pages/admin/emails.tsx` — painel de e-mails enviados + analytics (2c).
- Perfil público do membro — painel **"Histórico de eventos"** com emissão de certificado sob
  demanda (espelha o padrão da página de transparência).
- Página pública do evento próprio — detalhe com formulário de inscrição/checkout embutido.
- `src/utils/transaction.tsx` — adicionar `event-ticket` ao `TX_TYPE_CONFIG` (transparência).

### Decisões de design (registradas em 2026-07)

1. **E-mail (2c):** SMTP via **Gmail** (volume baixo hoje), atrás de adapter configurável.
   Obrigatório: `email_logs` + painel `/admin/emails` com analytics (enviados, falhas, por
   template/evento) e reenvio manual de falhas.
2. **Inscrição e check-in exigem conta no site** — não há guest. O match de participantes
   importados via CSV é feito por e-mail da conta ou `githubHandle`; linhas sem match ficam
   `pending_match` e são sinalizadas imediatamente ao organizador.
3. **Receita na conta da comunidade organizadora** do evento (`communityProjectKey`
   obrigatório, interno ou externo) — com **filtro por evento** obrigatório nos relatórios e na
   transparência (drill-down por `referenceId` + `description`).
4. **Certificados:** mesmo sistema dos comprovantes financeiros — **dados no backend, gerados
   sob demanda** (sem PDF armazenado, sem e-mail). Emissão no perfil público do membro
   ("Histórico de eventos"), com opt-in de dados.
5. **Refunds conforme legislação BR de eventos** — CDC art. 49 (7 dias corridos, compra
   online), regras de cancelamento/adiamento. Termos e política de reembolso explícitos,
   aceitos no checkout e versionados na order. Refund parcial do Stripe para multi-ingresso.
   Página dedicada `/termos-de-compra` centraliza o texto legal; o checkout linka para ela.
6. **Checkout embedded** — pagamento de ingressos acontece dentro da página do evento
   (`StripeEmbeddedCheckoutDialog`), sem redirecionar o participante para o Stripe. Fallback
   `hosted` mantido para compatibilidade e ambientes sem a chave pública configurada.
7. **Despesas de evento via reembolso** — toda saída de caixa de um evento (interno ou externo)
   passa pelo módulo de reembolsos e pelo ledger, vinculada ao evento por `eventId` ou
   `externalActivationId`. Reaproveita aprovação do finance-analyzer/admin e a conta da
   comunidade (`communityProjectKey`).
8. **Real Network (2e):** plano futuro, fora de escopo até 2a–2d estáveis.

### Testes da Fase 2

> **Status:** implementados — todos os cenários abaixo estão cobertos por specs
> (580 testes backend verdes em 2026-07-30, mais os testes frontend).

- **Anti-oversell:** N requisições concorrentes disputando 1 vaga → exatamente 1 sucesso;
- **Idempotência de webhook:** mesmo `checkout.session.completed` entregue 2× → 1 order paga,
  1 transação no ledger (espelhar teste de doação existente);
- **Expiração de order:** cron devolve quota de order `pending` vencida;
- **Check-in:** segunda leitura do mesmo token → `already_checked_in` sem erro; token inválido → 404;
- **Multi-role:** após migração ⤴, membro com `['membro','event_checker']` acessa check-in mas
  não relatórios;
- **Snapshot interno:** evento `draft` não aparece em `/events/public/managed`;
- **Importação CSV (2d):** re-upload do mesmo arquivo não duplica participantes (dedupe por
  `(externalSource, externalId)` ou e-mail); linhas inválidas reportadas por número;
- **Ativação externa (2d):** não-owner não ativa features; ativação sem `communityProjectKey` → 400;
- **Match CSV (2d):** linha com e-mail de conta existente → `memberId` preenchido; sem conta →
  `pending_match` e aparece em `unmatched` no relatório; `rematch` resolve após cadastro;
- **Certificado (2c):** sem `checkedInAt` → 403; com presença → JSON com código de verificação.

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

> ✅ **`MemberRole` já foi migrado para `roles text[]`** (migration 010). Um membro pode
> acumular papéis (`['membro', 'event_organizer', 'event_checker']`) sem sobrescrever
> `admin`/`finance-analyzer`. O `RolesGuard` usa `user.roles.includes(requiredRole)`.
>
> O snippet abaixo permanece como referência do schema atual:

```typescript
// backend/src/members/entities/member.entity.ts
export enum MemberRole {
  MEMBRO           = 'membro',
  EVENT_ORGANIZER  = 'event_organizer',
  FINANCE_ANALYZER = 'finance-analyzer',
  ADMIN            = 'admin',
}

@Column({ type: 'text', array: true, default: () => "ARRAY['membro']::text[]" })
roles: MemberRole[];   // ex: ['membro'], ['admin'], ['membro','event_organizer']
```

> Atribuição/remoção de roles: somente um `admin` pode fazer.

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

Overrides são armazenados na tabela `event_overrides`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `sourceKey` | `varchar` | `"<source>:<sourceId>"` |
| `eventId` | `varchar` | Identificador do evento na fonte |
| `ownerMemberId` | `varchar` | FK para `members.id` |
| `ownerHandle` | `varchar` | Handle GitHub (denormalizado) |
| `payload` | `text` | JSON do `extendData` |
| `reason` | `varchar` | Motivo da última edição |
| `createdByMemberId` | `varchar` | Audit |
| `updatedByMemberId` | `varchar` | Audit |
| `createdAt` | `timestamptz` | Audit |
| `updatedAt` | `timestamptz` | Audit |

Índice único: `(sourceKey, eventId)`.

Exemplo de `payload` (JSON):

```json
{
  "extendData": {
    "imageUrl": "https://res.cloudinary.com/...",
    "summary": "Resumo corrigido pelo organizador.",
    "location": "Nome correto do local",
    "tags": ["meetup", "devparana", "presencial", "mobile"],
    "featured": true,
    "workloadMinutes": 300
  }
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

## CRUD de Overrides (API REST)

Toda operação de override — criar, atualizar ou deletar — é feita via API REST
protegida por JWT e ownership (`organizers.json`). Não há mais branch/PR: a
mudança é persistida imediatamente no banco.

| Operação | Método | Rota | Auth | Descrição |
|---|---|---|---|---|
| **Create** | `POST` | `/events/overrides` | `event_organizer` / `admin` | Cria override |
| **Read** | `GET` | `/events/overrides/:sourceKey/:eventId` | Público | Retorna override atual |
| **Read (bulk)** | `GET` | `/events/overrides/public` | Público | Lista todos os overrides (sync) |
| **Update** | `PUT` | `/events/overrides/:sourceKey/:eventId` | `event_organizer` / `admin` | Atualiza override |
| **Delete** | `DELETE` | `/events/overrides/:sourceKey/:eventId` | `event_organizer` / `admin` | Remove override |

### Body

```json
{
  "sourceKey": "meetup:devparana",
  "eventId": "226163759",
  "payload": {
    "extendData": {
      "summary": "Resumo corrigido",
      "featured": true
    }
  },
  "reason": "Corrigindo titulo"
}
```

### Fluxo

1. `event_organizer` autenticado acessa `/admin/overrides`
2. Seleciona o evento e preenche o formulário
3. Clica em "Salvar" → backend valida campos e permissões (`assertCanManage`) e persiste na tabela
4. O frontend vê o override na próxima requisição (ou após o próximo sync de snapshots)

### Permissão

- `admin` pode editar qualquer override
- `event_organizer` precisa de ownership no `organizers.json` para o `sourceKey`/`eventId`

---

## Merge de Dados: Base + Override (snapshots)

O sync (`scripts/sync-events.mjs`) busca todos os overrides em `GET /events/overrides/public`
e aplica o `extendData` sobre cada evento antes de gravar os snapshots:

```typescript
function applyOverride(event, override) {
  const extendData = typeof override.payload === "string"
    ? JSON.parse(override.payload)
    : override.payload;
  return {
    ...event,
    ...extendData,
    hasOverride: true,
    _override: {
      ownerHandle: override.ownerHandle,
      updatedAt: override.updatedAt,
      reason: override.reason,
    },
  };
}
```

O frontend lê o snapshot já mesclado. A função `loadEventWithOverride` extrai o
`_override` do evento para exibir o badge:

```typescript
export async function loadEventWithOverride(
  source: string,
  sourceId: string,
  eventId: string
): Promise<{ event: EventWithOverride; override: EventOverride | null; source: EventSourceConfig }> {
  const base = await fetchJsonOrNull<EventDetailFile>(`/events/${source}/${sourceId}/${eventId}.json`);
  if (!base) throw new Error(`Evento não encontrado: ${eventId}`);
  const event = base.event as EventWithOverride;
  return {
    event,
    override: event._override ? {
      sourceKey: "",
      eventId,
      payload: {},
      ...event._override,
    } : null,
    source: base.source,
  };
}
```

A página exibe um badge **"Metadados verificados por @handle"** quando `_override` existe.

---

## Backend: Variáveis de Ambiente

Overrides não exigem mais variáveis de GitHub-as-Database. As envs abaixo continuam
necessárias apenas para o force-sync do snapshot internal (que ainda usa
`GitHubDBService` para abrir PR multi-arquivo):

```
# .env.example — modelo atual:
GITHUB_REPO_OWNER=codaqui
GITHUB_REPO_NAME=institucional

# Criptografia em repouso dos tokens OAuth dos membros (AES-256-GCM, 32 bytes
# em hex ou base64). OBRIGATÓRIA em produção; em dev, sem ela, os tokens são
# gravados com prefixo `plain:` (fallback documentado).
GITHUB_TOKEN_ENCRYPTION_KEY=
```

### Endpoints do módulo `event-overrides`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/overrides` | Admin | Lista overrides por `sourceKey` |
| `GET` | `/events/overrides/public` | Público | Lista todos os overrides (sync) |
| `POST` | `/events/overrides` | `event_organizer` / `admin` | Cria override |
| `GET` | `/events/overrides/:sourceKey/:eventId` | Público | Retorna override atual |
| `PUT` | `/events/overrides/:sourceKey/:eventId` | `event_organizer` / `admin` | Atualiza override |
| `DELETE` | `/events/overrides/:sourceKey/:eventId` | `event_organizer` / `admin` | Remove override |

### Endpoints do módulo `event-organizer` (ownership)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/organizers` | Admin | Lista mapeamento de ownership |
| `POST` | `/events/organizers` | Admin | Atribui eventos a um organizer (abre PR) |
| `DELETE` | `/events/organizers/:memberId` | Admin | Remove ownership (abre PR) |

> Ownership continua em `static/events/organizers.json` (PR + review manual) por
> enquanto, pois envolve delegação de permissões sensíveis.

---

## Padrão Reutilizável: GitHub-as-Database

> **Escopo reduzido (2026-07-31):** o GitHub-as-Database continua sendo usado
> apenas para o force-sync do snapshot `internal:codaqui` (`POST /events/internal/snapshot`)
> e para edições de `organizers.json` (ownership). Overrides de eventos migraram para
> o banco PostgreSQL via `/events/overrides`.

### Biblioteca interna: `GitHubDBService`

```typescript
// backend/src/github-db/github-db.service.ts
@Injectable()
export class GitHubDBService {
  /**
   * Cria uma branch, commita a mudança e abre um PR.
   * Escreve com o token OAuth do membro (userToken): branch no repo canônico
   * se ele é colaborador (admin/maintain/write); senão fork flow
   * (fork automático + poll, PR com head "<actorHandle>:<branch>").
   * O commit sai em nome do membro; o workflow do Actions auto-mergeia.
   */
  async createPRWithFile(opts: {
    branch: string;         // nome da branch (ex: "event-override/meetup-devparana-123-ts")
    path: string;           // caminho do arquivo no repositório
    content: string;        // conteúdo em UTF-8
    commitMessage: string;  // "event: override <eventId> by @<actorHandle> — <reason>"
    prTitle: string;        // título do PR
    actorHandle: string;    // handle GitHub do membro (autor do commit)
    userToken: string;      // token OAuth do membro (scope public_repo)
    labels?: string[];      // ex.: ["event-override"]
  }): Promise<{ prNumber: number; prUrl: string }>;

  /** Lê arquivo de `main` via raw.githubusercontent.com (público, sem token) */
  async readFile(path: string): Promise<string | null>;

  /**
   * Cria branch + PR de delete (remove o arquivo override).
   * Mesmo fluxo: o workflow valida que só *.override.json foi removido e auto-mergeia.
   */
  async createPRDeleteFile(opts: {
    branch: string;
    path: string;
    commitMessage: string;
    prTitle: string;
    actorHandle: string;
    userToken: string;
    labels?: string[];
  }): Promise<{ prNumber: number; prUrl: string }>;

  /** Retorna o PR aberto para uma branch (útil para polling de status) */
  async getPRForBranch(
    branch: string,
    userToken: string,
    headOwner?: string, // handle do membro quando o PR veio de um fork
  ): Promise<{ number: number; state: string; mergedAt: string | null; prUrl: string } | null>;

  /**
   * Versão multi-arquivo (2026-07-29): N arquivos em UM PR — commits contents
   * sequenciais na mesma branch (PUT create/update; DELETE quando content é
   * null) e um único PR no final. Usada pelo force-sync internal.
   */
  async createPRWithFiles(opts: {
    branch: string;
    files: Array<{ path: string; content: string | null }>; // null = delete
    commitMessage: string;
    prTitle: string;
    actorHandle: string;
    userToken: string;
    labels?: string[];
  }): Promise<{ prNumber: number; prUrl: string }>;

  /** Lista arquivos de um diretório na branch base (404 → null) */
  async listDir(path: string, userToken: string): Promise<Array<{ name: string; path: string }> | null>;

  /** Histórico de commits de um arquivo (token opcional — repo público; [] quando vazio) */
  async getFileHistory(path: string, userToken?: string | null): Promise<FileHistoryEntry[]>;
}
```

> 401/403 do GitHub na escrita → 403 com orientação de re-login (token expirado ou
> login anterior ao scope `public_repo`). Nunca há `commitFile()` direto na branch base
> — todo write passa por branch + PR.
>
> **Branch base configurável (2026-07-29):** env `GITHUB_BASE_BRANCH` (default `main`;
> `develop` em dev). Afeta `readFile` (raw), a base dos PRs e a ref de criação de branch.

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

## Diretrizes de UI/UX para organizadores

A experiência do organizador deve ser centralizada: um único hub de eventos, com ações
contextuais por evento, em vez de páginas dispersas. As funcionalidades hoje estão divididas
entre `/admin/eventos` (eventos próprios) e `/admin/overrides` (externos + ativações); o
objetivo de curto prazo é unificar a navegação mental do organizer sob o menu **Eventos**.

### Hub unificado de eventos

- **Menu principal:** `Eventos` → sub-menu `Gerenciar eventos`.
- **Tela `/admin/eventos`:** lista **todos** os eventos (próprios + externos ativados),
  paginados, com filtros por:
  - Tipo: próprio / externo com override / externo ativado / todos;
  - Status: draft / published / completed / canceled;
  - Fonte (sourceKey);
  - Features ativas (check-in, certificados, pagamentos);
  - Eventos que eu gerencio (owner/staff).
- **Card/linha do evento:** mostra título, data, fonte, badge de override, features ativas,
  contadores rápidos (inscritos, pedidos, check-ins, receita).
- **Ações por evento (contextuais):**
  - Ver página pública;
  - Editar metadados / override (deep-link para `/admin/overrides`);
  - Gerenciar features/plugins (check-in, certificados, pagamentos);
  - Gerenciar tipos de ingresso (próprio ou externo com `payments`);
  - Ver pedidos / participantes;
  - Check-in;
  - Lançar despesa/reembolso vinculado ao evento;
  - Relatório / caixa do evento.

### Plugins/features por evento

Cada evento tem uma tela de "Gestão de features" onde o organizer ativa/desativa plugins.
A ativação de um evento externo cria a sombra `external_event_activations`; para eventos
próprios os plugins já estão sempre disponíveis.

| Plugin | Quem ativa | O que abre | Notas |
|---|---|---|---|
| `checkin` | admin / event_organizer / owner do externo | Tela de check-in (scanner + lista) | Pré-requisito para `certificates` |
| `certificates` | admin / event_organizer / owner do externo | Emissão de certificados após check-in | Ativação automática também habilita `checkin` |
| `payments` | admin / event_organizer / owner do externo | Tipos de ingresso, pedidos, reembolsos | Receita vai para `communityProjectKey` da ativação |

> O plugin `certificates` implica `checkin` (não faz sentido certificar sem presença).
> A quantidade de horas-aula do certificado vem do campo `workloadMinutes` no override
> (`extendData.workloadMinutes`, 0–1000) para eventos externos, e de `endAt - startAt` para
> eventos internos.

### Gerenciamento de tipos de ingresso (lotes)

- Cada tipo de ingresso tem janela de venda (`salesStartAt`/`salesEndAt`), quota total,
  quota vendida, preço (`free` = 0), `maxPerOrder` e flag `isActive`.
- A UI deve exibir claramente quando um lote está "indisponível ainda" (antes da data) ou
  "esgotado" (quota esgotada), com a data/hora de abertura visível.
- É possível desativar um lote aberto sem cancelar as vendas já feitas.
- Reembolsos parciais: o organizer seleciona quais registrations serão reembolsadas; o Stripe
  devolve o valor proporcional.

### Pedidos e participantes

- A tela de pedidos (`EventOrdersDialog`) mostra: comprador, tipo de ingresso, quantidade,
  total, status, data de pagamento e ações (reembolso, ver comprovante).
- A tela de participantes (para eventos externos ativados) mostra: nome, e-mail, status
  (`confirmed`/`pending_match`), tipo de ingresso, check-in e ações (rematch manual).
- Para eventos próprios, a lista de participantes é a união de registrations de RSVP gratuito
  + registrations geradas a partir de orders pagas.

### Busca em dropdowns

Dropdowns de seleção de membros/eventos devem usar **autocomplete com busca** (nunca dropdown
com todos os itens):
- Seleção de organizador: busca por nome/handle/e-mail (`GET /events/staff-candidates?query=`);
- Seleção de evento para override/ativação: busca por título/sourceKey
  (`src/lib/events-api.ts` — index.json + overrides-index.json mergeados).

### Após criar um evento

Ao salvar um evento próprio, o sistema deve:
1. Exibir toast de sucesso;
2. Oferecer link direto "Ver página do evento";
3. Oferecer link "Publicar evento" (se ainda estiver draft);
4. Oferecer link "Criar primeiro lote de ingressos";
5. Exibir aviso: "O evento aparecerá na listagem pública após o próximo sync (ou force-sync)."

### Página pública de detalhe

- Banner hero com `imageUrl` (fallback: gradiente com emoji da fonte);
- Badge "Verificado por @handle" quando override existe;
- Botões de CTA claros: para eventos externos, separar **"Site original"** e **"Ver detalhes"**;
- Para eventos próprios ou externos com `payments`: checkout embedded de ingressos dentro da
  página da Codaqui (não redireciona para fora);
- Quando o usuário autenticado tem permissão, exibir ação **"Gerenciar este evento"**
  (deep-link para o hub admin).

### Check-in e funções

- `event_checker` global: só vê o scanner de QR (privacidade máxima).
- Staff `checker` do evento específico: scanner + busca manual mínima.
- `event_host` / `event_organizer` / `admin`: scanner + lista completa + busca + relatório.

### Caixa/financeiro do evento

- Toda entrada de ingresso (`event-ticket:*`) cai na conta da comunidade do evento.
- Toda saída (despesa/reembolso) deve ser lançada via `POST /events/:id/reimbursements`
  ou `POST /events/external/:eventKey/reimbursements`, aprovada por `finance-analyzer`/admin.
- O relatório do evento (`GET /events/:id/report`) agrega receita (orders pagas − refunds),
  despesas aprovadas, saldo e presença.
- A transparência geral (`/transparencia`) inclui KPI global de ingressos vendidos e receita,
  além do drill-down por comunidade.

---

## Testes Necessários

### Backend
- `event-overrides.service.spec.ts` — CRUD, permissões por role/ownership, validação de payload
- `event-overrides.controller.spec.ts` — rotas, guards, respostas públicas
- `organizers.service.spec.ts` — parse de scope glob (`meetup:devparana:*` vs específico)

### Frontend
- `event-override.test.ts` — snapshot já mesclado; `_override` extraído para badge
- `events-api.test.ts` — `fetchEventsIndexMerged` consome `/events/index.json` diretamente
- `EventOverrideBadge.test.tsx` — render condicional
- `EventOverrideHistory.test.tsx` — carrega override atual da API pública

### Scripts
- `scripts/sync-events.mjs` — aplica overrides do backend no snapshot e marca `hasOverride`/`_override`

---

## Checklist de Implementação

> **Status (2026-07-31):** overrides e ownership de organizers migrados para o banco
> PostgreSQL via API REST. GitHub-as-Database continua apenas para force-sync internal:codaqui.

- [x] Migrar `MemberRole` de enum single-value para `text[]` + `RolesGuard` update
- [x] Adicionar `EVENT_ORGANIZER` em `MemberRole` + migration Postgres
- [x] Criar entidade `EventOrganizerOwnership` + migration `Migration021_EventOrganizerOwnership`
- [x] Criar API REST `/events/organizers` (CRUD imediato no PostgreSQL)
- [x] Atualizar `EventOrganizerService` para ler ownership do banco
- [x] Atualizar frontend `admin/eventos` e `admin/overrides` para usar a API de ownership
- [x] Remover `static/events/organizers.json` e lógica de PR para ownership
- [x] Criar entidade `EventOverride` + migration `Migration020_EventOverride`
- [x] Criar `EventOverridesService` e `EventOverridesController` (`/events/overrides`)
- [x] Adicionar endpoint público `GET /events/overrides/public` para o sync
- [x] Adicionar validação de override no backend (campos proibidos, tipos, limites)
- [x] Atualizar `scripts/sync-events.mjs` para buscar overrides do backend e aplicar no snapshot
- [x] Remover geração de `overrides-index.json`
- [x] Remover workflow `.github/workflows/validate-event-overrides.yml`
- [x] Atualizar frontend `admin/overrides` para usar a API REST
- [x] Simplificar `src/lib/events-api.ts` (index.json já vem mesclado)
- [ ] Migrar overrides existentes em `.override.json` para o banco (passo manual)
- [x] Criar `src/utils/event-override.ts` com `loadEventWithOverride()`
- [x] Criar `src/components/EventOverrideBadge/`
- [x] Atualizar página de eventos para usar merge e badge
- [x] Testes unitários (backend + frontend + validate-overrides.mjs)
- [x] Atualizar `AGENTS.md` com novo role e padrão GitHub-as-DB (sempre-PR, sem commit direto)

---

## Registro de Implementação (2026-07)

Fases 1 e 2a–2d implementadas. Esta seção registra os **desvios e decisões reais** em relação
ao desenho acima — em caso de divergência, o que vale é o código + este registro.

### 🔄 Mudança de decisão (2026-07-29): GitHub App → token OAuth do membro

O modelo de escrita no repositório foi **substituído** após a implementação inicial:

- **Antes:** GitHub App `codaqui-bot` (JWT RS256 → installation token) commitava em nome do
  bot; envs `GITHUB_APP_ID` / `GITHUB_APP_INSTALLATION_ID` / `GITHUB_APP_PRIVATE_KEY`.
- **Agora:** o backend escreve com o **token OAuth do próprio membro logado** (o App OAuth
  de login, com scope `public_repo` adicionado). Commits e PRs saem **em nome do membro** —
  o repo é público e queremos a atribuição como contributor, além de eliminar a infra do App.
- **Motivos:** atribuição de contributor no repositório público; menos infra (sem App, sem
  chave privada, sem installation token); o token já existia no fluxo de login.
- **Detalhes:**
  - `members.githubAccessToken` (migration 013) — token criptografado em repouso com
    AES-256-GCM (`v1:`) via `GITHUB_TOKEN_ENCRYPTION_KEY`; em dev sem a env, fallback
    `plain:` documentado. Coluna com `select: false` — nunca exposta em endpoints.
  - O scope novo (`public_repo`) exige **re-consentimento**: aparece automaticamente no
    próximo login de cada usuário; tokens antigos (sem o scope) falham com 403 e a API
    responde orientando re-login.
  - `GitHubDBService`: leituras públicas via `raw.githubusercontent.com` (sem token);
    escritas com o token do membro — colaborador (admin/maintain/write) cria branch no
    canônico; demais membros passam pelo **fork flow** (fork automático + poll, PR com
    `head: "<actor>:<branch>"`).
  - O workflow `validate-event-overrides.yml` deixou de usar
    `actions/create-github-app-token` e usa o `GITHUB_TOKEN` padrão do Actions — a
    aprovação/auto-merge ficam em nome de `github-actions[bot]`.
- As seções do desenho abaixo foram atualizadas para o modelo atual; menções ao App
  permanecem apenas neste registro, como histórico.

### Desvios numerados (implementação original)

1. **Detalhe de evento:** rota única `/eventos/detalhe?source=&sourceId=&id=` (query params —
   Docusaurus não tem catch-all). `loadEventWithOverride` retorna também
   `source: EventSourceConfig`, além de `event` e `override`.
2. **Inscrição vs. checkout:** decidida por `ticketType.kind === 'free'`; os kinds
   `community`/`company` seguem o fluxo de checkout (Stripe).
3. **`scripts/sync-events.mjs`:** `cleanSourceDir` preserva `*.override.json`; o resolver
   `internal:codaqui` é uma etapa extra do pipeline, FORA do `events.config.json`; o validador
   roda sobre a lista de arquivos do PR (detecta PR misto) com `fetch-depth: 0` no checkout;
   validador estendido para `organizers.json`. **(2026-07-30) PRs de organizers.json
   deixaram de ser auto-mergeados** — exigem review manual de mantenedor por
   segurança (ver seção "Regras de segurança para auto-merge").
4. **Backend GitHubDB:** `createPRDeleteFile` aceita `labels?`; `getPRForBranch` e
   `findOpenPRByBranchPrefix` retornam `prUrl`; erros da API do GitHub → 503; envs ausentes →
   503 lazy no primeiro uso (não derruba o boot).
5. **Multi-role:** o bootstrap de admin ADICIONA `admin` ao array de roles (não sobrescreve);
   `stripe.service.ts` não usava `Member.role` (aquela role era de empresa) — não houve
   derivação de papel único no backend.
6. **`EventOrder`:** colunas além do sketch — `ticketTypeId`, `quantity`, `termsVersion`,
   `paidAt`. FKs de `memberId` não foram criadas (defensivo).
7. **Guards cruzados:** register rejeita ticket pago, checkout rejeita ticket grátis;
   `updateTicketType` impede `quantityTotal < quantitySold`; `acceptTerms: true` obrigatório
   no checkout (termos `2026-07-v1`, com checkbox no frontend).
8. **Taxa Stripe (`stripe-fee:*`):** NÃO se aplica a ingressos — o handler localiza a doação
   por `referenceId` com prefixo `stripe-pi:`. Fees de eventos ficam fora do ledger por ora
   (follow-up).
9. **Generalização 2d SEM renomear colunas:** `eventId` nullable + `externalActivationId`
   nullable + CHECK de exatamente-um nas 3 tabelas (`registrations`, `orders`, `ticket_types`).
10. **Receita do relatório:** calculada de `event_orders` (paid − refunded), não de
    `referenceId LIKE` no ledger.
11. **Importação CSV:** ticket types find-or-create `Importado` / `Importado — <ticket_type>`
    (free, quota alta); `certificates` implica `checkin` (auto-adicionado); match por e-mail
    ou `githubHandle` (valor sem '@' é tentado como handle); rematch automático na CRIAÇÃO de
    membro (hook no `MembersService`).
12. **E-mail:** resend atualiza o MESMO log; crons diários com janela (D-1: `startAt` em
    +12h/+36h; pós-evento: fim em −36h/−12h) com dedupe via `email_logs`; confirmação = 1
    e-mail por registration; sem credenciais SMTP → log `failed` com `SMTP_NOT_CONFIGURED`;
    `members.eventCommsOptIn` default `false` (pós-evento só com opt-in; transacionais
    ignoram a flag) — UI de toggle do opt-in PENDENTE.
13. **Painel admin dividido em duas páginas:** `/admin/eventos` (eventos próprios) e
    `/admin/overrides` (overrides + organizers + ativações) — o plano sugeria tudo em
    `/admin/eventos`.
14. **Endpoint extra:** `GET /events/staff-candidates?query=` (organizer não tem acesso a
    `/admin/members`).
15. **Check-in de eventos EXTERNOS** disponível via API (`POST /events/external/:eventKey/checkin`);
    a UI da tela de check-in hoje só lista eventos próprios (follow-up).
16. **`reason` obrigatório na UI** de override (no backend é opcional).
17. **`GET /events/override/:sk/:id/pr`** pode retornar `{ prNumber, prUrl }` ou
    `{ number, url }` — o frontend normaliza.
18. **Migrações criadas:** 010 (roles array), 011 (eventos), 012 (comms + externos), 013
    (token OAuth do membro — ver "Mudança de decisão" acima).
19. **`GITHUB_BASE_BRANCH` (2026-07-29):** branch base do GitHub-as-DB configurável
    (default `main`; em dev `develop`). Causa raiz de 2 bugs: PRs/merges locais iam para
    `develop`, mas o backend lia `main` fixo — overrides não apareciam na pré-carga do
    editor. Aplicado em `readFile` (raw), base dos PRs e ref de criação de branch.
20. **Force-sync internal:** `POST /events/internal/snapshot` [admin | event_organizer]
    regenera a fonte `internal:codaqui` sem esperar o workflow de hora em hora. Decisão:
    **um único PR multi-arquivo** (`createPRWithFiles` — commits contents sequenciais na
    mesma branch + 1 PR; mais simples que Git Trees/Blobs e suficiente para ~dezenas de
    arquivos). O index.json raiz é patcheado (preserva outras fontes, re-ordena ASC por
    `startAt`) e `hasOverride` é recomputado só para internal. Sem eventos publicados E
    sem arquivos no repo → `{ skipped: true }` (não abre PR). O workflow de auto-merge foi
    estendido (2026-07-29): cobre também `static/events/internal/**` e
    `static/events/index.json` (validação estrutural leve no
    `scripts/validate-overrides.mjs`), então os PRs `event-sync/*` **são auto-mergeados**.
21. **`GET /events/override/:sk/:id/history`:** proxy da commits API do GitHub (20 últimos,
    na branch base), com token do membro quando disponível (repo público funciona sem);
    sempre `[]` quando não há commits — nunca 404.
22. **`GET /events/external/activations`:** lista ativações visíveis — admin vê todas;
    demais veem `enabledByMemberId = sub` OU eventKey coberto por ownership (scope exato
    ou `<sourceKey>:*`). Alimenta a tela de check-in de eventos externos.
23. **`make sync-events`:** passa `INTERNAL_EVENTS_API_URL=http://localhost:3001` para a
    fonte internal ser resolvida do backend dev (antes apontava para o frontend :3000 e
    caía sempre no fallback em disco).
24. **CSV ganha coluna opcional `github` (2026-07-29):** o match tenta primeiro o e-mail da
    conta; se não houver conta com esse e-mail, a coluna `github` (handle, com ou sem `@`)
    é usada como alternativa — cobre o caso comum de o e-mail do CSV da plataforma externa
    não ser o e-mail da conta no site. **Healing:** re-upload de uma linha já importada e
    `pending_match` que agora traz `github` com match **vincula a inscrição existente**
    (em vez de só ignorar como duplicado; relatório ganha o contador `healed`). Duplicados
    já confirmados continuam intocados. Rematch manual continua só por e-mail (o handle não
    é persistido). Também corrigido: a lista de participantes do painel lia `name`/`email`
    enquanto a API retorna `attendeeName`/`attendeeEmail`, e passou a exibir o nome do
    tipo de ingresso (`ticketType.name`, enriquecido no endpoint).
25. **Ordem de rotas `/events/*` (2026-07-29):** o ciclo `Members → Events` fazia o
    `EventsModule` ser escaneado antes do `EventOrganizerModule`, e `GET /events/:id`
    capturava `/events/organizers` (400 "uuid is expected"). Fix: `EventOrganizerController`
    registrado dentro do `EventsModule`, antes do `EventsController` (ordem travada no
    array de controllers, com teste de regressão em `events.module.spec.ts`).
26. **Endpoint extra:** `GET /events/override/:sourceKey/:eventId/can-manage` (autenticado)
    → `{ canManage }` — a página pública de detalhe usa para exibir "Editar metadados" /
    "Gerenciar features" (deep-link para `/admin/overrides?tab=&sourceKey=&eventId=`).
27. **Manifesto `static/events/overrides-index.json` (2026-07-29):** o PUT/DELETE de override
    escreve o `.override.json` E o manifesto (`{ version, updatedAt, overrides: { "<sourceKey>:<eventId>": { extendData, ownerHandle, updatedAt } } }`)
    **no mesmo PR** (`createPRWithFiles`). O validador/workflow de auto-merge cobrem o
    manifesto e o `scripts/sync-events.mjs` o regenera dos `.override.json` em disco
    (bootstrap/anti-drift). A leitura pública ficou centralizada na **front API**
    `src/lib/events-api.ts` (`fetchEventsIndexMerged()` — index.json + manifesto, merge por
    `<sourceKey>:<eventId>`, fallback para o modo `hasOverride` legado) usada por `/eventos`
    e pelo hub — resolve a defasagem do flag `hasOverride` no index.json entre syncs.
28. **Multi-emails do membro (2026-07-29):** o login persiste todos os e-mails verificados
    do GitHub (`GET /user/emails`) em `members.secondaryEmails text[]` (migration 014;
    falha da API não quebra o login). O match de participantes (`findMemberByIdentifier`)
    casa por `email` OU qualquer `secondaryEmails` — cobre e-mail público ≠ e-mail primário.
29. **Ingressos de evento EXTERNO (feature `payments`, 2026-07-29):** `GET
    /events/external/:eventKey/ticket-types` (público, 404 sem payments), `GET
    .../ticket-types/manage` + `POST .../ticket-types` + `PATCH /events/external/ticket-types/:id`
    (owner/admin) e `POST /events/external/:eventKey/checkout` (mesma máquina do checkout
    interno; ledger na conta `communityProjectKey` da ativação). `GET /events/my-registrations`
    retorna `activation: { eventKey, title }` para registrations externas. Na UI pública,
    tipos `free` de eventos externos são escondidos (inscrição gratuita segue na plataforma
    original — não há endpoint de register para externos).
30. **Certificado (2026-07-29):** externos emitem com `eventTitle = activation.title`
    (o form de ativação ganhou campo título, pré-preenchido do snapshot), `workloadMinutes`
    vem de `extendData.workloadMinutes` do override (novo campo no schema, 0–1000; internos
    seguem computando de endAt−startAt), datas nulas omitidas. UI: `@media print` imprime só
    o cartão, título em destaque + código menor + QR para a nova página pública
    `/certificado/verificar?codigo=` (consome `GET /events/certificates/verify/:code`).
31. **Histórico público de participações (2026-07-29):** `GET /events/members/:memberId/registrations`
    (público) → `[{ id, eventTitle, eventStartAt, checkedIn, status, verificationCode }]` —
    só `confirmed`/`refunded`, sem checkinToken/e-mail/nome; alimenta a seção "Histórico de
    eventos" do perfil público (`/membros/perfil`).
32. **Checkout embedded de ingressos (2026-07-30):** `CheckoutDto` ganha `uiMode?: 'hosted' |
    'embedded'`; `StripeService.createEventTicketCheckoutSession` suporta `ui_mode: 'embedded_page'`,
    retornando `clientSecret`. A página pública de detalhe (`src/pages/eventos/detalhe.tsx`)
    abre o pagamento em dialog com `<StripeEmbeddedCheckoutDialog>` ao invés de redirecionar
    para fora; fallback para `hosted` preservado. O `return_url` volta para a própria página do
    evento (`/eventos/detalhe?source=...&id=...`).
33. **Página dedicada de termos de compra (2026-07-30):** criada `src/pages/termos-de-compra.md`
    com a política de reembolso (CDC art. 49, cancelamento/adiamento, prazos, meio de
    pagamento). O checkbox dos checkouts (interno e externo) linka para ela; o texto inline
    continua como resumo, mas a fonte de verdade vive na página dedicada.
34. **Despesa/reembolso vinculada a evento (2026-07-30):** extensão do módulo existente de
    reembolsos. `ReimbursementRequest` ganha `eventId` (UUID), `externalActivationId` (UUID) e
    `eventMetadata` (JSON string). Novos endpoints:
    - `POST /events/:id/reimbursements` — organizer/admin/staff do evento próprio;
    - `POST /events/external/:eventKey/reimbursements` — owner/ativador/admin do evento externo.
    Ambos reaproveitam o fluxo de aprovação do `finance-analyzer`/admin e registram no ledger
    com metadata do evento (`reimbursement:<id>:<ts>`). UI: botão "Lançar despesa" na página
    `/admin/eventos` (eventos internos) e na aba de ativação de eventos externos
    (`/admin/overrides?tab=2`), com dialog reutilizável `EventReimbursementDialog` que busca
    saldo das contas no `/ledger/community-balances` e pré-seleciona a conta do evento.
35. **Transparência geral com ingressos vendidos (2026-07-30):** `LedgerService.getTransparencyStats`
    agrega `totalEventTickets` (quantidade) e `totalEventTicketRevenue` (receita) a partir de
    transações com `referenceId LIKE 'event-ticket:%'` (excluindo refunds), além de
    `eventTicketIn`/`eventTicketCount` por comunidade. A página `/transparencia` exibe o KPI
    global e inclui a linha "Ingressos vendidos" nos cards de cada comunidade.
36. **Reconciliação ledger de orders pagas (2026-07-30):** endpoint `POST /events/orders/reconcile-ledger`
    (admin/event_organizer/event_finance) permite reprocessar orders `paid` que não tenham
    transação correspondente no ledger (ex.: falha transitória no webhook). Usa `referenceId`
    `event-ticket:<orderId>` e garante idempotência (não duplica transações).
37. **Teste de DI e correção de assinatura (2026-07-30):** `EventsService` passou a depender de
    `TransactionRepository` e `ReimbursementsService`. Criado `events.module.spec.ts` para
    garantir que `EventsModule` compila sem erros de injeção, e ajustados
    `events.service.spec.ts` e `events-external.spec.ts` para refletir a nova assinatura do
    construtor. Todos os 580 testes backend passam.
38. **Endurecimento do auto-merge de overrides (2026-07-30):** criado
    `scripts/verify-override-author.mjs` e integrado ao workflow
    `.github/workflows/validate-event-overrides.yml`. Regras aplicadas:
    `organizers.json` nunca é auto-mergeado (review manual); cada `.override.json`
    alterado deve declarar `ownerHandle` igual ao autor do PR; o PR deve ter
    exatamente 1 commit do mesmo autor do PR. O script possui testes próprios
    (`scripts/verify-override-author.test.mjs`).
39. **Migração de overrides para o banco (2026-07-31):** substituído o GitHub-as-Database
    de overrides por persistência PostgreSQL via API REST (`/events/overrides`). Criados
    `EventOverride` (entidade), `Migration020_EventOverride`, `EventOverridesService`,
    `EventOverridesController` e endpoint público `/events/overrides/public` para o sync.
    `scripts/sync-events.mjs` aplica overrides do backend diretamente nos snapshots;
    `overrides-index.json`, o workflow `validate-event-overrides.yml` e os arquivos
    `.override.json` foram removidos (ou devem ser migrados manualmente para o banco
    antes da remoção). O frontend `admin/overrides` e `src/lib/events-api.ts` foram
    simplificados para consumir o snapshot já mesclado. Ownership (`organizers.json`)
    e force-sync internal continuam usando GitHub-as-Database.
40. **Migração de ownership para o banco (2026-07-31):** substituído o arquivo
    `static/events/organizers.json` pela tabela `event_organizer_ownership` e pela API
    REST `/events/organizers` (CRUD imediato, sem PR). Criados `EventOrganizerOwnership`
    (entidade), `Migration021_EventOrganizerOwnership`,
    `EventOrganizerOwnershipService` e `EventOrganizerOwnershipController`.
    `EventOrganizerService` foi reescrito como facade delegando para o novo service.
    O frontend `admin/eventos` passou a buscar ownership via `authFetch('/events/organizers')`.
    O arquivo `organizers.json`, o workflow `validate-event-overrides.yml` e os scripts
    de verificação de PR para ownership foram desativados.


---

## Apêndice — Resumo executivo da implementação

> Última atualização: 2026-07-31. Este apêndice consolida o que está funcionando, ressalvas, bugs corrigidos e débitos técnicos do ciclo de implementação.

### O que está implementado

- Eventos próprios (`internal:codaqui`) com CRUD, publicação e snapshot.
- Eventos externos com overrides de metadados e ativação à la carte de features.
- Tipos de ingresso / lotes (free, paid, community, company).
- Checkout Stripe para ingressos pagos (internos e externos), com checkout embedded.
- Ledger com `referenceId` prefixado (`event-ticket:*`, `event-ticket-refund:*`).
- Check-in por QR (scanner + lista manual).
- Importação CSV de participantes para eventos externos.
- Certificados sob demanda (perfil público + verificação pública).
- Histórico público de participações.
- Página dedicada de termos de compra e política de reembolso (`/termos-de-compra`).
- Reembolso/despesa vinculada a evento (interno ou externo).
- Transparência geral mostrando receita e quantidade de ingressos vendidos por comunidade.

### Status por sub-fase

| Sub-fase | Status |
|----------|--------|
| 2a — Fundação | ✅ Implementado |
| 2b — Ingressos pagos | ✅ Implementado |
| 2c — Check-in, comunicação e certificados | ✅ Implementado (ressalvas na UI de opt-in) |
| 2d — Externos à la carte e relatórios | ✅ Implementado (sync automático parcial) |
| 2e — Real Network | 🚧 Plano futuro |

### Pendências e débitos técnicos

| # | Item | Prioridade |
|---|------|------------|
| 1 | Hub unificado de eventos no admin | Média |
| 2 | Toggle de opt-in de comunicações pós-evento | Média |
| 3 | Drill-down financeiro por evento na transparência | Média |
| 4 | Taxas Stripe de ingressos no ledger | Baixa |
| 5 | Check-in de eventos externos na UI | Baixa |
| 6 | Sync automático Discord RSVP | Baixa |
| 7 | Fase 2e — Real Network | Futuro |
