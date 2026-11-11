<!-- AGENT-INDEX
purpose: Plano TDD da Fase 6 — Business tiers, due diligence, hotpage e badges PJ.
audience: Implementers e revisores da PR.
status: Concluída e publicada em v0.21.0-backend; validação controlada é acompanhamento operacional.
sections:
  - Global Constraints
  - Tasks 1–8
  - Gates e handoff
related-docs:
  - docs/superpowers/specs/2026-11-10-business-tiers-design.md — design aprovado
agent-protocol:
  - Teste antes de cada mudança, commit por task e nenhuma alteração em Stripe/wallet.
  - Projeções públicas nunca expõem evidência, notas, responsável, aprovadores ou IDs Stripe.
-->

# Business Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar Empresa Amiga/Aliada com evidência, validação anual, hotpage, vitrine e badges SVG sem alterar o fluxo financeiro.

**Architecture:** A entidade `Company` guarda uma evidência atual e os metadados de validação. `CompaniesService` valida o tier e calcula selos; projeções explícitas alimentam admin, hotpage e um sync atômico de badges separado do sync de membros.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Node 24, Astro 7, React 19, MUI 9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-10-business-tiers-design.md`

## Global Constraints

- Backend **0.21.0**, migration **045**, branch `feat/business-tiers-phase6`, PR para `develop`; merge/release somente por comando explícito.
- Não alterar Stripe, cobrança, assinatura, wallet, SortCoins ou congelamento por inadimplência.
- Aliada exige `active`, critério, evidência HTTPS e validação admin; Amiga é o default.
- Aliada vencida não recebe badge e não sofre downgrade/remoção automática.
- Projeções públicas por allowlist: nunca expor responsável, evidência, notas, aprovadores ou IDs Stripe.
- APIs de gestão continuam fora de `/admin/`; listagens seguem `pagination.ts` + `PaginationControls`.

---

### Task 1: Migration 045 e contrato de tier

**Files:**
- Modify: `backend/src/companies/entities/company.entity.ts`
- Create: `backend/src/companies/company-tier.migration.spec.ts`
- Create: `backend/src/migrations/1794700000000-Migration045_BusinessTiers.ts`
- Modify: `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- `CompanyTier = 'amiga' | 'aliada'`.
- `EngagementCriterion = 'workshop' | 'hiring' | 'business_event'`.
- Campos `tier`, `engagementCriterion`, `evidenceUrl`, `validationNotes`, `validatedAt`, `validatedByMemberId`, `sealValidUntil`.

- [x] **Step 1: Escrever teste da migration**

```ts
expect(upSql).toContain('ALTER TABLE "companies" ADD "tier" character varying(32) NOT NULL DEFAULT \'amiga\'');
expect(upSql).toContain('"sealValidUntil" TIMESTAMPTZ');
expect(upSql).toContain('CHECK ("tier" IN (\'amiga\', \'aliada\'))');
expect(upSql).toContain('FOREIGN KEY ("validatedByMemberId") REFERENCES "members"("id") ON DELETE RESTRICT');
expect(downSql).toContain('ALTER TABLE "companies" DROP COLUMN "sealValidUntil"');
```

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/companies/company-tier.migration.spec.ts --runInBand`
Expected: migration inexistente.

- [x] **Step 3: Implementar entidade e migration**

```ts
export enum CompanyTier { AMIGA = 'amiga', ALIADA = 'aliada' }
export enum EngagementCriterion { WORKSHOP = 'workshop', HIRING = 'hiring', BUSINESS_EVENT = 'business_event' }
```

Adicionar defaults/checks, FK e down em ordem reversa. Bump `0.21.0`.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/companies/company-tier.migration.spec.ts --runInBand && npm run build`
Commit: `feat(fase-6): adiciona modelo de Business tiers`

### Task 2: Validação de Aliada e auditoria

**Files:**
- Modify: `backend/src/companies/dto/company.dto.ts`
- Modify: `backend/src/companies/companies.service.ts`, `companies.service.spec.ts`
- Modify: `backend/src/companies/companies.controller.ts`, `companies.controller.spec.ts`
- Modify: `backend/src/companies/companies.module.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`, `backend/src/audit/audit-category.spec.ts`

**Interfaces:**
- `UpdateCompanyTierDto { tier, engagementCriterion?, evidenceUrl?, validationNotes? }`.
- `updateTier(id,dto,actor): Promise<Company>`.
- Novas ações `COMPANY_TIER_VALIDATED` e `COMPANY_TIER_DOWNGRADED`.

- [x] **Step 1: Escrever testes de validação**

