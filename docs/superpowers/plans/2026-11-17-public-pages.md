<!-- AGENT-INDEX
purpose: Plano TDD da Fase 8 para enriquecer equipe/mentores e conectar /sobre/ong aos snapshots e tenants existentes.
audience: Implementadores e revisores; leitura obrigatória junto da spec.
status: Concluído em develop em 2026-11-17, versão compartilhada 1.3.0; tasks 1–4 executadas com TDD, gates completos e smoke do dist; integração em main pendente.
sections:
  - Constraints e Review Focus
  - Enriquecimento da equipe
  - Mentores e página de equipe
  - Comunidades e portais
  - Página da Associação, documentação e gates
related-docs:
  - ../specs/2026-11-17-public-pages-design.md — spec e contratos completos.
agent-protocol:
  - Plano concluído; não reexecutar tasks/checkboxes. A implementação usou TDD e commits por task.
  - Não criar backend, migration, membros/placeholders ou novas dependências.
-->

# Fase 8 — Páginas Públicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar equipe, mentores, comunidades e portais às projeções públicas existentes sem perder a curadoria editorial nem criar backend novo.

**Architecture:** Libs TypeScript puras fazem matching/join em build-time; páginas Astro consomem `loadPublicMembers()`, `loadMentorsIndex()`, `loadCommunitiesIndex()` e `TENANTS`. Não há ilha ou runtime de cliente novo.

**Tech Stack:** Astro 7, TypeScript, Tailwind v4 com tokens existentes, Vitest, Node ≥24.

**Spec:** `docs/superpowers/specs/2026-11-17-public-pages-design.md`

## Global Constraints

- Match de equipe somente por URL/handle GitHub válido, case-insensitive; nunca por nome.
- Sem backend, migration, membros/placeholders novos, mudança de rotas ou alteração do Design System.
- Mentores vêm somente do snapshot; perfil `/@handle` exige presença em `loadPublicMembers()` no mesmo build.
- Comunidades e portais usam somente projeções públicas; não expor IDs de atores, notas ou dados privados.
- Release proposta: **1.3.0** em frontend/backend e lockfiles, com changelog; nenhum código backend muda.

## Review Focus

- **Mesmo nome, pessoa errada:** entrada sem handle ou com handle divergente permanece local; testar em Task 1.
- **Mentor sem perfil público no build:** manter card e link do programa, omitir `/@handle`; testar em Task 2.
- **Tenant/comunidade divergentes ou inativos:** não gerar portal nem URL inventada; testar em Task 3.
- **Selo vencido ou apenas solicitado:** não exibir “Selo Codaqui” sem `sealEffective === true`; testar em Task 3.
- **Snapshot de mentores vazio/ausente:** empty state, sem reativar o array histórico; testar em Task 2 e validar build em Task 4.

---

### Task 1: Matching e enriquecimento puro da equipe

**Files:**
- Create: `frontend/src/lib/team.ts`
- Test: `frontend/src/lib/team.test.ts`
- Consume: `frontend/src/data/team.ts`

**Interfaces:**
- Consumes: `Member` de `data/team.ts` e `PublicMemberProfile` de `lib/member-path.ts`.
- Produces: `githubHandleFromUrl(url?: string): string | undefined`, `EnrichedTeamMember`, `enrichTeamMember(local, publicMembers)` e `publicProfilePathForHandle(handle, publicMembers)`.

- [ ] **Step 1 — RED:** escrever testes para handle case-insensitive; prioridade de nome/avatar/LinkedIn públicos; preservação de papel/especialidade e fallbacks locais; ausência de match por nome; `profilePath` somente com match.

```ts
expect(enrichTeamMember(local, [publicMember]).profilePath).toBe("/@endersonmenezes");
expect(enrichTeamMember(localWithoutHandle, [publicMemberWithSameName])).toEqual(localWithoutHandle);
```

- [ ] **Step 2 — RED de URLs:** aceitar `https://github.com/<handle>` com barra final opcional; rejeitar hostname lookalike, credenciais, query, path extra e ausência de handle.
- [ ] **Step 3 — Verificar RED:** `cd frontend && npm run test -- src/lib/team.test.ts`; esperado: módulo/exports ausentes.
- [ ] **Step 4 — GREEN:** implementar parsing com `new URL()`, protocolo/hostname/credenciais/path validados e uma busca case-insensitive compartilhada; não importar helper específico de DevParaná.
- [ ] **Step 5 — Verificar GREEN:** repetir o comando; esperado: PASS.
- [ ] **Step 6 — Commit:** `git add frontend/src/lib/team.ts frontend/src/lib/team.test.ts && git commit -m "feat(equipe): adiciona enriquecimento público por handle"`.

### Task 2: Equipe enriquecida e mentores do snapshot

**Files:**
- Modify: `frontend/src/pages/sobre/equipe.astro`
- Modify: `frontend/src/data/team.ts`
- Modify: `frontend/src/lib/team.ts`
- Test: `frontend/src/lib/team.test.ts`

**Interfaces:**
- Consumes: Task 1, `loadPublicMembers()` e `loadMentorsIndex()`.
- Produces: `MentorTeamMember` e `toMentorTeamMembers(mentors: PublicMentor[], publicMembers: PublicMemberProfile[]): MentorTeamMember[]` com `profilePath?` guardado.

