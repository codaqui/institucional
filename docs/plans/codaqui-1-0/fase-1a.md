<!-- AGENT-INDEX
purpose: Plano executável da Fase 1a do Codaqui 1.0.0 — fundações de dados, RBAC, comunidades, diretorias, E1, R1 e transversais aprovadas.
audience: AI agents e mantenedores executando a Fase 1a.
status: concluída em 2026-11-03 (backend 0.12.3, migrations 026–031 validadas com dump PostgreSQL e gates completos).
sections:
  - Constraints globais e sequência de migrations
  - Mapa de arquivos
  - Tasks 1–11 com TDD, comandos e commits
  - Critérios de pronto e handoff
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe e escopo aprovado
  - docs/plans/codaqui-1-0/rbac.md — contrato de roles e designations
  - docs/plans/codaqui-1-0/transversais.md — Turnstile e retenção
  - docs/plans/codaqui-1-0/eca-lgpd.md — sinalização 18+
  - AGENTS.md — gates, proxy, paginação e convenções
agent-protocol:
  - Não iniciar implementação sem comando explícito do mantenedor.
  - Executar as tasks em ordem, uma branch e um PR para a fase, com um commit por task.
  - Autônoma, D2, split 6b, profileVisibility, guest tokens e Fase 2 estão fora deste plano.
-->

# Fase 1a — Fundações de Dados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as fundações do Codaqui 1.0.0 sem alterar os fluxos atuais de eventos, doações ou tenants: designations/RBAC, diretorias, comunidades com snapshot, E1, R1, retenção de auditoria, Turnstile e sinalização 18+.

**Architecture:** Uma branch `feat/fase-1a-fundacoes` criada a partir de `develop`, um PR e um commit por task. O backend ganha módulos de domínio com APIs fora do prefixo `/admin/`; o frontend mantém páginas administrativas finas em Astro e ilhas MUI. Migrações são aditivas, snapshots preservam o shape público atual e o backend sobe uma única vez para `0.12.0` antes do merge.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Astro 7, React 19, MUI 9, Vitest 3, Cloudflare Pages/Turnstile, Node 24.

**Spec:** `docs/plans/codaqui-1-0/README.md`, com os contratos detalhados em `rbac.md`, `transversais.md` e `eca-lgpd.md`.

## Global Constraints

- Não implementar Autônoma, D2, split 6b, `profileVisibility`, guest tokens ou horas nesta fase.
- Não criar `responsibleMemberId`, `directorMemberId`, `directorate_members` nem tabelas paralelas de vínculo: usar `member_designations`.
- Não migrar `event_organizer_ownerships` na 1a; seed e cutover ficam na Fase 2, com dual-write previamente planejado.
- Manter os seis registros de `frontend/src/data/communities.ts`; `devparana`, `elasnocodigo`, `tisocial` e `campostechpg` nascem Integradas sem responsável fabricado. Os três primeiros têm `siteEnabled=true`; CamposTech mantém `siteEnabled=false` por usar somente o portal. Responsável é obrigatório para selo/painel, não para preservar sites/doações existentes.
- APIs de gestão usam `/designations`, `/directorates`, `/communities`, `/settings` e `/audit`; páginas `/admin/*` continuam sendo assets estáticos. Nunca alargar o proxy com `/admin/`.
- Novas listagens usam `PaginatedResultDto`, DTO com `@Type(() => Number)`, limites de `frontend/src/lib/pagination.ts` e `PaginationControls` quando houver mais de uma página.
- Zero hex fora de `tokens.css`; MUI 9 com `sx`/`slotProps`; Grid com `size`.
- Toda mudança sensível grava audit de governo. Nenhum segredo real entra em código, fixtures ou documentação.
- Migrations: `026` designations, `027` directorates, `028` communities, `029` e-mail, `030` auditoria/settings, `031` eventos 18+.
- Gates finais obrigatórios: `make astro-verify`, `make astro-verify-tenants`, `npm run test:scripts`, `cd backend && npm run build && npx jest --silent`.

## File Structure

- `backend/src/designations/`: entidade, serviço, guard, controller e sync de roles derivadas.
- `backend/src/directorates/`: CRUD de diretorias e regras de escopo por designation.
- `backend/src/communities/`: entidade, API pública/gestão, selo e seed histórico JSON.
- `backend/src/settings/`: configuração administrada de retenção.
- `backend/src/common/turnstile/`: service e guard opt-in, sem dependência nova.
- `backend/src/notifications/`, `ledger/`, `audit/`, `events/`: extensões E1, R1, G6 e ECA.
- `scripts/sync-communities.mjs`: snapshot atômico em `static/communities/index.json`.
- `frontend/src/lib/communities.ts`: tipos e leitura do snapshot em build time.
- `frontend/src/components/islands/admin/{designations,directorates,communities,settings}/`: telas de gestão.
- `frontend/src/components/islands/ui/DateRangeControls.tsx`: filtro de datas compartilhado.

### Task 1: `member_designations` e núcleo RBAC

**Files:**
- Create: `backend/src/migrations/1793289600000-Migration026_MemberDesignations.ts`
- Create: `backend/src/designations/entities/member-designation.entity.ts`
- Create: `backend/src/designations/designations.service.ts`
- Create: `backend/src/designations/designations.service.spec.ts`
- Create: `backend/src/designations/designations.module.ts`
- Modify: `backend/src/members/entities/member.entity.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `TargetType`, `Designation`, `DesignationStatus`, `MemberDesignation`, `DesignationsService.hasDesignation()`, `grant()`, `confirm()`, `revoke()`, `listActive()`.
- Produces: roles derivadas `diretor`, `voluntario`, `mentor`, `gestor_universitario`; nenhuma role `fundador_comunidade`.

- [x] **Step 1: Write the failing tests**

```ts
it('grants a director and derives both organizational roles', async () => {
  const designation = await service.grant({
    memberId: 'member-1', targetType: 'directorate', targetId: 'directorate-1',
    designation: 'director', appointedById: 'admin-1',
  }, actor);
  expect(designation.status).toBe('active');
  expect(membersRepo.save).toHaveBeenCalledWith(expect.objectContaining({
    roles: expect.arrayContaining(['membro', 'diretor', 'voluntario']),
  }));
});

