<!-- AGENT-INDEX
purpose: Plano do adendo da Fase 4 — presença em lote, concessão independente, CSV e convites para pending_match.
audience: Implementers e revisores da PR #617.
status: Em execução inline com TDD — Tasks 1–5 concluídas; Task 6 está em andamento.
sections:
  - Progresso
  - Constraints
  - Tasks 1–6
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-09-checkin-certificate-decoupling-design.md — design aprovado
agent-protocol:
  - Executar em ordem, sem subagentes, com teste antes de cada mudança.
-->

# Check-in and Certificate Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar presença em lote, certificado independente, CSV com presença/certificado e convite guest para inscrições `pending_match`, sem alterar os fluxos atuais.

**Architecture:** `event_registrations` recebe concessão/convite próprios. O backend reutiliza check-in, `hour_ledger`, guest claim, notifications e permissões existentes; a UI de check-in ganha operação em lote e central de certificados.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, React 19, MUI 9, Vitest 3, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-09-checkin-certificate-decoupling-design.md`

## Progresso

- [x] Task 1 — migration 041, entidade e backfill.
- [x] Task 2 — concessão independente e check-in em lote.
- [x] Task 3 — CSV com presença/concessão e crédito único de horas; 54 testes focados e build verdes.
- [x] Task 4 — convite transacional e guest claim externo.
- [x] Task 5 — central responsiva, features independentes e relatório CSV; `astro check` sem erros e 898 testes verdes.
- [ ] Task 6 — E2E real, down/up, gates e documentação concluídos; acompanhamento de CI/Sonar/Copilot na PR em andamento.

## Global Constraints

- Mesma PR #617 e backend 0.16.0; migration 041 é aditiva e reversível.
- `certificateGrantedAt` substitui `checkedInAt` como requisito de emissão/verificação; presença concede automaticamente.
- Somente `CONFIRMED` torna o certificado visível. `pending_match` usa guest claim; nenhum vínculo por e-mail não verificado.
- `hour_ledger` somente com membro e carga válida; reupload/retry não duplica horas.
- Convites são explícitos, transacionais e registrados por destinatário; nada de campanha ou open tracking.
- MUI 9/tokens/acessibilidade, sem novo prefixo `/admin/` na API e sem alterar o scanner individual.

---

### Task 1: Migration 041 e contrato de concessão

**Files:**
- Create: `backend/src/migrations/1794340000000-Migration041_CertificateGrants.ts`
- Create: `backend/src/events/certificate-grants.migration.spec.ts`
- Modify: `backend/src/events/entities/event-registration.entity.ts`

**Interfaces:**
- `certificateGrantedAt: Date | null`, `certificateGrantedByMemberId: string | null`, `certificateInvitedAt: Date | null`.
- Backfill por `checkedInAt/checkedInByMemberId`; down remove as três colunas.

- [ ] **Step 1: Escrever teste de migration e entidade**

```ts
expect(upSql).toContain('ALTER TABLE "event_registrations" ADD "certificateGrantedAt" TIMESTAMPTZ');
expect(upSql).toContain('UPDATE "event_registrations" SET "certificateGrantedAt" = "checkedInAt"');
expect(upSql).toContain('"certificateGrantedByMemberId" = "checkedInByMemberId"');
expect(downSql).toContain('DROP COLUMN "certificateInvitedAt"');
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd backend && npx jest src/events/certificate-grants.migration.spec.ts --runInBand`
Expected: migration inexistente.

- [ ] **Step 3: Implementar migration e entidade**

```ts
await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateGrantedAt" TIMESTAMPTZ');
await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateGrantedByMemberId" uuid');
await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateInvitedAt" TIMESTAMPTZ');
await queryRunner.query('UPDATE "event_registrations" SET "certificateGrantedAt" = "checkedInAt", "certificateGrantedByMemberId" = "checkedInByMemberId" WHERE "checkedInAt" IS NOT NULL');
```

- [ ] **Step 4: Rodar teste e commit**

Run: `cd backend && npx jest src/events/certificate-grants.migration.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4): adiciona concessões de certificado na inscrição`

### Task 2: Certificado independente e check-in em lote

**Files:**
- Create: `backend/src/events/dto/certificate-operations.dto.ts`
- Modify: `backend/src/events/events.controller.ts`, `backend/src/events/events.service.ts`, `backend/src/events/events.service.spec.ts`, `backend/src/events/events-external.spec.ts`

**Interfaces:**
- `POST /events/registrations/:id/certificate/grant` registra concessão com escopo do evento.
- `POST /events/:id/checkin/batch` e `/events/external/:eventKey/checkin/batch` recebem `{tokens: string[]}` (1–100) e retornam resultados por inscrição.
- `getCertificate` e `verifyCertificate` usam concessão + `CONFIRMED`; external `certificates` não implica `checkin`.

- [ ] **Step 1: Escrever testes de concessão, batch e features**

```ts
expect(grant.certificateGrantedAt).toBeInstanceOf(Date);
expect(grant.checkedInAt).toBeNull();
expect(verify.valid).toBe(true);
expect(batch).toEqual([
  { token: 'one', status: 'checked_in' },
  { token: 'two', status: 'already_checked_in' },
  { token: 'pending', status: 'invalid' },
]);
expect(activation.features).toEqual(['certificates']);
```

- [ ] **Step 2: Confirmar falhas**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events-external.spec.ts --runInBand`
Expected: métodos inexistentes e verificação exigindo presença.

