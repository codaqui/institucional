<!-- AGENT-INDEX
purpose: Plano de implementação da agenda do mentor e convites de calendário.
audience: Implementadores e revisores de mentoria/notificações.
status: Pronto para revisão e execução com subagentes.
sections:
  - Constraints
  - Review Focus
  - Tasks
related-docs:
  - docs/superpowers/specs/2026-11-24-mentor-agenda-calendar-design.md
agent-protocol:
  - Preservar PUT por dia e sessões existentes; não enviar e-mails reais.
-->

# Mentor Agenda and Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar editor de disponibilidade semanal compreensível e convites Google Calendar/ICS para mentor e mentorado.

**Architecture:** Adicionar um GET autenticado das próprias regras e validação por item sem mudar o PUT atual. O editor React mantém rascunhos por dia; um helper puro gera URLs/ICS e o EmailService recebe anexos opcionais sem quebrar chamadas antigas.

**Tech Stack:** NestJS 11, TypeORM, class-validator, React 19, MUI v9, Nodemailer, Vitest/Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-mentor-agenda-calendar-design.md`

## Global Constraints

- Preservar `PUT /mentorship/availability/:weekday` com `AvailabilityRuleDto[]`; sem migration ou dependência nova.
- Não apagar/alterar sessões reservadas ao mudar regras; weekday limitado a 0–6.
- Anexos e campos de contexto são opcionais; falha SMTP não reverte sessão.
- Não enviar e-mails reais, criar OAuth Google ou integrar Cal.com/Calendly.
- Release minor 1.12.0 na PR #670; publicar backend antes do frontend.

## Review Focus

- Arrays vazios devem limpar somente o dia autenticado; testar na Task 1.
- Regras com fuso/formato inválido ou sobrepostas não podem substituir o dia; testar na Task 1.
- Erro de salvamento deve preservar rascunho e edições em outros dias; testar na Task 2.
- Texto ICS com vírgulas/quebras e duração que cruza meia-noite deve permanecer válido; testar na Task 3.
- Um destinatário sem e-mail não pode impedir o outro nem a confirmação; testar na Task 3.

---

### Task 1: Contratos de disponibilidade

**Files:**
- Modify: `backend/src/mentorship/dto/mentorship.dto.ts`
- Modify: `backend/src/mentorship/mentorship.controller.ts`
- Modify: `backend/src/mentorship/availability.service.ts`
- Test: `backend/src/mentorship/mentorship.controller.spec.ts`
- Test: `backend/src/mentorship/availability.service.spec.ts`

**Interfaces:**
- Produces: `GET /mentorship/availability/mine -> Array<{weekday:number;startTime:string;endTime:string;timeZone:string}>`; PUT atual validado por item.

- [ ] **Step 1: Write failing tests** para regras do próprio mentor ordenadas, isolamento por ator, weekday inválido, HH:mm/fuso inválido, array vazio, sobreposição e preservação do dia em erro.
- [ ] **Step 2: Run focused tests and verify RED** com `cd backend && npx jest --runInBand src/mentorship/availability.service.spec.ts src/mentorship/mentorship.controller.spec.ts`.
- [ ] **Step 3: Implement** `@Matches`, `@IsTimeZone`, `ParseArrayPipe`, GET antes do GET público e `listMyAvailability(actor)`; validar weekday antes de qualquer delete.
- [ ] **Step 4: Run focused tests and verify GREEN**, depois `npm run build`.

### Task 2: Editor semanal do mentor

**Files:**
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.test.tsx`

**Interfaces:**
- Consumes: GET/PUT da Task 1.
- Produces: rascunho por dia com múltiplas janelas, remoção, fuso e indicação de alterações não salvas.

- [ ] **Step 1: Write failing tests** para carregar regras, empty state, adicionar duas janelas, remover, trocar de dia sem perder rascunho, escolher fuso, PUT com array completo e erro preservando dados.
- [ ] **Step 2: Run focused test and verify RED** com `cd frontend && npm run test -- --run src/components/islands/mentorship/MentorDashboardIsland.test.tsx`.
- [ ] **Step 3: Implement** o formulário acessível, validação no submit, botões secundários `type=button`, estados busy/erro/sucesso e reload canônico após salvar.
- [ ] **Step 4: Run focused test, `astro check` and verify GREEN.**

### Task 3: URLs, Google Calendar e ICS

**Files:**
- Create: `backend/src/mentorship/calendar.ts`
- Create: `backend/src/mentorship/calendar.spec.ts`
- Modify: `backend/src/notifications/email.provider.ts`
- Modify: `backend/src/notifications/email.service.ts`
- Modify: `backend/src/notifications/default-templates.ts`
- Modify: `backend/src/mentorship/availability.service.ts`
- Modify: `backend/src/mentorship/sessions.service.ts`
- Test: specs existentes desses módulos.

**Interfaces:**
- Produces: `buildMentorshipCalendar(session): {sessionUrl:string;calendarUrl:string;ics:string;attachment:EmailAttachment}`; templates mentor próprios e quinto argumento opcional de `sendTemplate`.

- [ ] **Step 1: Write failing tests** para UID estável, DTSTART/DTEND UTC, duração, CRLF/escape, session/calendar URLs, anexo Nodemailer, compatibilidade sem anexo, destinatários e textos próprios.
- [ ] **Step 2: Run focused backend tests and verify RED.**
- [ ] **Step 3: Implement** helper puro, attachments opcionais, contexto `sessionUrl/calendarUrl/menteeName`, templates e envios; isolamento de falhas por destinatário.
- [ ] **Step 4: Run focused tests, backend build and verify GREEN.**

### Task 4: Links públicos, E2E e release

**Files:**
- Modify: `frontend/src/lib/mentorship.ts`
- Modify: `frontend/src/components/islands/mentorship/MenteeSessionIsland.tsx`
- Modify: `frontend/src/components/islands/mentorship/MentorDashboardIsland.tsx`
- Modify: testes desses componentes e `backend/test/mentorship-lifecycle.e2e-spec.ts`.
- Modify: spec, fila, `CHANGELOG.md`, manifests/lockfiles para 1.12.0.

- [ ] **Step 1: Write failing tests** para Google Calendar somente em sessão confirmada e E2E de disponibilidade/confirmação com provider mockado e ICS para ambos.
- [ ] **Step 2: Run focused tests and verify RED.**
- [ ] **Step 3: Implement links e E2E**, sem mudar o ciclo de status.
- [ ] **Step 4: Run backend/frontend/scripts suites e jornada PostgreSQL isolada**, removendo o banco temporário.
- [ ] **Step 5: Inspect UI** claro/escuro em 390×844 e 1440×900 com dados sintéticos; teclado, erros, múltiplas janelas e links.
- [ ] **Step 6: Run final gates** `make astro-verify`, `make astro-verify-tenants`, atualizar documentação somente com resultados reais e manter PR #670 aberta.