```ts
await expect(service.updateTier('company-1', { tier: 'aliada' }, admin)).rejects.toThrow(BadRequestException);
await expect(service.updateTier('company-1', { tier: 'aliada', engagementCriterion: 'workshop', evidenceUrl: 'http://insecure.test' }, admin)).rejects.toThrow(BadRequestException);
const aliada = await service.updateTier('company-1', { tier: 'aliada', engagementCriterion: 'workshop', evidenceUrl: 'https://drive.google.com/evidence' }, admin);
expect(aliada).toMatchObject({ tier: 'aliada', validatedByMemberId: admin.sub });
expect(aliada.sealValidUntil.getUTCFullYear()).toBe(aliada.validatedAt.getUTCFullYear() + 1);
await service.updateTier('company-1', { tier: 'amiga' }, admin);
expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.COMPANY_TIER_DOWNGRADED }));
```

Incluir status não `active`, evidência prévia reutilizada e admin obrigatório.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/companies/companies.service.spec.ts src/companies/companies.controller.spec.ts --runInBand`
Expected: método/DTO inexistente.

- [x] **Step 3: Implementar validação e rota**

```ts
if (dto.tier === CompanyTier.ALIADA) {
  if (company.status !== CompanyStatus.ACTIVE) throw new BadRequestException('Aliada exige apoio ativo.');
  const criterion = dto.engagementCriterion ?? company.engagementCriterion;
  const evidence = dto.evidenceUrl ?? company.evidenceUrl;
  if (!criterion || !evidence) throw new BadRequestException('Informe critério e evidência.');
  this.storage.validateReceiptUrl(evidence);
  company.engagementCriterion = criterion;
  company.evidenceUrl = evidence;
  company.validatedAt = new Date();
  company.sealValidUntil = new Date(company.validatedAt);
  company.sealValidUntil.setUTCFullYear(company.sealValidUntil.getUTCFullYear() + 1);
  company.validatedByMemberId = actor.sub;
}
company.tier = dto.tier;
```

Salvar uma única entidade e auditar depois do save. Importar `StorageModule` e `AuditModule`. `PATCH /companies/:id/tier` usa `JwtAuthGuard` + `RolesGuard(ADMIN)` e recebe o ator.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/companies src/audit/audit-category.spec.ts --runInBand && npm run build`
Commit: `feat(fase-6): valida Empresa Aliada com evidência`

### Task 3: Projeções públicas e selos vigentes

**Files:**
- Modify: `backend/src/companies/companies.service.ts`, `companies.service.spec.ts`
- Modify: `backend/src/companies/companies.controller.ts`, `companies.controller.spec.ts`

**Interfaces:**
- `isSealActive(company,now): boolean`.
- `listPublicBadges(now = new Date())`: `{id,name,tradeName,tier,sealValidUntil}[]`.
- Sponsors ganham `tier`, `sealValidUntil`, `sealActive`.

- [x] **Step 1: Escrever testes de projeção**

```ts
const payload = await service.listSponsors();
expect(payload[0]).toMatchObject({ tier: 'aliada', sealActive: true });
expect(payload[0]).not.toHaveProperty('responsibleMemberId');
expect(payload[0]).not.toHaveProperty('stripeCustomerId');
expect(payload[0]).not.toHaveProperty('evidenceUrl');
await expect(service.listPublicBadges()).resolves.toEqual([{
  id: 'company-1', name: 'Empresa', tradeName: null, tier: 'aliada', sealValidUntil: new Date('2027-11-10T00:00:00.000Z'),
}]);
```

Cobrir Amiga ativa, Aliada vencida fora do badge e apoio inativo fora dos dois públicos.

- [x] **Step 2: Confirmar falha**

Run: `cd backend && npx jest src/companies --runInBand`
Expected: projeção ausente ou campos internos expostos.

- [x] **Step 3: Implementar allowlists**

```ts
const sealActive = company.status === CompanyStatus.ACTIVE
  && (company.tier === CompanyTier.AMIGA
    || (company.sealValidUntil !== null && company.sealValidUntil > now));
return { id: company.id, name: company.name, tradeName: company.tradeName, tier: company.tier, sealValidUntil: company.sealValidUntil };
```

Manter métricas públicas atuais, removendo o spread da entidade. `GET /companies/badges/public` antes de `GET /companies/:id/public`.

- [x] **Step 4: Verificar e commit**

Run: `cd backend && npx jest src/companies --runInBand && npm run build`
Commit: `feat(fase-6): projeta patrocinadores e selos sem dados internos`

### Task 4: Due diligence no admin

**Files:**
- Modify: `frontend/src/components/islands/admin/empresas/EmpresasApp.tsx`
- Modify: `frontend/src/components/islands/admin/empresas/__tests__/empresas.test.tsx`

**Interfaces:**
- `PATCH /companies/:id/tier` com critério, evidência e notas.
- Empresa exibe tier, validade e `sealActive`.

