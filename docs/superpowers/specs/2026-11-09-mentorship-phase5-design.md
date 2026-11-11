<!-- AGENT-INDEX
purpose: Design aprovado da Fase 5 — Mentoria com disponibilidade, agendamento, sessões, notificações, horas e insights.
audience: Mantenedores, implementers, mentores e revisores da PR.
status: Concluído e publicado em v0.19.0-backend; Mentoria Operations publicada em 0.22.0.
sections:
  - Contexto e decisão
  - Escopo e não escopo
  - Alternativas
  - Modelo da migration 044
  - Disponibilidade e concorrência
  - Jornadas e permissões
  - E-mails e horas
  - APIs e páginas
  - Privacidade e retenção
  - Testes e rollout
related-docs:
  - docs/plans/codaqui-1-0/README.md — subsistema F e fases anteriores
  - docs/adrs/013-hour-ledger.md — fontes e unicidade do hour_ledger
  - docs/adrs/016-certificate-invite-queue.md — envio SMTP serializado
  - docs/modules/privacy/treatments.md — inventário de tratamentos
agent-protocol:
  - Não criar papéis paralelos, autenticação por senha ou vínculo por e-mail não verificado.
  - Não adicionar reagendamento direto, Cal.com/Calendly ou nova fila de e-mails nesta fase.
  - Reserva dupla e crédito duplicado de horas devem falhar nos testes e no banco real.
-->

# Fase 5 — Mentoria no sistema

## Contexto e decisão

A página `#QueroMentoria` hoje possui cinco mentores hardcoded e delega o agendamento ao Google Calendar. Isso não oferece disponibilidade estruturada, prevenção de reserva dupla, acompanhamento por convidado, histórico, avaliação, horas ou insights operacionais.

A Fase 5 traz o ciclo completo para a plataforma, reutilizando `member_designations`, `hour_ledger`, `EmailService`, templates, perfis públicos e o app shell. Backend **0.19.0**, migration **044**, em branch separada da PR #618.

## Escopo e não escopo

### Incluído

- Candidatura e aprovação de mentores com `mentor @ program('mentoria')`.
- Perfil com foco e áreas, disponibilidade semanal e fuso IANA.
- Agendamento por visitante ou membro, com consentimento e token de acompanhamento.
- Confirmação, cancelamento, conclusão, no-show e avaliação da sessão.
- Notificações transacionais, vínculo posterior por e-mail verificado e horas exactly-once.
- Página pública reescrita, painel do mentor, admin e snapshot com insights agregados.
- Migration, testes unitários, frontend e E2E PostgreSQL em dump real.

### Fora

- Reagendamento direto ou assistente de remarcação: cancelar e reservar novamente.
- Google Calendar/Cal.com/Calendly, sincronização externa ou videoconferência criada pela API.
- Nova autenticação por senha, nova fila de e-mails ou campanhas promocionais.
- Alterações em eventos, certificados, projetos de extensão ou na PR #618.
- Múltiplas sessões no mesmo intervalo para o mesmo mentor.

## Alternativas

1. **Modelo completo no sistema — escolhido.** Atende disponibilidade, concorrência, histórico e horas com a infraestrutura existente.
2. Cadastro de mentores com links externos. Menor custo, mas mantém reserva fora do sistema e não resolve histórico/horas.
3. Cal.com/Calendly. Bom agendamento, porém adiciona serviço, credenciais, sincronização e complexidade sem necessidade atual.

## Modelo da migration 044

### `mentor_profiles`

- `id` UUID PK.
- `memberId` UUID FK → `members`, único e `ON DELETE RESTRICT`.
- `areas` text[] com 1–10 tags de até 40 caracteres cada.
- `focus` texto opcional, até 500 caracteres.
- `active` boolean default true.
- `approvedById` UUID FK → `members`, trilha da aprovação.
- `since`, `createdAt`, `updatedAt` timestamptz.

A role `mentor` continua derivada da designation; o perfil não é uma fonte paralela de autorização.

### `mentor_availability`

- `id` UUID PK.
- `mentorId` UUID FK → `mentor_profiles`, `ON DELETE CASCADE`.
- `weekday` integer 0–6, domingo a sábado.
- `startTime`/`endTime` varchar(5), `HH:mm` local.
- `timeZone` varchar(64), default `America/Sao_Paulo`.
- `createdAt`, `updatedAt`.