- [ ] **Step 1 — RED:** testar conversão de mentores com nome/avatar/áreas/foco, link de perfil somente quando o handle está nos membros públicos e lista vazia sem fallback histórico.

```ts
expect(toMentorTeamMembers([mentor], [])[0].profilePath).toBeUndefined();
expect(toMentorTeamMembers([], publicMembers)).toEqual([]);
```

- [ ] **Step 2 — Verificar RED:** `cd frontend && npm run test -- src/lib/team.test.ts`; esperado: função ausente/falha no guard.
- [ ] **Step 3 — GREEN da lib:** implementar `toMentorTeamMembers()` usando `publicProfilePathForHandle()` e preservando a ordem do snapshot.
- [ ] **Step 4 — Integrar página:** carregar membros uma vez; enriquecer Diretoria/Membros/Alumni; mapear mentores do snapshot; remover o export `mentores` de `data/team.ts`; renderizar empty state e link do programa; trocar wrappers de card por `<article>` sem bio e sem alterar tokens/layout.
- [ ] **Step 5 — Verificar:** rodar o teste da lib e `cd frontend && npm run check`; esperado: PASS sem imports de `mentores` remanescentes.
- [ ] **Step 6 — Commit:** `git add frontend/src/pages/sobre/equipe.astro frontend/src/data/team.ts frontend/src/lib/team* && git commit -m "feat(equipe): conecta perfis e mentores públicos"`.

### Task 3: Selo efetivo e join de portais

**Files:**
- Modify: `frontend/src/lib/communities.ts`
- Test: `frontend/src/lib/communities.test.ts`
- Modify: `frontend/src/data/community-portals.ts`
- Create: `frontend/src/lib/community-portals.ts`
- Test: `frontend/src/lib/community-portals.test.ts`

**Interfaces:**
- Produces: `communityEffectiveSealLabel(community): string | null` em `lib/communities.ts`.
- Produces: `TenantDefinition`, `CommunityPortalView` e `listCommunityPortals(communities, tenants = TENANTS)` em `lib/community-portals.ts`.
- Consumes: metadados locais por slug de `data/community-portals.ts`, sem `basePath` nem lista independente de portais ativos.

- [ ] **Step 1 — RED do selo:** testar `applied`, `sealed + sealEffective=true`, `sealed + sealEffective=false/ausente` e `none`; somente o segundo caso retorna “Selo Codaqui”.
- [ ] **Step 2 — RED dos portais:** testar interseção ativa+`siteEnabled`+tenant, uso de `tenant.site`, dados do snapshot, fallbacks de logo dark/tagline, omissão de inativos/não configurados e ausência de duplicatas.
- [ ] **Step 3 — Verificar RED:** `cd frontend && npm run test -- src/lib/communities.test.ts src/lib/community-portals.test.ts`; esperado: exports/comportamentos ausentes.
- [ ] **Step 4 — GREEN:** implementar o selo sem alterar `communitySealLabel()` legado; implementar join por slug na ordem de `TENANTS`, deduplicando entradas; reduzir o data file aos metadados visuais/editoriais.
- [ ] **Step 5 — Verificar GREEN:** repetir os testes; esperado: PASS.
- [ ] **Step 6 — Commit:** `git add frontend/src/lib/communities* frontend/src/lib/community-portals* frontend/src/data/community-portals.ts && git commit -m "feat(comunidades): deriva selos e portais públicos"`.

### Task 4: Página da Associação, release e gates

**Files:**
- Modify: `frontend/src/pages/sobre/ong.astro`
- Modify: `AGENTS.md`
- Modify: `docs/plans/pos-1-0/README.md`
- Modify: `docs/plans/README.md`
- Modify: `CHANGELOG.md`
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `backend/package.json`, `backend/package-lock.json`

**Interfaces:**
- Consumes: Tasks 1–3 e loaders existentes; nenhum contrato novo de backend.

- [ ] **Step 1 — Integrar comunidades:** substituir o array local por `loadCommunitiesIndex()`, mapear `slug` para `CommunityPresenceCard`, manter social stats por slug, exibir nível/selo efetivo e `generatedAt` em UTC sem projetar campos privados.
- [ ] **Step 2 — Integrar portais e atas:** usar `listCommunityPortals()`, links externos seguros para `tenant.site`, e `/assembleias` como destino principal; identificar Drive somente como arquivo histórico se mantido.
- [ ] **Step 3 — Smoke de dados:** `cd frontend && npm run build`; esperado: build codaqui com equipe, mentores, comunidades e portais derivados, sem erros de tipos ou snapshots.
- [ ] **Step 4 — Documentar e versionar:** registrar a decisão 17 de `AGENTS.md`, marcar Fase 8 concluída somente após os gates, atualizar índice/changelog e alinhar a release proposta 1.3.0 sem editar dependências nem o package da raiz.
- [ ] **Step 5 — Gates completos:** `make astro-verify && make astro-verify-tenants && git diff --check`; esperado: quatro builds, testes, paridade de URLs e diff válido.
- [ ] **Step 6 — Higiene e revisão:** `git status --short`; remover somente artefatos gerados pelo próprio run, revisar diff e obter revisão independente antes do PR para `main`.
- [ ] **Step 7 — Commit:** `git add frontend/src/pages/sobre/ong.astro AGENTS.md docs/plans docs/superpowers CHANGELOG.md frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json && git commit -m "feat(fase-8): conecta páginas públicas às projeções"`.