- [x] **Step 1: Escrever teste do diálogo**

```tsx
await user.click(await screen.findByRole('button', { name: 'Validar como Aliada' }));
await user.selectOptions(screen.getByLabelText('Critério'), 'workshop');
await user.type(screen.getByLabelText('URL da evidência'), 'https://drive.google.com/evidence');
await user.click(screen.getByRole('button', { name: 'Confirmar validação' }));
expect(call(`/companies/${company.id}/tier`, 'PATCH')).toBeDefined();
expect(await screen.findByText(/empresa validada como Aliada/i)).toBeInTheDocument();
```

Adicionar erro de evidência exibido e ação `Definir como Amiga`.

- [x] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/empresas`
Expected: controles inexistentes.

- [x] **Step 3: Implementar tier e diálogo**

```tsx
const response = await authFetch(`/companies/${editing.id}/tier`, {
  method: 'PATCH',
  body: JSON.stringify({ tier, engagementCriterion, evidenceUrl, validationNotes }),
});
```

Usar `Dialog`, labels nativos, `Alert`, erro server-side e estado renovação pendente. Recarregar a lista após sucesso.

- [x] **Step 4: Verificar e commit**

Run: `cd frontend && npx vitest run src/components/islands/admin/empresas && npm run check`
Commit: `feat(fase-6): adiciona due diligence ao admin de empresas`

### Task 5: Cartão de badge em Minha Empresa

**Files:**
- Create: `frontend/src/components/islands/member/company/CompanyBadgeCard.tsx`, `CompanyBadgeCard.test.tsx`
- Modify: `frontend/src/components/islands/member/company/types.ts`
- Modify: `frontend/src/components/islands/member/company/MyCompanyApp.tsx`

**Interfaces:**
- `Company` ganha `tier`, `sealValidUntil`, `sealActive`.
- `CompanyBadgeCard({ company })` usa `/badges/empresas/${company.id}.svg`.

- [x] **Step 1: Escrever teste de elegibilidade**

```tsx
renderWithMui(<CompanyBadgeCard company={{ ...company, tier: 'aliada', sealActive: true }} />);
expect(screen.getByRole('img', { name: 'Selo Empresa Aliada Codaqui' })).toHaveAttribute('src', `/badges/empresas/${company.id}.svg`);
expect(screen.getByDisplayValue(/!\[Selo Empresa Aliada Codaqui\]/)).toBeInTheDocument();
rerender(<CompanyBadgeCard company={{ ...company, tier: 'aliada', sealActive: false }} />);
expect(screen.getByText(/renovação pendente/i)).toBeInTheDocument();
expect(screen.queryByRole('img')).not.toBeInTheDocument();
```

- [x] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/components/islands/member/company/CompanyBadgeCard.test.tsx`
Expected: componente inexistente.

- [x] **Step 3: Implementar preview e snippets**

```tsx
const badgePath = `/badges/empresas/${company.id}.svg`;
const markdown = `![Selo ${label}](${origin}${badgePath})`;
```

Mostrar preview, campo somente leitura Markdown/HTML e estado sem badge. Integrar na tela de Minha Empresa sem alterar distribuição/carteira.

- [x] **Step 4: Verificar e commit**

Run: `cd frontend && npx vitest run src/components/islands/member/company && npm run check`
Commit: `feat(fase-6): mostra selo na área da empresa`

### Task 6: Hotpage e tiers nos patrocinadores

**Files:**
- Create: `frontend/src/pages/empresas.astro`
- Modify: `frontend/src/components/islands/SponsorsIsland.tsx`
- Create: `frontend/src/components/islands/SponsorsIsland.test.tsx`

**Interfaces:**
- `Sponsor` ganha `tier`, `sealValidUntil`, `sealActive`.
- `/participe/apoiar?modo=empresa` continua como CTA de captação.

- [x] **Step 1: Escrever teste da vitrine**

```tsx
renderWithMui(<SponsorsIsland />);
expect(await screen.findByText('Empresa Aliada Codaqui')).toBeInTheDocument();
expect(screen.getByText('Empresa Amiga Codaqui')).toBeInTheDocument();
expect(screen.getByText('Renovação pendente')).toBeInTheDocument();
```

Mockar Amiga ativa, Aliada vigente e Aliada vencida; apoiador vencido continua visível.

- [x] **Step 2: Confirmar falha**

Run: `cd frontend && npx vitest run src/components/islands/SponsorsIsland.test.tsx`
Expected: labels inexistentes.

- [x] **Step 3: Implementar hotpage e chips**