Início é obrigatório antes do fim. Não há interseção entre regras do mesmo mentor/dia/fuso; o service valida antes de salvar.

### `mentorship_sessions`

- `id` UUID PK.
- `mentorId` UUID FK → `mentor_profiles`, `ON DELETE RESTRICT`.
- `menteeName` varchar(160) e `menteeEmail` varchar(254).
- `menteeMemberId` UUID nullable FK → `members`, `ON DELETE RESTRICT`.
- `topicTags` text[], 1–10 tags de até 40 caracteres.
- `scheduledAt` timestamptz e `durationMin` integer 15–240.
- `timeZone` varchar(64), default `America/Sao_Paulo`.
- `status`: `requested`, `confirmed`, `completed`, `canceled`, `no_show`.
- `meetLink` texto nullable, HTTPS obrigatório ao confirmar.
- `notes` texto opcional, até 5000 caracteres.
- `completedAt` timestamptz nullable.
- `rating` integer 1–5 nullable e `feedback` texto opcional, até 2000 caracteres.
- `cancelReason` texto opcional, 3–500 caracteres ao cancelar.
- `token` UUID único para acompanhamento do convidado.
- `guestConsentAt` timestamptz obrigatório quando não há membro autenticado.
- `createdAt`, `updatedAt`.

Índice único `(mentorId,scheduledAt)` e índices por `status` e `token`. Nome, e-mail e token nunca aparecem no snapshot público.

## Disponibilidade e concorrência

- A disponibilidade usa horário local recorrente e fuso IANA. A sessão persiste o instante em UTC e o fuso usado para exibição.
- A conversão segue o helper de timezone existente, sem offsets fixos nem dependência nova. O contrato deve cobrir mudanças de horário de verão quando aplicável.
- O agendamento só aceita slots futuros derivados de disponibilidade ativa e duração válida.
- A criação executa lock da regra de disponibilidade e consulta sessões `requested/confirmed` sobrepostas. Um horário se sobrepõe quando `existing.start < requested.end` e `existing.end > requested.start`.
- A unicidade `(mentorId,scheduledAt)` é a segunda defesa. Conflito retorna 409, sem criar sessão nem disparar e-mail.
- Editar disponibilidade não altera sessões existentes; conflitos futuros precisam ser cancelados antes da alteração.

## Jornadas e permissões

### Mentor

1. Membro autenticado se candidata com foco e áreas; designation nasce pendente.
2. Admin confirma a designation, criando `mentor_profiles` com `approvedById` e `since`.
3. Mentor ativo edita foco/áreas e disponibilidade própria.
4. Mentor recebe solicitações, confirma com `meetLink` HTTPS, conclui ou registra `no_show` após o horário.
5. Mentor pode cancelar com motivo; admin tem os mesmos poderes operacionais.

### Mentorando

1. Visitante ou membro escolhe mentor, slot e tema, informa nome/e-mail e consentimento quando não autenticado.
2. Sessão nasce `requested`; participante recebe token para acompanhar ou cancelar com motivo.
3. Depois de `completed`, pode atribuir `rating` 1–5 e `feedback` opcional.
4. Se o e-mail for verificado no GitHub posteriormente, `menteeMemberId` é vinculado no próximo `upsertByGithub`, reutilizando a regra atual de e-mails verificados.

### Admin/diretoria

- Admin aprova mentores, gerencia perfis e consulta sessões/insights detalhados.
- Diretoria e finance-analyzer acompanham horas pendentes pela fila existente, sem nova rota de aprovação.

## E-mails e horas

Templates no registry atual:

- `mentorship-requested`: sessão solicitada, para mentor e mentorando.
- `mentorship-confirmed`: link e horário confirmado.
- `mentorship-reminder-d1`: lembrete no dia anterior.
- `mentorship-cancelled`: cancelamento com motivo.

O envio reutiliza `EmailService`, logs e serialização SMTP; não cria fila nova. Falha de e-mail não desfaz agendamento nem confirmação. `guestConsentAt` e tokens não entram no conteúdo público do template; links de acompanhamento ficam somente nos e-mails destinados ao participante/mentor.