it('does not grant a second active responsible for the same community', async () => {
  repo.findOne.mockResolvedValue({ id: 'existing', status: 'active' });
  await expect(service.grant({
    memberId: 'member-2', targetType: 'community', targetId: 'community-1',
    designation: 'responsible', appointedById: 'admin-1',
  }, actor)).rejects.toThrow(ConflictException);
});
```

Run: `cd backend && npx jest src/designations/designations.service.spec.ts --runInBand`
Expected: FAIL porque o módulo não existe.

- [x] **Step 2: Create the migration and entity**

Use `varchar` + `CHECK` para os enums, `uuid` para IDs, `timestamptz` para datas e estes valores:

```ts
export const TARGET_TYPES = [
  'community', 'event', 'ies', 'c4p_campaign', 'extension_project',
  'directorate', 'company', 'entity', 'program',
] as const;
export const DESIGNATIONS = [
  'responsible', 'ambassador', 'organizer', 'evaluator', 'mentor',
  'director', 'maintainer', 'manager', 'volunteer', 'founder',
] as const;
export const DESIGNATION_STATUSES = ['pending', 'active', 'ended', 'removed'] as const;
```

A migration cria índices `(memberId,status)`, `(targetType,targetId,designation,status)`, `(targetType,targetKey,designation,status)`, índice único geral com `NULLS NOT DISTINCT` para evitar duplicatas ativas e índices únicos parciais para responsible/community, ambassador/ies, director/directorate, mentor/extension_project, responsible/company e mentor/program('mentoria') por membro. O `down` remove apenas esses índices e a tabela.

- [x] **Step 3: Implement grant/revoke and derived-role synchronization**

```ts
export const DERIVED_ROLE_RULES = {
  diretor: [{ targetType: 'directorate', designation: 'director' }],
  voluntario: [
    { targetType: 'directorate', designation: 'volunteer' },
    { targetType: 'directorate', designation: 'director' },
  ],
  mentor: [
    { targetType: 'program', targetKey: 'mentoria', designation: 'mentor' },
    { targetType: 'extension_project', designation: 'mentor' },
  ],
  gestor_universitario: [
    { targetType: 'program', targetKey: 'universitario', designation: 'manager' },
  ],
} as const;
```

`grant/confirm/revoke` e `syncMember(memberId)` compartilham uma transação `QueryRunner`; a sync adiciona/remove somente roles derivadas e grava `member.role_derived`. `hasDesignation` consulta o banco com cache de 60 segundos e invalidação por escrita.

- [x] **Step 4: Run the focused tests**

Run: `cd backend && npx jest src/designations/designations.service.spec.ts --runInBand`
Expected: PASS, incluindo idempotência, confirmação `pending → active`, revogação e remoção de roles derivadas.

- [x] **Step 5: Commit**

```bash
git add backend/src/designations backend/src/members/entities/member.entity.ts backend/src/audit/entities/audit-log.entity.ts backend/src/app.module.ts backend/src/migrations/1793289600000-Migration026_MemberDesignations.ts
git commit -m "feat(fase-1a): adiciona designations e roles organizacionais derivadas"
```

### Task 2: Guards, API de designations e proteção de roles manuais

**Files:**
- Create: `backend/src/designations/designations.controller.ts`
- Create: `backend/src/designations/designations.guard.ts`
- Create: `backend/src/designations/designations.decorator.ts`
- Create: `backend/src/designations/designations.controller.spec.ts`
- Create: `frontend/src/lib/use-designations.ts`
- Create: `frontend/src/lib/use-designations.test.tsx`
- Modify: `backend/src/members/members.service.ts`
- Modify: `backend/src/members/members.controller.ts`
- Modify: `frontend/src/components/islands/AppNavIsland.tsx`
- Modify: `frontend/src/components/islands/__tests__/AppNavIsland.test.tsx`
- Modify: `frontend/src/lib/api-proxy-paths.ts`

**Interfaces:**
- `GET /designations/me` → active designations do membro autenticado.
- `POST /designations`, `POST /designations/:id/confirm`, `POST /designations/:id/revoke` → admin.
- `@Designations({ targetType, targetIdParam, designation })` + `DesignationsGuard`.

- [x] **Step 1: Write failing API, role-protection and UI tests**

```ts
it('rejects manual changes to derived roles', async () => {
  await expect(service.adminUpdate('member-1', { roles: ['membro', 'diretor'] }))
    .rejects.toThrow('role derivada');
});
```

```tsx
const designationsState = vi.hoisted(() => ({ data: [] as MyDesignation[] }));
vi.mock('../../../lib/use-designations', () => ({
  useMyDesignations: () => ({
    data: designationsState.data, loading: false, error: '', refresh: vi.fn(),
  }),
}));

