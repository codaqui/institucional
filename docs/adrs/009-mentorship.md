<!-- AGENT-INDEX
purpose: ADR da Fase 5 — candidatura, disponibilidade, agendamento concorrente, sessões, horas e insights de mentoria.
audience: AI agents, mantenedores, mentores e operadores de release.
status: Implementado e integrado em develop pelo merge 85fae64047c; release 0.19.0, sync inicial e validação controlada pendentes.
sections:
  - Contexto e decisão
  - Modelo e autorização
  - Disponibilidade e concorrência
  - Sessões, notificações e horas
  - APIs, frontend e snapshot
  - Privacidade e retenção
  - Verificação e rollout
related-docs:
  - 006-directorates-designations.md — autorização por designation
  - 013-hour-ledger.md — fontes e aprovação de horas
  - 016-certificate-invite-queue.md — serialização SMTP reutilizada
  - ../superpowers/specs/2026-11-09-mentorship-phase5-design.md — design aprovado
  - ../superpowers/plans/2026-11-09-mentorship-phase5.md — plano TDD e evidências
agent-protocol:
  - Não criar papéis paralelos, autenticação por senha, reagendamento direto, Cal.com/Calendly ou fila SMTP nova.
  - Snapshot nunca contém PII de mentorandos, IDs de membros/aprovadores, notas, tokens ou sessões individuais.
  - Reserva dupla e crédito duplicado de horas devem permanecer cobertos por testes reais.
-->

# ADR 009 — Mentoria no sistema

- **Data da decisão:** 2026-11-09
- **Status:** Implementado e integrado em develop pelo merge `85fae64047c`; publicação pendente
- **Escopo:** Backend 0.19.0, migration 044, disponibilidade, sessões, notificações, horas, páginas e snapshot

## Contexto e decisão

A página `#QueroMentoria` tinha cinco perfis hardcoded e delegava o agendamento ao Google Calendar. Não havia prevenção de reserva dupla, estado da sessão, acompanhamento por convidado, avaliação, horas ou métricas operacionais.

A Fase 5 traz o ciclo completo para a plataforma, reutilizando designations, `hour_ledger`, `EmailService`, templates, autenticação existente, app shell e snapshots. Não adiciona serviço externo de agenda nem infraestrutura de fila.

## Modelo e autorização

A migration 044 cria:

- `mentor_profiles`: foco, áreas, ativação, aprovação e membro único;
- `mentor_availability`: regras semanais com weekday, início/fim e fuso IANA;
- `mentorship_sessions`: participante, instante, duração, fuso, estado, link, avaliação, cancelamento, consentimento e token.

`mentor @ program('mentoria')` é a autorização. A candidatura cria a designation pendente e um perfil inativo; admin confirma a designation e ativa o perfil. O perfil não é uma fonte paralela de papéis. Admin pode operar sessões, mas o crédito de horas sempre pertence ao mentor da sessão.

## Disponibilidade e concorrência

A disponibilidade usa horário civil recorrente e fuso IANA. Slots futuros são derivados por 28 dias, sem sessões `requested/confirmed` sobrepostas. O cálculo de weekday usa `Intl.DateTimeFormat` no fuso da regra, cobrindo virada de dia entre fusos.

A reserva executa uma transação PostgreSQL:

1. Localiza e bloqueia a regra com `pessimistic_write`;
2. Converte o horário civil pelo fuso da regra;
3. Verifica sobreposição com `existing.start < requested.end AND existing.end > requested.start`;
4. Persiste `requested` e o token UUID;
5. Só depois do commit notifica mentor e mentorando.

A unique `(mentorId,scheduledAt)` é a segunda defesa e vira 409. Conflito não cria sessão nem dispara e-mail. Remarcação é cancelar e reservar novamente.

## Sessões, notificações e horas

Os estados são `requested`, `confirmed`, `completed`, `canceled` e `no_show`.

- Confirmação exige mentor/admin e link HTTPS.
- Conclusão e no-show exigem sessão confirmada e horário já ocorrido.
- Cancelamento exige motivo de 3–500 caracteres e vale para mentor/admin ou convidado por token.
- Avaliação 1–5 e feedback opcional só são aceitos após `completed`.

Os templates `mentorship-requested`, `mentorship-confirmed`, `mentorship-reminder-d1` e `mentorship-cancelled` usam o registry existente. O cron de lembrete seleciona sessões confirmadas na janela D-1. Persistência ocorre antes da notificação; falha de render/SMTP não desfaz a transição. O envio reutiliza logs e a serialização SMTP existente.

`HoursService.recordMentorshipSession()` cria uma entrada `mentorship_session` pendente com `hours = durationMin / 60`, deduplicada por membro/tipo/sessão. Repetir conclusão não duplica horas; cancelamento e no-show não geram crédito. A aprovação continua em `/admin/horas`.

## APIs, frontend e snapshot

As rotas de gestão ficam fora de `/admin/`: candidaturas, perfil, disponibilidade, sessões e insights. A listagem admin usa `{data,total,page,totalPages,limit}` e `PaginationControls`.

O convidado agenda com consentimento e acompanha por token. No login posterior, somente e-mails verificados pelo GitHub vinculam `menteeMemberId`. Com JWT opcional, o cancelamento autenticado usa ID e escopo; sem JWT, usa token.

O frontend entrega `/participe/mentoria`, `/membro/mentoria`, `/admin/mentoria` e `/mentoria/sessao/<token>`. Como o build é estático, a última rota usa rewrite 200 para `/mentoria/sessao/index.html`; o token é lido no cliente e a página é noindex/fora do sitemap. Formulários usam labels nativos, validação server-side, erros visíveis e controles de teclado.

`GET /mentorship/public` projeta mentores ativos e insights agregados. O UUID exposto é o **perfil de mentoria**, necessário para consultar slots e reservar; `memberId`, aprovadores e IDs de sessões não são públicos. O sync diário 06:21 UTC grava `static/mentors/index.json` atomicamente, preserva o arquivo anterior em erro e mantém `generatedAt` quando nada muda. O snapshot contém perfil público, disponibilidade e agregados de conclusão/no-show, nunca PII de mentorandos ou sessões individuais.

## Privacidade e retenção

Nome, e-mail, notas, feedback, links e tokens não entram no snapshot. `meetLink` aparece somente ao mentor e ao convidado com token. Convidados precisam registrar consentimento quando não autenticados.

O cron diário anonimiza `menteeName/menteeEmail` de sessões com mais de 365 dias somente quando `menteeMemberId` é nulo. Usa identificadores reservados `@anon.invalid` para evitar novo vínculo acidental. Status, horas, datas, avaliação e estatísticas permanecem; sessões vinculadas não entram no job.

## Verificação e rollout

- Unitários e integração cobrem candidatura, escopo, slots/fusos, lock, conflito sem e-mail, estados, falha de template, horas exactly-once, vínculo verificado, retenção, projeção e sync atômico.
- E2E PostgreSQL em dump real cobriu candidatura → aprovação → disponibilidade → duas reservas simultâneas (201/409) → confirmação → conclusão → uma hora pendente → avaliação.
- A migration 044 foi aplicada e exercitada down/up com backup/restauração das fixtures; a designation e as horas permaneceram consistentes. Banco descartável e fixtures foram removidos.
- Rollout: merge autorizado → `v0.19.0-backend` → redeploy/migration 044 → sync inicial de mentores → frontend → uma sessão controlada. Nenhum release, sync real ou e-mail real ocorre sem comando explícito.
