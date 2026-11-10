<!-- AGENT-INDEX
purpose: Plano TDD para exigir conta GitHub e e-mail verificado no aceite de convites de certificado.
audience: Implementers e revisores da branch feat/certificate-account-link.
status: Integrado em develop (merge ca2339d0bcb); PR #624 develop→main com checks e SonarCloud verdes; aguardando decisão de merge/deploy.
sections:
  - Constraints globais
  - Contrato do convite e reconciliação
  - Claim autenticado
  - UI GitHub
  - Template, docs e versão
  - E2E e gates
related-docs:
  - docs/superpowers/specs/2026-11-10-certificate-account-link-design.md — design e evidências DevPR
agent-protocol:
  - Execute cada etapa red-green na ordem; não use subagentes.
  - Não envie e-mails, não rode sync real e não faça deploy sem comando explícito.
-->

# Certificate Account Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Exigir conta GitHub com e-mail verificado para associar convites de certificado, preservando o guest claim comum e os 84 links do DevPR Conf 26.

**Architecture:** O módulo de eventos reconcilia envios comprovados, expõe `requiresAccount` e bloqueia o guest antigo para certificados. Um endpoint autenticado usa lock transacional e `secondaryEmails`; a ilha existente escolhe entre guest comum e OAuth.

**Tech Stack:** NestJS 11, TypeORM/PostgreSQL, class-validator, Jest/Supertest, Astro/React 19, MUI v9, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-certificate-account-link-design.md`

## Global Constraints

- Backend feature: bump minor em `backend/package.json`; sem migration nova.
- Usar somente `secondaryEmails` verificados pelo GitHub; nunca aceitar e-mail apenas declarado.
- Não conceder certificado, presença ou horas no claim.
- Não alterar o guest claim de inscrições comuns.
- Não enviar e-mails, reprocessar convites reais, fazer release ou deploy.
- Seguir tokens `--cq-*`, MUI v9 e `resolveApiUrl`/`useAuth` no frontend.

---

### Task 1: Registrar design e plano

**Files:**
- Create: `docs/superpowers/specs/2026-11-10-certificate-account-link-design.md`
- Create: `docs/superpowers/plans/2026-11-10-certificate-account-link.md`

**Interfaces:**
- Consumes: evidências do dump `doity:devpr:devpr-conf-26`.
- Produces: contrato aprovado para backend, frontend e E2E.

- [x] **Step 1: Escrever a spec com os 84 convites, 52 falhas e um envio sem marcação**
- [x] **Step 2: Revisar placeholders, contradições e cobertura de segurança**
- [x] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-11-10-certificate-account-link-design.md docs/superpowers/plans/2026-11-10-certificate-account-link.md
git commit -m "docs(certificados): desenha vínculo com conta GitHub"
```

### Task 2: Contrato público, reconciliação e bloqueio do guest antigo

**Files:**
- Modify: `backend/src/events/events.module.ts`
- Modify: `backend/src/events/events.service.ts:2347-2403,2788-2823`
- Test: `backend/src/events/events.service.spec.ts`
- Test: `backend/src/events/events-external.spec.ts`
- Test: `backend/test/certificate-decoupling.e2e-spec.ts`

**Interfaces:**
- Consumes: `EmailLog { template, registrationId, status, createdAt }` e `EMAIL_TEMPLATE_CERTIFICATE_PENDING`.
- Produces: `getGuestInvite(token)` com `requiresAccount: boolean`; `reconcileCertificateInvitation(registration): Promise<void>` idempotente.

- [x] **Step 1: Escrever testes que falham**

```ts
expect(invite.requiresAccount).toBe(true);
await expect(service.claimGuestRegistration(dto)).rejects.toThrow(
  'Este convite de certificado exige login com GitHub.',
);
expect(registrationRepo.update).not.toHaveBeenCalledWith(
  { id: registration.id },
  expect.objectContaining({ status: RegistrationStatus.CONFIRMED }),
);
```

Adicionar caso com `certificateInvitedAt = null` e log `sent`: o GET grava a data do log e retorna `requiresAccount = true`; logs `failed/skipped` não marcam.

- [x] **Step 2: Rodar os testes e confirmar RED**

Run: `cd backend && npx jest --silent src/events/events-external.spec.ts src/events/events.service.spec.ts`
Expected: falha por ausência de `requiresAccount` e pelo guest antigo ainda aceitar.

- [x] **Step 3: Implementar a reconciliação e o contrato**

Registrar `EmailLog` em `TypeOrmModule.forFeature`, injetar seu repositório e adicionar:

```ts
private async reconcileCertificateInvitation(registration: EventRegistration): Promise<void> {
  if (registration.certificateInvitedAt) return;
  const sent = await this.emailLogRepo.findOne({
    where: {
      registrationId: registration.id,
      template: EMAIL_TEMPLATE_CERTIFICATE_PENDING,
      status: EmailStatus.SENT,
    },
    order: { createdAt: 'ASC' },
  });
  if (!sent) return;
  await this.registrationRepo.update(
    { id: registration.id, certificateInvitedAt: IsNull() },
    { certificateInvitedAt: sent.createdAt },
  );
  registration.certificateInvitedAt = sent.createdAt;
}
```