Ao concluir:

- `completedAt` é obrigatório.
- Uma entrada `mentorship_session` é criada com `hours = durationMin / 60`, `sourceId = session.id`, `sourceLabel` com foco/mentor e `status = pending`.
- A fonte é única por membro/tipo/sessão; repetir conclusão não duplica horas nem dispara novo e-mail.
- `no_show` e `canceled` não geram horas.
- A aprovação ocorre pela fila atual de `/admin/horas`.

## APIs e páginas

### Público e convidado

- `GET /mentorship/public`: mentores ativos, disponibilidade e estatísticas agregadas, sem PII de mentorandos.
- `GET /mentorship/availability?mentorId=&from=`: slots derivados, sem sessões ocupadas.
- `POST /mentorship/sessions`: agenda com consentimento; resposta 201 com token.
- `GET /mentorship/sessions/:token`: acompanhamento do convidado, sem IDs internos de atores.
- `POST /mentorship/sessions/:token/cancel` e `/rating`: somente ações válidas para o estado atual.

### Membro/mentor/admin

- `POST /mentorship/applications` e `GET /mentorship/applications/my`.
- `GET /mentorship/applications`, `POST /mentorship/applications/:id/confirm` (admin).
- `GET/PATCH /mentorship/profile`, `GET/PUT /mentorship/availability` (mentor ativo).
- `GET /mentorship/sessions`, `POST /mentorship/sessions/:id/confirm`, `/complete`, `/no-show`, `/cancel` (escopo).
- `GET /mentorship/insights`: detalhes agregados por área, realização e no-show; detalhes individuais somente por escopo.

### Frontend

- `/participe/mentoria`: vitrine, áreas, disponibilidade e agendamento acessível por teclado.
- `/membro/mentoria`: disponibilidade, solicitações, próximas sessões e histórico do mentor.
- `/admin/mentoria`: candidaturas, perfis, sessões e insights detalhados com paginação compartilhada.
- `/mentoria/sessao/:token`: acompanhamento, cancelamento e avaliação do convidado.
- `static/mentors/index.json` + workflow próprio: nome, handle, avatar, foco, áreas, disponibilidade e estatísticas agregadas. Não incluir IDs de atores, e-mail, notas, feedback ou sessões individuais.

Formulários usam labels nativos, validação server-side, erros anunciados e foco preservado. Datas exibem fuso explícito; não há auto-submit ao trocar de campo.

## Privacidade e retenção

- Consentimento explícito para convidados; token não é uma segunda autenticação.
- Nome, e-mail, notas e avaliações nunca entram no snapshot nem em insights públicos.
- `meetLink` aparece somente para mentor e para quem acompanha a sessão por token.
- Cron diário anonimiza `menteeName/menteeEmail` de convidados sem `menteeMemberId` após 365 dias. Sessões vinculadas não entram no job; horas, status, datas e estatísticas permanecem.
- `profileVisibility` continua controlando os demais históricos do membro.

## Testes e rollout

- Migration: campos, FKs, índices e down sem tocar tabelas atuais.
- Candidatura/aprovação e escopo por designation ativa.
- Disponibilidade: ordem, sobreposição de regras e slots futuros/fuso.
- Concorrência: duas reservas simultâneas, uma 201 e uma 409, sem e-mail duplicado.
- Status: confirmar, cancelar com motivo, concluir, no-show e transições inválidas.
- Horas: uma única entrada pending por sessão, sem crédito por no-show/cancelamento.
- Convidado: token, cancelamento, avaliação, vínculo só por e-mail verificado e anonimização anual.
- APIs e snapshot: ausência de PII e IDs internos; listagens paginadas no admin.
- Frontend: agendamento por teclado, erros, estados, cancelamento, avaliação e painel por papel.
- E2E real: candidatura → aprovação → disponibilidade → duas reservas concorrentes → confirmação → conclusão → horas → avaliação.
- Gates: backend build/Jest, scripts, Vitest/astro check, `make astro-verify` e `make astro-verify-tenants` quando compartilhado.

Rollout: merge autorizado → `v0.19.0-backend` → redeploy/migration 044 → sync inicial de mentores → frontend → uma sessão controlada. Nenhum merge, release ou e-mail real ocorre sem comando explícito.