```astro
<PublicLayout title="Empresas | CODAQUI.dev" description="Apoie a Codaqui como Empresa Amiga ou Aliada.">
  <PageHero eyebrow="Empresas" title="Apoio que vira oportunidade" subtitle="Escolha o nível de engajamento da sua empresa." />
  <SponsorsIsland client:visible />
</PublicLayout>
```

Incluir proposta de valor, tabela Amiga × Aliada, benefícios, captação, jornada de validação e vitrine. `SponsorsIsland` usa os novos campos sem esconder Aliada vencida.

- [x] **Step 4: Verificar e commit**

Run: `cd frontend && npx vitest run src/components/islands/SponsorsIsland.test.tsx && npm run check`
Commit: `feat(fase-6): publica hotpage e tiers de apoiadores`

### Task 7: Sync atômico e workflow de badges PJ

**Files:**
- Create: `scripts/sync-company-badges.mjs`, `scripts/sync-company-badges.test.mjs`
- Create: `.github/workflows/sync-company-badges.yml`
- Modify: `package.json`, `Makefile`, `DEVELOPMENT.md`

**Interfaces:**
- `COMPANY_BADGES_API_URL`, default `http://localhost:3001`.
- `GET /companies/badges/public` → `static/badges/empresas/<uuid>.svg`.
- Workflow diário 06:19 UTC + dispatch, fora do agregador `npm run sync`.

- [x] **Step 1: Escrever testes do sync**

```js
await syncCompanyBadges({ outputDir, fetchImpl: async () => jsonResponse([validCompany]) });
assert.match(await readFile(path.join(outputDir, `${validCompany.id}.svg`), 'utf8'), /Empresa Aliada Codaqui/);
await assert.rejects(syncCompanyBadges({ outputDir, fetchImpl: async () => jsonResponse({}, 500) }));
assert.equal(await readFile(previousBadge, 'utf8'), previousContent);
```

Cobrir XML hostil, validação completa, remoção de obsoletos, erro de rename e restauração.

- [x] **Step 2: Confirmar falha**

Run: `node --test scripts/sync-company-badges.test.mjs`
Expected: script inexistente.

- [x] **Step 3: Implementar script e workflow**

```js
const desired = new Map(companies.map((company) => [`${company.id}.svg`, renderCompanyBadge(company)]));
await writeFileAtomic(outputFile, svg);
```

Escapar XML, validar UUID/nome/tier/data, escrever temporário + rename, apagar obsoletos só após sucesso e restaurar em falha. Criar `sync:company-badges` e `make sync-company-badges`.

- [x] **Step 4: Verificar e commit**

Run: `npm run test:scripts`
Commit: `feat(fase-6): sincroniza badges de empresas atomicamente`

### Task 8: E2E, ADR 010 e handoff

**Files:**
- Create: `backend/test/business-tiers.e2e-spec.ts`
- Create: `docs/adrs/010-business-tiers.md`
- Modify: `docs/plans/codaqui-1-0/README.md`, `docs/README.md`, `AGENTS.md`, `DEVELOPMENT.md`
- Modify: `docs/modules/privacy/treatments.md`

**Interfaces:**
- Jornada real `Amiga → Aliada → badge → expiração → ausência → renovação`.
- Migration 045 down/up preservando empresas, assinaturas e wallets.

- [x] **Step 1: Escrever e rodar E2E em dump isolado**

```ts
await request(app.getHttpServer()).patch(`/companies/${companyId}/tier`).set(asAdmin).send({ tier: 'aliada', engagementCriterion: 'workshop', evidenceUrl: 'https://drive.google.com/evidence' }).expect(200);
expect((await request(app.getHttpServer()).get('/companies/badges/public').expect(200)).body).toHaveLength(1);
await dataSource.query('UPDATE companies SET "sealValidUntil" = $1 WHERE id = $2', [past, companyId]);
expect((await request(app.getHttpServer()).get('/companies/badges/public').expect(200)).body).toHaveLength(0);
```

Usar banco `codaqui_business_test`, validar down/up, renovar e limpar fixtures/banco. Confirmar que Stripe/wallet não mudam e que sponsors não contém campos internos.

- [x] **Step 2: Rodar gates completos**

Run: `cd backend && npm run build && npx jest --silent`
Run: `npm run test:scripts`
Run: `make astro-verify && make astro-verify-tenants`

- [x] **Step 3: Documentar e commit**

Registrar ADR 010 com tier, evidência, validade, projeções, badges e rollout. Marcar Fase 6 sem apagar releases anteriores pendentes.
Commit: `docs(fase-6): registra Business tiers e handoff`

- [ ] **Step 4: Abrir PR e apresentar integração**

Push de `feat/business-tiers-phase6`, abrir PR para `develop`, acompanhar CI/Sonar/Copilot e corrigir apontamentos. Não fazer merge, release 0.21.0, sync real ou alterar produção sem comando explícito.