Chamar a reconciliação no GET, no guest claim e em `certificateInviteRegistrationState`. Retornar `requiresAccount: registration.certificateInvitedAt !== null`; no guest antigo, lançar `ConflictException` antes de qualquer mutação quando esse campo for verdadeiro.

- [x] **Step 4: Rodar os testes e confirmar GREEN**

Run: `cd backend && npx jest --silent src/events/events-external.spec.ts src/events/events.service.spec.ts`
Expected: todos os testes das duas suites passam.

- [x] **Step 5: Commit**

```bash
git add backend/src/events backend/test/certificate-decoupling.e2e-spec.ts
git commit -m "feat(certificados): protege convites que exigem conta"
```

### Task 3: Endpoint autenticado com e-mail verificado

**Files:**
- Modify: `backend/src/events/dto/guest.dto.ts`
- Modify: `backend/src/events/events.controller.ts:731-742`
- Modify: `backend/src/events/events.service.ts`
- Test: `backend/src/events/events.controller.spec.ts`
- Test: `backend/src/events/events-external.spec.ts`
- Test: `backend/test/certificate-decoupling.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtPayload`, `Member.secondaryEmails`, lock `pessimistic_write`.
- Produces: `POST /events/public/guest-claim/github`; `claimCertificateWithAccount(dto, user): Promise<GuestInviteView>`.

```ts
export class ClaimCertificateAccountDto {
  @IsString() @IsNotEmpty() token: string;
  @IsBoolean() @Transform(({ value }) => value === true || value === 'true') consent: boolean;
}
```

- [x] **Step 1: Escrever testes de sucesso, divergência, replay e outra conta**

```ts
await request(app.getHttpServer())
  .post('/events/public/guest-claim/github')
  .set(as('certificate'))
  .send({ token: pendingSent.checkinToken, consent: true })
  .expect(201)
  .expect((response) => {
    expect(response.body).toMatchObject({ status: 'confirmed', requiresAccount: true });
  });
```

No E2E, `certificate` tem `secondaryEmails = ['sent@e2e.invalid']`. Verificar membro, status, concessão preservada e replay. Divergência retorna 403; outra conta retorna 409; consentimento falso retorna 400.

- [x] **Step 2: Rodar e confirmar RED**

Run: `cd backend && npx jest --silent src/events/events-external.spec.ts src/events/events.controller.spec.ts`
Expected: método/rota inexistente.

- [x] **Step 3: Implementar DTO, rota e transação**

```ts
@Post('public/guest-claim/github')
@UseGuards(JwtAuthGuard)
claimCertificateAccount(@Body() dto: ClaimCertificateAccountDto, @Req() req: { user: JwtPayload }) {
  return this.eventsService.claimCertificateWithAccount(dto, req.user);
}
```

Na service, validar consentimento, carregar membro ativo e usar transação com lock. Aceitar somente `pending_guest/confirmed`; comparar e-mail em lowercase com `secondaryEmails`. Para outro `memberId`, lançar `ConflictException`; para o mesmo, retornar sem salvar. Preencher membro/nome/e-mail verificado, confirmar pendente, gravar consentimento e auditar sem token/e-mail nos detalhes.

- [x] **Step 4: Rodar e confirmar GREEN**

Run: `cd backend && npx jest --silent src/events/events-external.spec.ts src/events/events.controller.spec.ts`
Expected: todos os testes passam.

- [x] **Step 5: Commit**

```bash
git add backend/src/events backend/test/certificate-decoupling.e2e-spec.ts
git commit -m "feat(certificados): vincula convite à conta GitHub"
```

### Task 4: UI condicional com OAuth e retorno ao convite

**Files:**
- Modify: `frontend/src/components/islands/events/GuestClaimIsland.tsx`
- Test: `frontend/src/components/islands/events/GuestClaimIsland.test.tsx`

**Interfaces:**
- Consumes: `useAuth().login({ returnTo, switchAccount })`, `authFetch`, convite com `requiresAccount`.
- Produces: jornada guest comum inalterada e jornada de certificado autenticada.

- [x] **Step 1: Escrever testes que falham**

```tsx
window.history.pushState({}, '', '/eventos/convite?token=guest-token');
await user.click(await screen.findByRole('button', { name: /entrar com github/i }));
expect(authState.login).toHaveBeenCalledWith({
  returnTo: '/eventos/convite?token=guest-token',
});
```

Adicionar usuário logado: o botão chama `/events/public/guest-claim/github` com `{ token, consent: true }` e `credentials: include`; o estado final mostra vínculo e link `/membro`. Um 403 mostra orientação e permite trocar de conta.

