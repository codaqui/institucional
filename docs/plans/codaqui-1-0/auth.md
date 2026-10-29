<!-- AGENT-INDEX
purpose: Anexo transversal do plano Codaqui 1.0.0 — autenticação. (1) Centralização do login em um único fluxo OAuth (GitHub), com o handoff #token + /auth/finalize como contrato provider-agnostic e checklist de onboarding de novos provedores. (2) Token de convidado para eventos — design completo reaproveitando o pattern do mentorando convidado da mentoria (subsistema F), com extensão da tabela event_registrations (sem tabela nova), check-in pelo token como credential e vínculo automático ao criar conta com o mesmo e-mail.
audience: Presidência, mantenedores, AI agents implementando as fases 2 (eventos/guest) e futuros provedores OAuth.
status: design proposto em 2026-10-29 a partir de duas decisões da presidência (2026-10-29): (1) todos os eventos hoje usam GitHub — um único fluxo de login centralizado; novo provedor, se houver, passa pelo mesmo handoff; (2) eventos podem ter token de convidado emitido pelo admin — cadastro de Nome/E-mail sem conta, com vínculo automático se a pessoa criar conta validada depois (mesma regra de menteeMemberId do subsistema F). Anexo documental — a centralização do login não exige código hoje; o guest token é recomendado junto à Fase 2 (ver "Mapeamento").
sections:
  - 1. Centralização do login (decisão arquitetural)
  - 2. Guest token para eventos (design completo — extensão de event_registrations)
  - 3. Check-in de guest (integração com o fluxo atômico existente)
  - 4. Mapeamento (fases, backend, frontend)
  - 5. Riscos e decisões abertas
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (subsistema F mentoria — pattern de token do mentorando; decisões 2026-10-29 no status)
  - docs/adrs/001-event-platform.md — plataforma de eventos (inscrição com conta obrigatória — decisão #2)
  - docs/modules/events/ROLES.md — papéis de eventos (staff host/checker, organizer ownership)
  - backend/src/auth/auth.controller.ts — handoff #token + POST /auth/finalize (contrato provider-agnostic)
  - backend/src/events/entities/event-registration.entity.ts — tabela única de inscrições (alvo da extensão guest)
  - docs/plans/codaqui-1-0/c4p.md — subsistema G (submissão pública com consentimento LGPD — mesmo padrão de coleta mínima)
agent-protocol:
  - Este anexo é TRANSVERSAL: não cria fase própria nem consome versão de backend sozinho — toda implementação se aloca nas fases existentes (ver "Mapeamento").
  - Guest token = instância do pattern "página de convidado por token" (mentoria F5). Novas coletas públicas de não-membros devem reaproveitar o mesmo pattern em vez de inventar auth caseira (lição do C4P externo).
  - Endpoints públicos de convidado SEMPRE com Turnstile + @nestjs/throttler + consentimento LGPD registrado (consentAt) — ver seção 5.
-->

# Autenticação — login centralizado + convidado de eventos (anexo transversal)

> **Origem:** duas decisões da presidência em **2026-10-29**:
> 1. **Todos os eventos hoje usam GitHub** — há UM único fluxo de login; centralizar nisso hoje. Se um dia houver outro provedor OAuth, ele entra pelo mesmo padrão — o padrão é um único fluxo centralizado.
> 2. **Eventos no geral podem ter token de convidado emitido pelo admin do evento:** a pessoa cadastra Nome/E-mail (sem conta) e, se um dia criar conta validada, o histórico vincula automaticamente.
>
> Este documento é a referência canônica para autenticação no 1.0.0. Parte do fluxo atual auditado em `backend/src/auth/` (`github.strategy.ts`, `auth.controller.ts`), `backend/src/events/` (inscrição com `JwtAuthGuard` — decisão #2 da plataforma de eventos) e `frontend/src/components/islands/AuthCallback.tsx` + `src/lib/use-auth.ts`.

## 1. Centralização do login

### Decisão arquitetural (2026-10-29)

**Um único fluxo OAuth, provider-agnostic no handoff.** Hoje o provedor é o GitHub; o contrato de autenticação, porém, não depende dele:

```
qualquer ponto de entrada de login (header, página de evento, mentoria, C4P, admin)
  → GET /auth/github                      (único entrypoint — Passport redireciona ao provedor)
  → callback do provedor no backend        (hoje GET /auth/github/callback)
  → redirect para /auth/callback?status=success#token=<handoffJWT>
  → AuthCallback.tsx lê o fragment e chama POST /auth/finalize
  → cookie httpOnly codaqui_token (7 dias, first-party)
```

O **handoff** é a peça que torna tudo centralizável: um JWT efêmero (TTL 2min, `aud: auth-handoff`) entregue no **fragmento** da URL — nunca trafega ao servidor, não vaza em logs/Referer — trocado por um cookie de sessão via `POST /auth/finalize`. Esse contrato não menciona GitHub em lugar nenhum: `AuthCallback.tsx`, `/auth/finalize`, `useAuth()` e o cookie são estáveis para qualquer provedor futuro.

### O que MUDA (hoje): **nada**

A centralização é documental. O fluxo atual já é um único entrypoint (`GET /auth/github`, consumido via `startLogin()` do `auth-client.ts` em todas as ilhas); este anexo formaliza isso como decisão e fixa o contrato.

Quando (e somente quando) um segundo provedor entrar, as mudanças são pontuais e previstas aqui:

- **Payload do handoff normalizado.** Hoje o token carrega `githubId`. Com N provedores, vira `{ sub, provider, providerAccountId, handle, name, email, avatarUrl, roles }` — mudança pequena, confinada a `auth.controller.ts` e ao consumidor em `AuthCallback.tsx`/`use-auth.ts`.
- **Vínculo membro ↔ provedor.** Hoje `MembersService.upsertByGithub` resolve o perfil direto. Um provedor novo exige resolução de identidade (tabela de contas vinculadas ou match por e-mail **verificado** — a mesma regra da seção 2.6) antes de emitir o handoff.

### O que NÃO muda (invariantes, independente de provedor)

- **Cookie first-party `codaqui_token`** — httpOnly, `secure` + `SameSite=strict` em produção, TTL 7 dias, `path=/`. Sessão continua saindo exclusivamente de `POST /auth/finalize` (nunca de callback de provedor), o que preserva o fix do deploy whitelabel (cookie fixado no domínio certo via Pages Function).
- **Handoff `#token` + `/auth/finalize`** — contrato único de cross-domain; `AuthCallback.tsx` não ganha ramificações por provedor.
- **Proxy same-origin da Pages Function** — `/auth/github`, `/auth/me`, `/auth/logout` e `/auth/finalize` já estão na allow-list (`frontend/src/lib/api-proxy-paths.ts`). Provedor novo cujo callback aponte direto ao backend (`BACKEND_URL`, como o GitHub) **não exige nenhuma entrada nova**; só rotas de API inéditas entrariam na lista — com o prefixo estreito + trailing slash da decisão 3 do AGENTS.md.
- **Anti open-redirect do `returnTo`** — duas camadas (state JWT + cookie `codaqui_return_to` + `resolveReturnUrl`), sem mudança.
- **E-mail como eixo de identidade** — o provedor pode mudar; a chave de vínculo de históricos (guest, CSV importado, mentorando) continua sendo e-mail verificado.

### Checklist de onboarding de um novo provedor (vive aqui)

1. Nova `PassportStrategy` que resolve o perfil do provedor para um **membro** (cria ou vincula — match por e-mail verificado, nunca por e-mail digitado).
2. Callback do provedor emite o **mesmo handoff** (mesmo audience `auth-handoff`, TTL 2min, fragment) e redireciona para `/auth/callback` com `?status=success`.
3. Escopos mínimos necessários; nada de escopo de escrita sem justificativa documentada (o `public_repo` do GitHub hoje existe por causa do GitHub-as-Database legado — quando esse morrer, o escopo sai).
4. Revisão de privacidade: o provedor entra no inventário de tratamentos (`docs/modules/privacy/`, perfil "membro") e na Política (P1).
5. Registrar o provedor na lista deste documento (abaixo) e nos docs do Swagger.

**Provedores ativos:** GitHub (único, desde o início da plataforma).

## 2. Guest token para eventos

### 2.1 Decisão de modelagem — EXTENSÃO de `event_registrations` (sem `event_guest_registrations`)

**Preferimos estender a tabela de inscrições existente com campos guest + token, fonte única.** Justificativa:

- `event_registrations` **já é a fonte única** de tudo o que um convidado precisa participar: capacidade (`countBy status=CONFIRMED` — `events.service.ts`), check-in atômico (`checkinToken` → update condicional `checkedInAt IS NULL`), certificado (`certificateCode(checkinToken)`), listas de staff e importações externas.
- Uma tabela paralela duplicaria cada um desses caminhos: capacity teria que **somar duas tabelas** (race condition na contagem), o check-in consultaria duas fontes, o hook de horas e o certificado precisariam de ramificação guest/não-guest. Cada ramificação é um bug futuro de "o convidado não aparece / não entra na conta / duplicou vaga".
- Os campos necessários **já existem**: `attendeeName`, `attendeeEmail`, `checkinToken`, `status`. Guest é uma inscrição `memberId = null` + metadados guest — exatamente o mesmo espírito do `menteeMemberId?` de `mentorship_sessions` (subsistema F): a pessoa pode nunca virar membro, e a linha continua válida.

**Migration aditiva** (sequência do plano-mãe, ≥ 026; número atribuído na implementação — ver Mapeamento):

| Coluna | Tipo | Notas |
|---|---|---|
| `is_guest` | `boolean not null default false` | marca inscrições de convidado |
| `guest_invited_by_member_id` | `uuid null` (FK → members) | quem gerou o convite — trilha de audit |
| `guest_claimed_at` | `timestamptz null` | quando o convidado preencheu nome/e-mail |
| `guest_consent_at` | `timestamptz null` | consentimento LGPD (ver 2.4) |
| `status` | enum **+ `PENDING_GUEST`** | convite emitido, ainda não reclamado |

**Token único.** Reutilizamos `checkinToken` (já `unique`, já vai no QR) como o token do link de convite: a URL `/eventos/<rota>/convite/<checkinToken>` é tanto o link de cadastro quanto a credencial de check-in do dia. Alternativa considerada e descartada: token de convite separado, gerando `checkinToken` fresco no claim — complexidade extra sem ganho, porque check-in exige ação do staff e status `CONFIRMED` (convite não reclamado é `PENDING_GUEST` e é rejeitado — ver seção 3).

### 2.2 Fluxo ponta a ponta

```
admin/organizer/staff host            convidado                        staff no dia
        │                                │                                │
 1. POST /events/:id/guest-invites ─────►│                                │
    cria registration                   │                                │
    status=PENDING_GUEST,               │                                │
    isGuest=true, checkinToken          │                                │
    devolve /eventos/<rota>/            │                                │
    convite/<token> (+QR no admin)      │                                │
        │                          2. abre o link (página pública,      │
        │                             noindex, sem login)               │
        │                          3. preenche Nome + E-mail +          │
        │                             consentimento LGPD + Turnstile    │
        │                          4. POST /events/public/guest-claim   │
        │                             (público; update condicional      │
        │                             PENDING_GUEST→CONFIRMED,          │
        │                             exatamente 1×)                    │
        │                          5. e-mail de confirmação com QR      │
        │                                │                                │
        │                          6. (futuro) cria conta GitHub com    │
        │                             o MESMO e-mail → vínculo          │
        │                             automático (2.6)                  │
        │                                │                                │
        │                                │ 7. QR do e-mail/página ──────► POST /events/:id/checkin
        │                                │    escaneado                  (endpoint EXISTENTE,
        │                                │                                sem mudança)
```

1. **Emissão** — `POST /events/:id/guest-invites` (`JwtAuthGuard` + `RolesGuard`: roles globais de evento **ou** staff `host` do evento — mesmo critério do check-in). Cria a registration `PENDING_GUEST` e devolve a URL + QR (renderizado no admin para imprimir). Vai ao `audit`. Rate limit por evento (evita bombardeio de convites).
2. **Abertura** — página pública (rota sob `/eventos/…`, `noindex`, `PublicLayout`). Estados: `PENDING_GUEST` → formulário; `CONFIRMED` → dados + QR de check-in (reabertura do link); evento lotado/cancelado/encerrado → mensagem clara.
3. **Claim** — `POST /events/public/guest-claim` **sem login** (única superfície pública nova; protegida por Turnstile + throttler — ver 2.4 e seção 5). Valida evento `PUBLISHED` e capacidade, então executa o claim **exatamente 1×**:

   ```sql
   UPDATE event_registrations
      SET status='confirmed', attendee_name=:name, attendee_email=:email,
          guest_claimed_at=now(), guest_consent_at=now()
    WHERE checkin_token=:token AND status='pending_guest'
   ```

   O update condicional é a trava: concorrência, refresh duplo ou token reenviado resulta em 0 linhas afetadas → 409. Falha de e-mail posterior **nunca** derruba o claim (mesmo padrão do RSVP de membro).
4. **Capacidade** — guests consomem `capacity` assim que `CONFIRMED`: a contagem é a **mesma query** de hoje (`status=CONFIRMED`), guests + membros numa fonte só — o requisito "capacidade conta guests + membros" sai de graça. Para eventos com lote gratuito de `quantityTotal`, o claim reserva quota via `reserveQuota` na mesma transação (padrão do RSVP).
5. **Convite para evento pago** — **fora de escopo**: convidado entra pelo fluxo gratuito; ingresso pago continua exigindo conta (decisão #2 da plataforma de eventos inalterada). Evento não pode misturar `capacity` (RSVP) com lotes pagos — regra existente já garante isso.
6. **E-mails** — confirmação via módulo `notifications`, estendendo `sendRegistrationConfirmation` (mesmo template base, variáveis guest: nome do convidado, QR/link). Template registrado no registry de templates (E2 — override em banco com fallback em código). Lembrete D-1: os crons de lembrete de inscrição passam a incluir guests (e-mail é o único canal do convidado).

### 2.3 O pattern transversal (instâncias)

O guest token é a **segunda instância** do pattern "página de convidado por token" — a primeira é o mentorando convidado da mentoria (`mentorship_sessions.token`, subsistema F, Fase 5); a terceira candidata é o avaliador C4P externo (risco 12 do plano-mãe, decisão na Fase 7). As três compartilham: token opaco de alta entropia na URL, coleta mínima Nome+E-mail, consentimento LGPD registrado, vínculo automático por e-mail verificado se a pessoa criar conta. **Novas coletas públicas de não-membros reaproveitam esse pattern — nunca auth caseira por senha** (lição registrada na origem do C4P).

### 2.4 LGPD mínimo (coleta pública de não-membro)

- **Coleta mínima:** Nome + E-mail. Nada mais (sem telefone, sem CPF).
- **Consentimento explícito** — checkbox não-pré-marcado, finalidade declarada na própria página ("inscrever você no evento X e enviar comunicações sobre ele"), timestamp em `guestConsentAt`. Sem consentimento → 400.
- **Turnstile (Cloudflare)** no claim: sem cookie de sessão, sem fricção de captcha; validação server-side (`siteverify`) antes de qualquer escrita.
- **Finalidade única** — e-mail de guest não entra em nenhuma lista de marketing; opt-in separado se um dia existir.
- **Inventário** — perfil "convidado de evento" adicionado ao inventário de tratamentos (`docs/modules/privacy/`, P1) com finalidade/base/retenção (ver seção 5, risco 1).
- **Página pública `noindex`** e link para a Política de Privacidade no formulário.

### 2.5 Check-in de guest — ver seção 3 (endpoint existente, token como credential).

### 2.6 Vínculo automático com conta (mesma regra de `menteeMemberId`)

Quando uma pessoa cria conta (GitHub OAuth) com o **mesmo e-mail** do guest:

- O hook vive no ponto em que o sistema conhece os e-mails verificados do membro — `MembersService.upsertByGithub` (e-mail primário + `secondaryEmails` verificados, que o `GithubStrategy` já coleta). Lá roda, idempotente:

  ```sql
  UPDATE event_registrations
     SET member_id=:memberId
   WHERE is_guest AND member_id IS NULL
     AND lower(attendee_email) IN (<emails verificados do membro>)
  ```

- Match **somente com e-mail verificado** (mesma regra do match de participantes importados via CSV) — nunca com e-mail digitado em formulário, para não vincular histórico a um terceiro que digitou o e-mail alheio.
- **Merge de duplicata:** se o membro já tem inscrição `CONFIRMED` no mesmo evento, a linha guest é `CANCELLED` (mantém trilha em `audit`) em vez de duplicar vaga/certificado. Decisão a confirmar (seção 5, risco 4).
- Depois do vínculo, a inscrição aparece em **Minhas inscrições** (`myRegistrations` consulta por `memberId` — sem mudança nenhuma no endpoint) e no histórico do `/@handle` (respeitando `profileVisibility` da Fase 1b/2).

## 3. Check-in de guest (integração com o fluxo atômico existente)

O token do convite **é a credential** — e o check-in reutiliza o fluxo atômico de hoje sem ramificação:

- **Scanner do staff (QR/câmera):** `POST /events/:id/checkin { token }` — **endpoint existente, zero mudança**. A registration guest `CONFIRMED` passa por `performCheckin` exatamente como a de membro: update condicional `{ id, checkedInAt: IsNull() }` (idempotente — 2ª leitura → `already_checked_in`), `audit` de `EVENT_CHECKIN`, e-mail/log conforme o evento.
- **Única alteração no backend de check-in:** `PENDING_GUEST` entra na lista de status rejeitados por `performCheckin` — convite não reclamado não pode ser check-inado (hoje a lista rejeita `REFUNDED`/`CANCELLED`/`PENDING_MATCH`/`WAITLIST`; o novo status precisa ser enumerado explicitamente para não cair no caminho feliz).
- **Lista manual (admin/staff):** guests aparecem em `listRegistrations` (consulta por evento, já existente) — busca por nome/e-mail funciona sem mudança; o staff confere identidade pelo nome no dia.
- **Certificado de participação:** mesmo código de verificação público (`CRT-<checkinToken>`) — um guest com check-in feito tem certificado verificável na página pública, com o nome que preencheu no claim.
- **Horas (Fase 2):** o hook exatamente-once do `hour_ledger` dispara na transição atômica `checkedInAt` null→valor; guests têm `memberId = null` → **nenhuma entrada de horas** no momento. Horas retroativas se o vínculo com conta acontecer depois → decisão aberta (seção 5, risco 5).

## 4. Mapeamento

### Fases tocadas

| Entrega | Fase | Versão backend | Por quê |
|---|---|---|---|
| **Centralização do login** | **Nenhuma** — documental | nenhuma | O fluxo atual já é o padrão; este anexo fixa o contrato e o checklist de provedores |
| **Guest token (backend + frontend)** | **Fase 2 — "Pessoas e horas"** | **0.12.0** (mesma versão da Fase 2) | Toca `event_registrations`, o check-in atômico e a decisão do hook de horas para guest (risco 5) — o mesmo módulo e o mesmo gate de testes (`npm run build && npx jest`). Não é 1a (fundações = communities/directorates/E1/R1, sem relação com eventos). É aditivo e poderia ser antecipado como minor independente, mas tocaria o módulo de eventos duas vezes (guest agora, hook F2 depois) — recomendação: junto com a Fase 2 |

Migrations: aditiva em `event_registrations` (seção 2.1), número atribuído na sequência do plano-mãe (≥ 026) no momento da implementação.

### Backend (Fase 2)

- Migration: colunas guest + status `PENDING_GUEST` (2.1).
- `RegistrationStatus.PENDING_GUEST`; `performCheckin` rejeita `PENDING_GUEST` (seção 3).
- `EventsService`: `createGuestInvite()` (emissão, audit, rate limit), `claimGuestRegistration()` (claim atômico condicional, Turnstile, capacity/quota, e-mail), listagem de convidados em `listRegistrations` (sem mudança de assinatura — já é por evento).
- Controller: `POST /events/:id/guest-invites` (`JwtAuthGuard` + `RolesGuard`/ownership) e `POST /events/public/guest-claim` (**público** — Turnstile + `@nestjs/throttler`, fora de qualquer guard de JWT).
- `MembersService.upsertByGithub`: hook de vínculo por e-mail verificado (2.6).
- `notifications`: template de confirmação guest no registry (E2) + extensão do lembrete D-1 para guests.

### Frontend

- **`frontend/src/pages/eventos/convite/[token].astro`** — página pública noindex (`PublicLayout`) + ilha **`GuestClaimIsland`**: formulário Nome/E-mail/consentimento/Turnstile; estado `CONFIRMED` → dados + QR de check-in; estados de erro/lotado com mensagens claras. Ilha sob `client:only` com `resolveApiUrl()` (decisão 3 do AGENTS.md — `/events/` já está na allow-list do proxy).
- **Admin do evento** (ilhas de eventos existentes): ação **"Convidado — gerar link/QR"** (chama `guest-invites`, exibe QR para imprimir) e coluna/tipo "convidado" na lista de inscrições (badge em `listRegistrations`).
- **E-mail de confirmação** com QR (template notifications, variáveis guest).
- **Check-in do staff: sem mudança** — o scanner admin existente lê o mesmo `checkinToken`.
- `AuthCallback.tsx`, `use-auth.ts`, `auth-client.ts`: **inalterados** (centralização do login).

## 5. Riscos e decisões abertas

1. **Retenção LGPD de guest (decisão da presidência pendente).** Proposta inicial: dados de guest (nome/e-mail) mantidos enquanto a inscrição existir + o ciclo de relatórios do evento; **anonimização automática 12 meses após o evento** (nome/e-mail removidos, token e trilha de check-in preservados para auditoria); se o vínculo com conta acontecer antes, a linha passa a seguir a política de membro. Confirmar periodicidade com a diretoria e registrar no inventário (`docs/modules/privacy/`) + Política (P1/P2 — adicionar "convidado de evento" ao perfil do mentorando convidado).
2. **Abuso do token/link.** O link de convite é encaminhável — quem o recebe pode reivindicar a vaga. Mitigações: claim exatamente 1× (update condicional), Turnstile + throttler por IP e por token no endpoint público, revogação pelo staff (`CANCELLED`). Residual aceito para eventos gratuitos: o encaminhado ocupa a vaga, e o check-in presencial valida identidade pelo nome. Se um dia houver convite para evento pago/com certificado nominal restrito, reavaliar (token de uso único com confirmação de e-mail).
3. **Capacidade sob concorrência no claim.** O par `countBy(CONFIRMED) vs capacity` é best-effort — **o mesmo comportamento do RSVP de membro hoje**; a trava forte é o update condicional do claim (1 token = 1 transição) e `reserveQuota` para lotes com `quantityTotal`. Sem degradação em relação ao estado atual; documentado para não surpreender.
4. **Duplicidade guest + membro no mesmo evento.** Política proposta: no vínculo, se o membro já tem inscrição `CONFIRMED` no evento, a guest vira `CANCELLED` (merge com trilha). Confirmar com a diretoria antes da implementação.
5. **Horas retroativas de guest vinculado.** Check-in de guest gera `hour_ledger`? Proposta: **não retroativo** — a entrada `event_checkin` automática exige `memberId` no momento da transição atômica; se o vínculo vier depois, a diretoria lança manualmente (`directorate_activity`) se fizer sentido. Decidir na Fase 2 (mesma fase que implementa o guest).
6. **Match de e-mail não verificado.** Mitigado pelo uso exclusivo de e-mails verificados do GitHub (primário + `secondaryEmails`) — mesma regra do match de CSV importado. Risco residual de colisão entre pessoas que compartilham um e-mail é baixo e aceito (é o eixo de identidade de toda a plataforma).
7. **Eventos externos ativados.** Fase 1 do guest cobre **managed events** (incluídos os do Universitário, Fase 4b — `managed_events.institutionId`). Convidado em evento externo ativado (`checkinExternal`, registrations importadas `PENDING_MATCH`) fica como follow-up: o claim pode endereçar a activation por `eventKey` com o mesmo pattern, mas o matching de importados já tem semântica própria — não misturar sem revisão.
8. **Convidado nunca vira avaliador C4P com este token.** Se a diretoria decidir por avaliadores externos na Fase 7 (risco 12 do plano-mãe), o caminho é o pattern de página de convidado por token da mentoria — não este fluxo de inscrição.

---

> **Síntese para implementação:** seção 1 = contrato (não muda código hoje); seções 2–3 = feature aditiva de eventos recomendada para a **Fase 2 (0.12.0)**; seção 4 = o que implementar por camada; seção 5 = o que fechar com a presidência antes do primeiro PR (riscos 1, 4 e 5 são as decisões de negócio).