- [ ] **Step 3: Implementar concessão, batch e verificação**

```ts
registration.certificateGrantedAt ??= new Date();
registration.certificateGrantedByMemberId ??= user.sub;
await this.registrationRepo.save(registration);
// batch captura erros por token e mantém checked_in/already_checked_in/invalid.
```

Preservar idempotência, escopo e auditoria. Check-in preenche concessão sem sobrescrevê-la. Não impor carga a certificados.

- [ ] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/events/events-external.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4): separa certificado de presença e adiciona check-in em lote`

### Task 3: CSV com presença e concessão

**Files:**
- Modify: `backend/src/events/csv.ts`, `backend/src/events/csv.spec.ts`
- Modify: `backend/src/events/events.service.ts`, `backend/src/events/events-external.spec.ts`

**Interfaces:**
- `ParsedCsvRow.checkin?: boolean`, `certificate?: boolean`.
- `checkin=true` registra presença/concessão e horas somente com membro/carga; `certificate=true` não gera horas.

- [ ] **Step 1: Testes de parser e importação**

```ts
expect(parseCsvText('name,email,checkin,certificate\nAna,ana@x.dev,true,false')[0])
  .toMatchObject({ checkin: true, certificate: false });
expect(imported.checkedInAt).not.toBeNull();
expect(imported.certificateGrantedAt).not.toBeNull();
expect(hours).toHaveLength(1);
```

Testar certificate-only, retry e ausência de membro.

- [ ] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/csv.spec.ts src/events/events-external.spec.ts --runInBand`

- [ ] **Step 3: Implementar flags e importação**

```ts
const certificate = row.certificate ?? row.checkin ?? false;
const checkedInAt = row.checkin ? new Date() : null;
// certificate=true concede; checkin=true usa o hook exactly-once somente com membro/carga.
```

Aceitar importação com `checkin` ou `certificates`; não alterar dedupe nem quantidade.

- [ ] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/events/csv.spec.ts src/events/events-external.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4): importa presença e concessão no CSV`

### Task 4: Convite e guest claim externo

**Files:**
- Create: `backend/src/events/dto/certificate-invite.dto.ts`
- Modify: `backend/src/notifications/default-templates.ts`, `backend/src/notifications/email.service.ts`, specs
- Modify: `backend/src/events/events.controller.ts`, `backend/src/events/events.service.ts`, specs

**Interfaces:**
- `POST /events/certificate-invites/batch` com `{registrationIds: string[]}` (1–100).
- `EMAIL_TEMPLATE_CERTIFICATE_PENDING = 'certificate-pending-registration'`.
- Guest invite/claim funciona para managed e external activation.

- [ ] **Step 1: Testes de convite e claim externo**

```ts
expect(invited.status).toBe('pending_guest');
expect(log).toMatchObject({ template: EMAIL_TEMPLATE_CERTIFICATE_PENDING, registrationId: registration.id, status: 'sent' });
const claim = await claimExternalGuest(dto);
expect(claim.status).toBe('confirmed');
expect((await verifyCertificate(code)).valid).toBe(true);
```

Testar retry skipped, convite duplicado e resultado parcial.

- [ ] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/notifications/email.service.spec.ts --runInBand`