- [x] **Step 2: Rodar e confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/events/GuestClaimIsland.test.tsx`
Expected: ausência do botão GitHub e do novo claim.

- [x] **Step 3: Implementar a jornada condicional**

Adicionar `requiresAccount?: boolean` ao tipo do convite e `useAuth`. Para certificado sem sessão, usar:

```tsx
<Button variant="contained" onClick={() => login({
  returnTo: window.location.pathname + window.location.search,
})}>
  Entrar com GitHub e associar certificado
</Button>
```

Com sessão, enviar `authFetch` com JSON e consentimento. Não renderizar o formulário/Turnstile para certificado. Após confirmado com `requiresAccount`, mostrar “Participação vinculada à sua conta” e link `/membro`; guest comum mantém QR.

- [x] **Step 4: Rodar e confirmar GREEN**

Run: `cd frontend && npx vitest run src/components/islands/events/GuestClaimIsland.test.tsx`
Expected: todos os testes da ilha passam.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/islands/events/GuestClaimIsland.tsx frontend/src/components/islands/events/GuestClaimIsland.test.tsx
git commit -m "feat(certificados): adiciona aceite via GitHub"
```

### Task 5: Copy, documentação viva e versão

**Files:**
- Modify: `backend/src/notifications/default-templates.ts:129-143`
- Modify: `backend/src/notifications/email.service.spec.ts`
- Modify: `docs/modules/events/CODE_MANUAL.md`
- Modify: `docs/plans/codaqui-1-0/auth.md`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: jornada implementada nas Tasks 2–4.
- Produces: instruções coerentes para futuros convites e backend 0.20.0.

- [x] **Step 1: Ajustar o teste do template para exigir GitHub e e-mail verificado**
- [x] **Step 2: Rodar o teste e confirmar RED**

Run: `cd backend && npx jest --silent src/notifications/default-templates.spec.ts src/notifications/email.service.spec.ts`
Expected: novo texto ainda ausente.

- [x] **Step 3: Atualizar template, manual, auth e versão**

O e-mail deve dizer: “Entre ou crie sua conta Codaqui com GitHub. O e-mail deste convite precisa estar verificado na sua conta GitHub para associar a participação e o certificado.” Documentar que o guest antigo retorna 409 para certificados. Alterar `backend/package.json` de 0.19.0 para 0.20.0.

- [x] **Step 4: Rodar e confirmar GREEN**

Run: `cd backend && npx jest --silent src/notifications/default-templates.spec.ts src/notifications/email.service.spec.ts`
Expected: testes passam.

- [x] **Step 5: Commit**

```bash
git add backend/src/notifications backend/package.json docs/modules/events/CODE_MANUAL.md docs/plans/codaqui-1-0/auth.md
git commit -m "docs(certificados): atualiza jornada de conta e versão"
```

### Task 6: E2E real, gates e PR

**Files:**
- Modify: `backend/test/certificate-decoupling.e2e-spec.ts` (somente se ajustes finais forem necessários)
- Modify: `docs/superpowers/plans/2026-11-10-certificate-account-link.md` (marcar etapas concluídas)

**Interfaces:**
- Consumes: dump local já restaurado e SMTP local desativado.
- Produces: evidência de funcionamento e PR para `main`.

- [x] **Step 1: Rodar o E2E PostgreSQL real**

Restaurar o dump em banco `_test` pelo `make db-restore-prod DB_NAME=<banco_test>`, configurar o processo E2E para esse banco e executar:

Run: `cd backend && DB_NAME=<banco_test> npx jest --runInBand test/certificate-decoupling.e2e-spec.ts`
Expected: convite reconciliado, guest antigo 409, claim GitHub 201, replay e certificado preservado.

- [x] **Step 2: Conferir os 84 convites reais no banco de teste**

Executar GET sem escrita para uma amostra e query agregada. Expected: 84 registros com `certificateInvitedAt` expõem `requiresAccount = true`; nenhum e-mail é enviado.

- [x] **Step 3: Rodar todos os gates**

```bash
cd backend && npm run build && npx jest --silent
cd frontend && npm run check && npm run test
make astro-verify
make astro-verify-tenants
```

Expected: zero falhas; warnings preexistentes permanecem fora do escopo.

- [x] **Step 4: Revisar diff e commit final**

```bash
git diff --check
git status --short
```

Não adicionar dumps, `.env`, `.ui-sweep.tmp.mjs` ou `Dashboard - Mentoria - Schedules.csv`.

- [x] **Step 5: Publicar branch, abrir PR e aguardar SonarCloud**

```bash
git push -u origin feat/certificate-account-link
gh pr create --base main --head feat/certificate-account-link --title "feat(certificados): exige conta GitHub no aceite de convites" --body "Resumo, evidências DevPR, testes e nota de deploy descritos nesta PR."
gh pr checks <numero> --watch
```

Expected: todos os checks e o quality gate do SonarCloud concluídos; qualquer issue nova é corrigida antes de pedir merge.