it('shows Minha comunidade only with a responsible designation', async () => {
  designationsState.data = [{
    id: 'designation-1', targetType: 'community', targetId: 'community-1',
    targetKey: null, designation: 'responsible',
  }];
  mockLoggedIn(makeUser());
  renderWithMui(<AppNavIsland currentPath="/membro" />);
  expect(await screen.findByText('Minha comunidade')).toBeInTheDocument();
});
```

Run: `cd backend && npx jest src/members src/designations --runInBand`
Run: `cd frontend && npx vitest run src/lib/use-designations.test.tsx src/components/islands/__tests__/AppNavIsland.test.tsx`
Expected: FAIL nos novos casos.

- [x] **Step 2: Implement the guard and endpoints**

O guard lê `req.user.sub`, resolve `targetId` de `req.params[targetIdParam]`, aceita admin e delega ao service. `MembersService.adminUpdate` compara o conjunto anterior e o novo: qualquer adição/remoção de `DERIVED_ROLES` lança `ConflictException` antes do update. A validação permanece no service, não apenas no controller.

- [x] **Step 3: Implement the frontend hook and navigation filter**

```ts
export interface MyDesignation {
  id: string;
  targetType: TargetType;
  targetId: string | null;
  targetKey: string | null;
  designation: Designation;
}
export function useMyDesignations(): {
  data: MyDesignation[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
```

O hook usa `authFetch`, `parseAuthJson` e `resolveApiUrl`. `NavItem.designations` é opcional; visibilidade é `isAdmin || roleMatch || designationMatch`. Adicionar `/designations/` a `API_PREFIXES` e testar que `/admin/designations` continua fora do proxy.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/members src/designations --runInBand`
Run: `cd frontend && npx vitest run src/lib/use-designations.test.tsx src/components/islands/__tests__/AppNavIsland.test.tsx src/lib/api-proxy-paths.test.ts`
Expected: PASS; `JwtStrategy` continua lendo roles frescas do banco a cada request.

- [x] **Step 5: Commit**

```bash
git add backend/src/designations backend/src/members frontend/src/lib/use-designations.ts frontend/src/lib/use-designations.test.tsx frontend/src/components/islands/AppNavIsland.tsx frontend/src/components/islands/__tests__/AppNavIsland.test.tsx frontend/src/lib/api-proxy-paths.ts frontend/src/lib/api-proxy-paths.test.ts
git commit -m "feat(fase-1a): expõe designations e protege roles derivadas"
```

### Task 3: Diretorias sem colunas de vínculo

**Files:**
- Create: `backend/src/migrations/1793289601000-Migration027_Directorates.ts`
- Create: `backend/src/directorates/entities/directorate.entity.ts`
- Create: `backend/src/directorates/directorates.{module,controller,service}.ts`
- Create: `backend/src/directorates/dto/{create-directorate.dto,update-directorate.dto,list-directorates.dto}.ts`
- Create: `backend/src/directorates/directorates.service.spec.ts`
- Create: `frontend/src/pages/admin/diretorias.astro`
- Create: `frontend/src/components/islands/admin/directorates/DirectoratesAdminApp.tsx`
- Create: `frontend/src/components/islands/admin/directorates/DirectoratesAdminApp.test.tsx`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/src/lib/api-proxy-paths.ts`

**Interfaces:**
- `GET /directorates/public` → ativas; `GET /directorates/manage` → paginada admin/diretor.
- `POST /directorates` admin; `PATCH /directorates/:id` admin ou `director` na própria diretoria.
- Diretores e voluntários são geridos pelos endpoints da Task 2.

- [x] **Step 1: Write failing service and island tests**

```ts
it('allows a director to edit only their own directorate', async () => {
  designations.hasDesignation.mockResolvedValue(false);
  await expect(service.update('directorate-2', { name: 'Novo' }, userDirector))
    .rejects.toThrow(ForbiddenException);
});
```

Run: `cd backend && npx jest src/directorates --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/admin/directorates/DirectoratesAdminApp.test.tsx`
Expected: FAIL.

- [x] **Step 2: Implement migration, module and paginated API**

`directorates` contém somente `id`, `slug`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`. `slug` é único; não há `directorMemberId`. `ListDirectoratesDto` usa `DEFAULT_PAGE_SIZE=50` no frontend e cap `100` no backend, envelope `{data,total,page,totalPages,limit}`.

- [x] **Step 3: Implement the admin island**

A página `.astro` usa `AppLayout` e `DirectoratesAdminApp client:only="react"`. A ilha implementa lista, busca server-side, create/edit, ativação e links para conceder diretor/voluntário via `/designations`. Erros usam `Alert` e `extractErrorMessage`; ações de escrita são confirmadas e fazem `refresh()` das designations.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/directorates src/designations --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/admin/directorates`
Expected: PASS, incluindo 403 fora de escopo e paginação.

- [x] **Step 5: Commit**

```bash
git add backend/src/directorates backend/src/migrations/1793289601000-Migration027_Directorates.ts backend/src/app.module.ts frontend/src/pages/admin/diretorias.astro frontend/src/components/islands/admin/directorates frontend/src/lib/api-proxy-paths.ts
git commit -m "feat(fase-1a): adiciona diretorias com escopo por designation"
```

### Task 4: Comunidades, seed completo e checkout validado

**Files:**
- Create: `scripts/export-community-seed.mjs`
- Create: `backend/src/communities/seed/communities.json` (gerado pelo script)
- Create: `backend/src/migrations/1793289602000-Migration028_Communities.ts`
- Create: `backend/src/communities/entities/community.entity.ts`
- Create: `backend/src/communities/communities.{module,controller,service}.ts`
- Create: `backend/src/communities/dto/{create-community.dto,update-community.dto,list-communities.dto,seal-community.dto}.ts`
- Create: `backend/src/communities/communities.service.spec.ts`
- Modify: `backend/src/stripe/stripe.controller.ts`
- Modify: `backend/src/stripe/stripe.controller.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/src/lib/api-proxy-paths.ts`

**Interfaces:**
- `GET /communities/public` preserva `id`, `name`, `emoji`, `logo`, `description`, `location`, `founded`, `links`, `socialProfiles`, `tags` e acrescenta `slug`, `level`, `status`, `seal*`, `siteEnabled`, `siteDomain`, `responsible`.
- `GET /communities/manage`, `POST /communities`, `PATCH /communities/:id`, `POST /communities/:id/seal/request`, `POST /communities/:id/seal`.
- Não existem campos `maintainer*`, `payout*`, `platformFeePct`, `isActive` ou `responsibleMemberId`.

- [x] **Step 1: Write failing seed, seal and checkout tests**

```ts
const bodyFor = (communityId: string) => ({ amount: 1000, communityId });

it('rejects seal without an active responsible designation', async () => {
  designations.hasDesignation.mockResolvedValue(false);
  await expect(service.grantSeal('community-1', { validUntil: '2027-10-29' }, admin))
    .rejects.toThrow('responsável ativo');
});

it('rejects donation directed to a partner community', async () => {
  communities.findActiveForDonations.mockResolvedValue(null);
  await expect(controller.createCheckoutSession(bodyFor('parceira'), req)).rejects.toThrow(BadRequestException);
});

it('preserves the existing CamposTech checkout as integrated', async () => {
  communities.findActiveForDonations.mockResolvedValue({
    slug: 'campostechpg', level: 'integrada', status: 'active',
  });
  stripeService.createCheckoutSession.mockResolvedValue({ clientSecret: 'secret' });
  await expect(controller.createCheckoutSession(bodyFor('campostechpg'), req))
    .resolves.toEqual({ clientSecret: 'secret' });
});
```

Run: `cd backend && npx jest src/communities src/stripe/stripe.controller.spec.ts --runInBand`
Expected: FAIL.

- [x] **Step 2: Generate the historical seed and create the migration**

```js
import { writeFile } from 'node:fs/promises';
import { communities } from '../frontend/src/data/communities.ts';
const integrated = new Set(['devparana', 'elasnocodigo', 'tisocial', 'campostechpg']);
const enabledTenants = new Set(['devparana', 'elasnocodigo', 'tisocial']);
const domains = { devparana: 'devparana.org', elasnocodigo: 'elasnocodigo.com.br', tisocial: 'tisocial.org.br' };
const seed = communities.map((community) => ({
  slug: community.id, name: community.name, description: community.description,
  emoji: community.emoji, logoUrl: community.logo, location: community.location ?? null,
  founded: community.founded ?? null, links: community.links,
  socialProfiles: community.socialProfiles ?? [], tags: community.tags,
  level: integrated.has(community.id) ? 'integrada' : 'parceira', status: 'active',
  sealStatus: 'none', siteEnabled: enabledTenants.has(community.id),
  siteDomain: domains[community.id] ?? null,
}));
await writeFile('backend/src/communities/seed/communities.json', `${JSON.stringify(seed, null, 2)}\n`);
```

Run: `node scripts/export-community-seed.mjs`
Expected: seis objetos, quatro Integradas e duas Parceiras, sem perda de `links`, `socialProfiles` ou `tags`; CamposTech Integrada com `siteEnabled=false`.

A migration usa `ON CONFLICT ("slug") DO NOTHING`, grava `sealGrantedById/validUntil` apenas quando houver dado real e reporta as quatro Integradas sem responsável como pendência de governança, sem falhar.

- [x] **Step 3: Implement public/manage APIs and donation validation**

A entidade usa colunas explícitas para dados centrais e `jsonb` para `links`/`socialProfiles`; `tags` é `text[]`. O selo exige designation `responsible` ativa, `sealValidUntil` 1 ano após a concessão e `sealNotes` com a avaliação manual da diretoria; grava audit `community.seal_granted`. Stripe aceita `communityId` somente de comunidade `active` com nível `integrada`; `autonoma` ainda não existe nesta fase e `parceira` não recebe direcionamento. O comportamento sem `communityId` permanece inalterado.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/communities src/stripe/stripe.controller.spec.ts src/designations --runInBand`
Expected: PASS, incluindo slug duplicado, selo com responsável e compatibilidade de doações gerais.

- [x] **Step 5: Commit**

```bash
git add scripts/export-community-seed.mjs backend/src/communities backend/src/migrations/1793289602000-Migration028_Communities.ts backend/src/stripe/stripe.controller.ts backend/src/stripe/stripe.controller.spec.ts backend/src/app.module.ts frontend/src/lib/api-proxy-paths.ts
git commit -m "feat(fase-1a): cadastra comunidades e valida doações direcionadas"
```

### Task 5: Snapshot e frontend de comunidades

**Files:**
- Create: `scripts/sync-communities.mjs`
- Create: `scripts/sync-communities.test.mjs`
- Create: `.github/workflows/sync-community-snapshots.yml`
- Create: `static/communities/index.json` (gerado contra o backend local migrado/seedado)
- Create: `frontend/src/lib/communities.ts`
- Create: `frontend/src/lib/communities.test.ts`
- Create: `frontend/src/pages/comunidades/index.astro`
- Create: `frontend/src/pages/admin/comunidades.astro`
- Create: `frontend/src/components/islands/admin/communities/CommunitiesAdminApp.tsx`
- Create: `frontend/src/components/islands/admin/communities/CommunitiesAdminApp.test.tsx`
- Modify: `frontend/scripts/copy-snapshots.mjs`
- Modify: `frontend/src/components/astro/CommunitySection.astro`
- Modify: `package.json`
- Modify: `Makefile`

**Interfaces:**
- `loadCommunitiesIndex(): CommunityIndexFile` lê `static/communities/index.json` em build time.
- `sync:communities` grava por arquivo temporário + rename e não altera o snapshot se a API falhar.

- [x] **Step 1: Write failing script and frontend tests**

```js
test('preserves the previous snapshot when the API fails', async () => {
  await writeFile(outputFile, '{"communities":[{"slug":"previous"}]}');
  await assert.rejects(syncCommunities({ apiUrl: 'http://127.0.0.1:1', outputFile }));
  assert.match(await readFile(outputFile, 'utf8'), /previous/);
});
```

Run: `node --test scripts/sync-communities.test.mjs`
Run: `cd frontend && npx vitest run src/lib/communities.test.ts src/components/islands/admin/communities/CommunitiesAdminApp.test.tsx`
Expected: FAIL.

- [x] **Step 2: Implement sync, loader and public rendering**

O snapshot contém `{generatedAt, communities}` e inclui somente `status='active'`. `copy-snapshots.mjs` passa a copiar também `communities/index.json`. `/comunidades` e `CommunitySection` consomem o mesmo loader; cards mostram nível/selo e preservam os links atuais. Não mudar configs nem conteúdo canônico em `comunidades/`.

- [x] **Step 3: Implement the admin island and workflow**

A ilha cobre CRUD, mudança Parceira↔Integrada, solicitação/concessão de selo e atribuição de responsável por designation. O workflow roda de hora em hora e por dispatch, com permissões mínimas, `npm run sync:communities` e commit somente quando houver diff.

- [x] **Step 4: Generate and verify the real snapshot**

Run: `make db-up && make migration-run`
Run: `make backend-start` em um segundo terminal e aguardar `GET http://localhost:3001/health` responder 200.
Run: `node scripts/sync-communities.mjs && node --test scripts/sync-communities.test.mjs`
Run: `cd frontend && npx vitest run src/lib/communities.test.ts src/components/islands/admin/communities`
Expected: seis comunidades no JSON; testes PASS. Encerrar o backend local ao concluir os demais fluxos.

- [x] **Step 5: Commit**

```bash
git add scripts/sync-communities.mjs scripts/sync-communities.test.mjs .github/workflows/sync-community-snapshots.yml static/communities/index.json frontend/src/lib/communities.ts frontend/src/lib/communities.test.ts frontend/src/pages/comunidades frontend/src/pages/admin/comunidades.astro frontend/src/components/islands/admin/communities frontend/src/components/astro/CommunitySection.astro frontend/scripts/copy-snapshots.mjs package.json Makefile
git commit -m "feat(fase-1a): publica snapshot e gestão de comunidades"
```

### Task 6: E1 — e-mails desligados, contrato e retenção

**Files:**
- Create: `backend/src/migrations/1793289603000-Migration029_EmailOperations.ts`
- Modify: `backend/src/notifications/entities/email-log.entity.ts`
- Modify: `backend/src/notifications/email.service.ts`
- Modify: `backend/src/notifications/email.service.spec.ts`
- Modify: `backend/src/notifications/notifications.controller.ts`
- Modify: `backend/src/notifications/default-templates.ts`
- Modify: `backend/src/events/events.service.ts`
- Modify: `frontend/src/components/islands/admin/emails/EmailsApp.tsx`
- Modify: `frontend/src/components/islands/admin/emails/__tests__/emails.test.tsx`

**Interfaces:**
- `EmailStatus = sent | failed | skipped`.
- `summary.byTemplate[template] = { sent, failed, skipped }`.
- `GET /notifications/status` → `{ configured: boolean }`.
- `EMAIL_LOG_RETENTION_DAYS=365` e cron diário de retenção.

- [x] **Step 1: Write failing contract and behavior tests**

```ts
it('records skipped instead of failed when SMTP is not configured', async () => {
  provider.isConfigured.mockReturnValue(false);
  const log = await service.sendTemplate('event-registration-confirmation', 'person@example.test', ctx);
  expect(log.status).toBe('skipped');
  expect(provider.send).not.toHaveBeenCalled();
});

it('does not let a skipped reminder dedupe a later real delivery', async () => {
  emailLogRepo.find.mockResolvedValue([{ status: 'skipped', registrationId: 'registration-1' }]);
  await service.sendDayBeforeReminders();
  expect(provider.send).toHaveBeenCalled();
});
```

Run: `cd backend && npx jest src/notifications/email.service.spec.ts --runInBand`
Expected: FAIL.

- [x] **Step 2: Implement skipped semantics, summary and retention**

`sendTemplate` registra `skipped/SMTP_NOT_CONFIGURED`; `resend` retorna 409 amigável quando desligado. A deduplicação dos crons considera apenas `sent` e `failed`. A migration adiciona o enum `skipped`, índice `(template,registrationId)` e o cron apaga somente logs anteriores a 365 dias. A summary agrega por template+status e inclui `skipped` no total, sem somá-lo a `failed`.

- [x] **Step 3: Add cancellation/refund notification and admin status**

Criar `event-registration-cancelled` no registry com contexto real (`attendeeName`, `eventTitle`, `eventStartAt`, `eventTimeZone`). Após refund/cancelamento confirmado, chamar `EmailService` sem transformar falha de e-mail em rollback financeiro. O admin mostra banner quando `configured=false`, filtro/card `skipped` e botão Reenviar para `failed` ou `skipped` quando configurado.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/notifications src/events --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/admin/emails`
Expected: PASS; shape antigo `byTemplate: number` não permanece em nenhum consumidor.

- [x] **Step 5: Commit**

```bash
git add backend/src/migrations/1793289603000-Migration029_EmailOperations.ts backend/src/notifications backend/src/events/events.service.ts frontend/src/components/islands/admin/emails
git commit -m "fix(fase-1a): corrige operação e métricas de e-mails"
```

### Task 7: R1 — filtros e exportação CSV server-side

**Files:**
- Create: `backend/src/common/csv.ts`
- Create: `backend/src/common/csv.spec.ts`
- Modify: `backend/src/ledger/dto/get-transactions-query.dto.ts`
- Modify: `backend/src/ledger/ledger.service.ts`
- Modify: `backend/src/ledger/ledger.controller.ts`
- Modify: `backend/src/ledger/ledger.controller.spec.ts`
- Create: `frontend/src/components/islands/ui/DateRangeControls.tsx`
- Create: `frontend/src/components/islands/ui/DateRangeControls.test.tsx`
- Modify: `frontend/src/components/islands/TransactionTable.tsx`
- Create: `frontend/src/components/islands/__tests__/TransactionTable.test.tsx`

**Interfaces:**
- Query `from`/`to` ISO, com `from <= to` e `to` inclusivo até o fim do dia.
- `GET /ledger/accounts/:id/transactions/export` público, mesmo conjunto já visível da conta.
- `GET /ledger/transactions/export` admin/finance-analyzer, todas as contas.
- CSV UTF-8 com BOM e proteção contra formula injection.

- [x] **Step 1: Write failing CSV and range tests**

```ts
it('escapes formulas and preserves Excel-compatible CSV', () => {
  const csv = toCsv(['description'], [{ description: '=HYPERLINK("https://evil.example")' }]);
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("'=HYPERLINK");
});

it('rejects from after to', async () => {
  await expect(service.getAccountTransactions('account-1', 1, 10, { from: '2026-10-30', to: '2026-10-29' }))
    .rejects.toThrow(BadRequestException);
});
```

Run: `cd backend && npx jest src/common/csv.spec.ts src/ledger --runInBand`
Expected: FAIL.

- [x] **Step 2: Implement shared range filtering and exports**

Extrair um único `TransactionFilters` para listagem/exportação. Declarar `transactions/export` antes de `transactions/:txId` e `accounts/:id/transactions/export` antes da rota paginada equivalente. Resposta usa `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` com slug/data e todas as linhas do range, não apenas a página.

- [x] **Step 3: Replace page-only export in TransactionTable**

`DateRangeControls` controla `from`/`to` com `<input type="date">`, erro textual para range invertido e botão Limpar. A tabela envia os filtros à listagem e o botão Exportar abre a URL server-side com os mesmos filtros; remover `escapeCsvField` e o CSV da página atual.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/common/csv.spec.ts src/ledger --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/ui/DateRangeControls.test.tsx src/components/islands/__tests__/TransactionTable.test.tsx`
Expected: PASS; exportação mantém tipo, busca, dias e range.

- [x] **Step 5: Commit**

```bash
git add backend/src/common/csv.ts backend/src/common/csv.spec.ts backend/src/ledger frontend/src/components/islands/ui/DateRangeControls.tsx frontend/src/components/islands/ui/DateRangeControls.test.tsx frontend/src/components/islands/TransactionTable.tsx frontend/src/components/islands/__tests__/TransactionTable.test.tsx
git commit -m "feat(fase-1a): exporta transações por faixa de datas"
```

### Task 8: G6 — retenção de auditoria e settings

**Files:**
- Create: `backend/src/migrations/1793289604000-Migration030_AuditRetention.ts`
- Create: `backend/src/settings/entities/app-setting.entity.ts`
- Create: `backend/src/settings/settings.{module,controller,service}.ts`
- Create: `backend/src/settings/settings.service.spec.ts`
- Create: `backend/src/audit/audit-category.ts`
- Create: `frontend/src/pages/admin/configuracoes.astro`
- Create: `frontend/src/components/islands/admin/settings/AuditRetentionSettings.tsx`
- Create: `frontend/src/components/islands/admin/settings/AuditRetentionSettings.test.tsx`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit.service.ts`
- Modify: `backend/src/audit/audit.controller.ts`
- Modify: `backend/src/audit/audit.service.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/src/lib/api-proxy-paths.ts`
- Modify: `.env.example`

**Interfaces:**
- `AuditCategory = governance | operational`; `auditCategory(action)` é a única classificação.
- `GET/PUT /settings/audit-retention`, range `7–365`, admin.
- `AUDIT_OPERATIONAL_RETENTION_DAYS=30` é fallback; setting vence.

- [x] **Step 1: Write failing classification, precedence and purge tests**

```ts
it('never deletes governance logs', async () => {
  await service.cleanupOperational();
  expect(repo.delete).toHaveBeenCalledWith(expect.objectContaining({ category: 'operational' }));
  expect(repo.delete).not.toHaveBeenCalledWith(expect.objectContaining({ category: 'governance' }));
});

it('prefers the admin setting over the environment fallback', async () => {
  settings.getNumber.mockResolvedValue(45);
  expect(await service.getOperationalRetentionDays()).toBe(45);
});
```

Run: `cd backend && npx jest src/audit src/settings --runInBand`
Expected: FAIL.

- [x] **Step 2: Implement migration, classification and retention cron**

A migration adiciona `category`, classifica registros existentes pelo enum atual, zera `ipAddress` nos registros de governo e cria `(category,createdAt)`. Roles, concessões, aprovações e decisões são `governance`; login/checkin/sync/overrides/templates/cancelamentos são `operational`. `AuditService.log` sempre define categoria e grava `ipAddress=null` em governo. Cron diário às 03:17 chama `cleanupOperational`; o endpoint manual usa a mesma política.

- [x] **Step 3: Implement settings API and admin control**

`app_settings` tem `key` único, `value` jsonb, `updatedById`, `updatedAt`. PUT grava audit de governo. A ilha mostra valor efetivo, origem (`setting` ou `env`) e confirmação antes de salvar. Adicionar `/settings/` e `/audit/` ao proxy, nunca `/admin/`.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/audit src/settings --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/admin/settings src/lib/api-proxy-paths.test.ts`
Expected: PASS, incluindo limites 7/365 e governo fora da purga.

- [x] **Step 5: Commit**

```bash
git add backend/src/migrations/1793289604000-Migration030_AuditRetention.ts backend/src/settings backend/src/audit backend/src/app.module.ts frontend/src/pages/admin/configuracoes.astro frontend/src/components/islands/admin/settings frontend/src/lib/api-proxy-paths.ts frontend/src/lib/api-proxy-paths.test.ts .env.example
git commit -m "feat(fase-1a): separa retenção de auditoria operacional e governo"
```

### Task 9: G3 — infraestrutura Turnstile opt-in

**Files:**
- Create: `backend/src/common/turnstile/turnstile.service.ts`
- Create: `backend/src/common/turnstile/turnstile.guard.ts`
- Create: `backend/src/common/turnstile/turnstile.module.ts`
- Create: `backend/src/common/turnstile/turnstile.service.spec.ts`
- Create: `backend/src/common/turnstile/turnstile.guard.spec.ts`
- Create: `frontend/src/components/islands/ui/TurnstileField.tsx`
- Create: `frontend/src/components/islands/ui/TurnstileField.test.tsx`
- Modify: `backend/src/app.module.ts`
- Modify: `.env.example`
- Modify: `frontend/.env.example`

**Interfaces:**
- `TurnstileService.verify(token, remoteIp?, expectedHostname?)`.
- `TURNSTILE_ALLOWED_HOSTNAMES=codaqui.dev,www.codaqui.dev,tisocial.org.br,www.tisocial.org.br,elasnocodigo.com.br,www.elasnocodigo.com.br,devparana.org,www.devparana.org`.
- `TurnstileGuard` lê `turnstileToken` do body ou `cf-turnstile-token`; nenhuma rota existente recebe o guard nesta fase.
- Sem nova dependência npm: usar `fetch` global do Node 24 e script oficial no frontend.

- [x] **Step 1: Write failing verification and fail-closed tests**

```ts
it('rejects a valid token for another hostname', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: 'other.example' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  await expect(service.verify('token', undefined, 'codaqui.dev')).resolves.toBe(false);
});

it('fails closed in production without a secret', async () => {
  await expect(guard.canActivate(contextWithoutToken)).rejects.toThrow(ServiceUnavailableException);
});
```

Run: `cd backend && npx jest src/common/turnstile --runInBand`
Expected: FAIL.

- [x] **Step 2: Implement server verification**

Timeout de 5 segundos com `AbortSignal.timeout(5000)`, POST `application/x-www-form-urlencoded`, exigência de `success===true`, hostname exato e cache em memória do SHA-256 do token por 5 minutos. O guard resolve o frontend pela ordem `Origin`, `Referer`, `X-Forwarded-Host` e então `req.hostname` por compatibilidade, só aceita um hostname exato presente em `TURNSTILE_ALLOWED_HOSTNAMES` e passa esse valor validado ao service — nunca confia em sufixo nem em um host arbitrário. Sem secret: warn/no-op somente fora de produção; produção falha fechada. Testes mockam `fetch`; nenhum teste chama Cloudflare.

- [x] **Step 3: Implement the reusable frontend field**

`TurnstileField` carrega `https://challenges.cloudflare.com/turnstile/v0/api.js` uma única vez, renderiza o widget apenas com `PUBLIC_TURNSTILE_SITE_KEY`, devolve `onTokenChange(token)` e expõe estado de erro/indisponível. Sem chave em dev, renderiza aviso somente em desenvolvimento; produção não finge sucesso.

- [x] **Step 4: Run focused tests**

Run: `cd backend && npx jest src/common/turnstile --runInBand`
Run: `cd frontend && npx vitest run src/components/islands/ui/TurnstileField.test.tsx`
Expected: PASS para sucesso, hostname errado, timeout, replay e produção sem secret.

- [x] **Step 5: Commit**

```bash
git add backend/src/common/turnstile backend/src/app.module.ts frontend/src/components/islands/ui/TurnstileField.tsx frontend/src/components/islands/ui/TurnstileField.test.tsx .env.example frontend/.env.example
git commit -m "feat(fase-1a): prepara verificação Cloudflare Turnstile"
```

### Task 10: ECA — `adultOnly`, `venueType` e aviso estático

**Files:**
- Create: `backend/src/migrations/1793289605000-Migration031_EventAdultContent.ts`
- Create: `frontend/src/lib/adult-content.ts`
- Create: `frontend/src/lib/adult-content.test.ts`
- Create: `frontend/src/components/astro/AdultContentNotice.astro`
- Modify: `backend/src/events/entities/managed-event.entity.ts`
- Modify: `backend/src/events/dto/event.dto.ts`
- Modify: `backend/src/events/events.service.ts`
- Modify: `backend/src/events/events.service.spec.ts`
- Modify: `backend/src/event-organizer/dto/upsert-override.dto.ts`
- Modify: `backend/src/event-organizer/event-organizer.service.ts`
- Modify: `backend/src/event-organizer/event-organizer.service.spec.ts`
- Modify: `frontend/src/lib/events.ts`
- Modify: `frontend/src/components/islands/admin/eventos/types.ts`
- Modify: `frontend/src/components/islands/admin/eventos/EventFormDialog.tsx`
- Modify: `frontend/src/components/islands/admin/eventos/useEventosMutations.ts`
- Modify: `frontend/src/components/islands/admin/eventos/__tests__/eventos.test.tsx`
- Modify: `frontend/src/components/astro/EventCard.astro`
- Modify: `frontend/src/pages/eventos/[...path].astro`

**Interfaces:**
- `VenueType = bar | restaurante | auditorio | campus | online | outro` (valor persistido sem acento).
- `adultOnly boolean NOT NULL DEFAULT false`; `venueType varchar NULL`.
- Snapshot expõe ambos para managed events; externos continuam usando `payload.adultOnly`.

- [x] **Step 1: Write failing serializer, heuristic and copy tests**

```ts
it('serializes adult classification without changing event visibility', () => {
  const toEventItem = EventsService['toEventItem'] as unknown as (
    event: ManagedEvent, confirmedCount: number,
  ) => Record<string, unknown>;
  const item = toEventItem(Object.assign(new ManagedEvent(), {
    id: 'event-1', slug: 'evento-18', title: 'Evento', summary: 'Resumo',
    startAt: new Date('2026-11-01T21:00:00.000Z'), endAt: null,
    timezone: 'America/Sao_Paulo', adultOnly: true, venueType: VenueType.BAR,
  }), 0);
  expect(item).toMatchObject({ slug: 'evento-18', adultOnly: true, venueType: 'bar' });
});
```

```ts
it('suggests 18+ only for bar/restaurant at or after 18h', () => {
  expect(shouldSuggestAdult({ venueType: 'bar', localHour: 18 })).toBe(true);
  expect(shouldSuggestAdult({ venueType: 'restaurante', localHour: 17 })).toBe(false);
  expect(shouldSuggestAdult({ venueType: 'campus', localHour: 20 })).toBe(false);
});
```

Run: `cd backend && npx jest src/events/events.service.spec.ts src/event-organizer/event-organizer.service.spec.ts --runInBand`
Run: `cd frontend && npx vitest run src/lib/adult-content.test.ts src/components/islands/admin/eventos/__tests__/eventos.test.tsx`
Expected: FAIL.

- [x] **Step 2: Implement backend persistence and serialization**

Adicionar DTOs com `@IsBoolean()`/`@Type(() => Boolean)` e `@IsEnum(VenueType)`, persistência create/update e campos no snapshot. `ExtendDataDto.adultOnly` e a validação manual de overrides aceitam somente boolean para eventos externos. Alterações de `adultOnly` após publicação gravam antes/depois em audit de governo. Não adicionar idade, data de nascimento, bloqueio de inscrição, noindex ou verificação de documento.

- [x] **Step 3: Implement static notice and form suggestion**

Copy padrão: título **"Evento destinado a maiores de 18 anos"**; corpo **"Este evento acontece em local, horário ou contexto destinado a maiores. Menores de idade devem participar acompanhados de um responsável legal. A sinalização é informativa e não substitui as regras do local nem a verificação de responsabilidade do organizador."** Não afirmar que a Codaqui nunca trata dados de adolescentes.

O componente usa tokens warning e `role="note"`. O badge mostra `+18`. O formulário calcula hora no timezone do evento, sugere sem salvar automaticamente e exige ação humana.

- [x] **Step 4: Run focused tests and smoke checks**

Run: `cd backend && npx jest src/events src/event-organizer --runInBand`
Run: `cd frontend && npx vitest run src/lib/adult-content.test.ts src/components/islands/admin/eventos`
Run: `cd frontend && npm run build && test -f dist/eventos/index.html`
Expected: PASS; eventos 18+ continuam indexáveis e no sitemap.

- [x] **Step 5: Commit**

```bash
git add backend/src/migrations/1793289605000-Migration031_EventAdultContent.ts backend/src/events backend/src/event-organizer frontend/src/lib/adult-content.ts frontend/src/lib/adult-content.test.ts frontend/src/lib/events.ts frontend/src/components/astro/AdultContentNotice.astro frontend/src/components/astro/EventCard.astro frontend/src/components/islands/admin/eventos frontend/src/pages/eventos/[...path].astro
git commit -m "feat(fase-1a): adiciona sinalização informativa para eventos 18+"
```

### Task 11: Documentação viva, versão e gates finais

**Files:**
- Create: `docs/adrs/006-directorates-designations.md` (somente diretorias/designations; horas ficam para ADR futura da Fase 2)
- Create: `docs/adrs/007-community-registry.md`
- Modify: `docs/adrs/001-event-platform.md`
- Modify: `docs/modules/events/CODE_MANUAL.md`
- Modify: `docs/modules/events/ROLES.md`
- Modify: `docs/modules/community/COMMUNITY_SITES.md`
- Modify: `docs/README.md`
- Modify: `AGENTS.md`
- Modify: `DEVELOPMENT.md`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`

- [x] **Step 1: Update documentation to the delivered behavior**

ADRs 006/007 nascem com escopo implementado apenas na 1a; não declarar `hour_ledger` como existente. Documentar endpoints reais, seis seeds, Integradas sem responsável legado, proxy `/designations/` etc., E1, R1, G6, Turnstile e ECA. Remover das docs vivas instruções que contradigam o código entregue.

- [x] **Step 2: Bump backend version once**

```bash
cd backend && npm version 0.12.0 --no-git-tag-version
```

Expected: `backend/package.json` e lockfile em `0.12.0`.

- [x] **Step 3: Run all project gates**

```bash
cd backend && npm run build && npx jest --silent
cd .. && make astro-verify && make astro-verify-tenants && npm run test:scripts
```

Expected: todos PASS. Se qualquer gate falhar, corrigir a causa e repetir somente o gate afetado antes de repetir o conjunto final.

- [x] **Step 4: Exercise the original scenarios end to end**

Com PostgreSQL migrado e backend/frontend locais:
1. Conceder diretor; verificar roles derivadas e edição somente na própria diretoria.
2. Listar quatro Integradas e duas Parceiras, conceder selo somente com responsável, validar recusa de doação para Parceira e confirmar que o checkout atual de CamposTech continua aceito.
3. Simular SMTP desligado/configurado; conferir `skipped`, resend e summary.
4. Exportar CSV com range e campo iniciado por `=`.
5. Configurar retenção, executar cleanup e confirmar que governo permanece.
6. Marcar evento bar/18h como 18+; sincronizar eventos e conferir badge/aviso no build.
7. Rodar `make migration-revert` apenas em banco descartável para validar `down` da 031; restaurar com `migration-run`.

- [x] **Step 5: Review generated files and commit**

```bash
git status --short
git add docs AGENTS.md DEVELOPMENT.md backend/package.json backend/package-lock.json
git commit -m "docs(fase-1a): registra fundações e prepara backend 0.12.0"
```

Não incluir dumps, `.env`, logs, coverage ou artefatos de build no commit. O PR permanece sem merge até revisão e comando de deploy separado.

## Completion Checklist

- [x] Seis comunidades migradas sem perda de dados públicos; três tenants e as doações/transparência de CamposTech preservados.
- [x] Designations são a única fonte de vínculos novos; roles derivadas não são editáveis manualmente.
- [x] Nenhuma rota `/admin/*` foi adicionada ao proxy.
- [x] E1, R1, G6, Turnstile e ECA têm testes de comportamento e fluxo local verificado.
- [x] Todos os gates do projeto passaram no estado final da branch.
- [x] Backend está em `0.12.0`; nenhuma funcionalidade da Fase 2 foi marcada como implementada.