- [ ] **Step 3: Implementar template, convite e claim externo**

```ts
await this.emailService.sendCertificatePendingRegistration(registration, event);
registration.status = RegistrationStatus.PENDING_GUEST;
registration.certificateInvitedAt = new Date();
await this.registrationRepo.save(registration);
```

Manter timestamp somente com envio real. Resolver detalhes do evento externo na leitura/claim; não criar login por senha.

- [ ] **Step 4: Rodar testes e commit**

Run: `cd backend && npx jest src/events/events.service.spec.ts src/notifications/email.service.spec.ts --runInBand && npm run build`
Commit: `feat(fase-4): convida inscrições pendentes para aceite de certificado`

### Task 5: Central de check-in e certificados

**Files:**
- Modify: `frontend/src/components/islands/admin/checkin/CheckinApp.tsx`, `ManualSearch.tsx`, `types.ts`, `__tests__/checkin.test.tsx`
- Create: `frontend/src/components/islands/admin/checkin/CertificateCenter.tsx` e teste
- Modify: `frontend/src/components/islands/admin/overrides/ActivationTab.tsx` e testes

**Interfaces:**
- Abas Escanear/Participantes/Certificados, filtros, seleção múltipla e ações por lote.
- Cards mostram presença, concessão e convite; botões chamam batch/grant/invite e exibem erros parciais.

- [ ] **Step 1: Testes de seleção e concessão**

```tsx
await user.click(screen.getByRole('checkbox', { name: /selecionar todos/i }));
await user.click(screen.getByRole('button', { name: /confirmar presença \(2\)/i }));
expect(batchBody.tokens).toHaveLength(2);
await user.click(screen.getByRole('button', { name: /enviar convite/i }));
expect(inviteBody.registrationIds).toEqual([registration.id]);
```

- [ ] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/checkin src/components/islands/admin/overrides`

- [ ] **Step 3: Implementar central responsiva**

```tsx
<Button disabled={selected.size === 0 || busy} onClick={runBatch}>
  Confirmar presença ({selected.size})
</Button>
```

Usar MUI 9/tokens, filtros, cards, estados vazios/erro e preservar QR individual. Relatório de importação exibe presença/concessão e convite pendente.

- [ ] **Step 4: Rodar gates e commit**

Run: `cd frontend && npm run check && npm run test`
Commit: `feat(fase-4): adiciona central de check-in e certificados`

### Task 6: E2E real, ADR e handoff

**Files:**
- Create: `backend/test/certificate-decoupling.e2e-spec.ts`
- Modify: `docs/adrs/001-event-platform.md`, `docs/modules/events/CODE_MANUAL.md`, `docs/modules/privacy/treatments.md`, `AGENTS.md`, `DEVELOPMENT.md`
- Modify: `docs/superpowers/plans/2026-11-07-entities-extension.md`

**Interfaces:**
- Migration 041 down/up com inscrições preservadas.
- `pending_match → invite → accept → verify` real com atores sintéticos removidos.

- [x] **Step 1: E2E e migration real**

Executar dump descartável Podman, migration 041, down/up e jornada externa real com `sent/failed/skipped`, batch e certificado independente.

- [x] **Step 2: Gates completos**

Run: `cd backend && npm run build && npx jest --silent`
Run: `npm run test:scripts`
Run: `make astro-verify && make astro-verify-tenants`

- [x] **Step 3: Documentar e commit**

Registrar decisão, contratos, privacidade, operação e evidências. Commit: `docs(fase-4): registra certificação desacoplada e handoff`

- [ ] **Step 4: Atualizar PR**

Push em `develop`, acompanhar CI/Sonar/Copilot, corrigir apontamentos e apresentar estado para decisão de merge. Não fazer merge/release sem comando explícito.
