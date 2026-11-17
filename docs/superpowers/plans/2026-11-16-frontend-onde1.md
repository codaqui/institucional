<!-- AGENT-INDEX
purpose: Plano TDD da Onda 1 de correções P0/P1 de frontend e hardening do C4P.
audience: Implementadores, revisores e futuros agentes consultando o histórico.
status: Concluído e publicado em v1.0.2-backend pela PR #650.
sections: [Semântica e contraste, Acessibilidade e ações destrutivas, Guards e C4P, Gates]
related-docs: [../specs/2026-11-16-frontend-onde1-design.md]
agent-protocol: Registro histórico concluído; revalidar o backlog restante em vez de reexecutar tasks.
-->

# Onda 1 (Fase 9a) — Correções P0/P1 de UX no frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os problemas P0/P1 de UX mapeados na revisão de jornadas (contraste, semântica, acessibilidade, confirmações, guard, filtros e textos) e os menores deferidos de baixo risco do C4P, sem mudar o system-design.

**Architecture:** Correções pontuais em `.astro`, `global.css` e ilhas MUI (conteúdo/semântica), pequenos ajustes backend no módulo C4P (guards, filtros, performance). TDD: vitest para libs/ilhas, jest para backend, gates padrão do monorepo.

**Tech Stack:** Astro 7 + React 19 + MUI v9 + Tailwind v4 (--cq-*) · NestJS/TypeORM · vitest/jest.

**Spec:** `docs/superpowers/specs/2026-11-16-frontend-onde1-design.md`

## Global Constraints

- Sem mudança de framework, layouts, tokens `--cq-*` (zero hex solto fora de `tokens.css`) ou proxy.
- Sem PII de produção em testes (dados sintéticos).
- TDD onde houver comportamento novo (lib pura + ilhas vitest; backend jest); edições de conteúdo puro validadas por build + gates.
- Backend já está em 1.0.1 — esta onda **não exige bump** (fixes pequenos entram como patch: 1.0.2 ao final se houver mudança backend).
- Commits convencionais (`fix(frontend): …`, `fix(c4p): …`, `feat(frontend): …`) em `develop` com PR de acompanhamento.

## Review Focus

1. **`dark:` continua funcionando para quem usa `prefers-color-scheme: dark` no SO** — o `@custom-variant dark` ativa só com `data-theme="dark"`; validar build + smoke visual (o anti-FOUC seta data-theme antes do paint).
2. **Filtro `/eventos?source=` com query inválida ou ausente** — deve mostrar todos os eventos (sem filtro), não quebrar nem zerar a lista. Teste no script inline (T4).
3. **Confirmação destrutiva cancelada** — não deve chamar a mutação (nenhum DELETE). Teste nas ilhas (T7).
4. **Guard C4pAdminApp com membro sem papel** — não renderiza conteúdo de gestão nem faz fetch (redirect/mensagem de acesso restrito). Teste (T8).
5. **Vitrine/snapshot com campanha `open` fora da janela** — não aparecem (filtro por janela); com janela aberta ou sem janela aparecem. Testes backend (T15).

---

### Task 1: Conteúdo e semântica (E1, E2, E4, E12)

**Files:**
- Modify: `frontend/src/pages/transparencia.astro:83` (link docs → `/desenvolvedores/api`)
- Modify: `frontend/src/components/astro/PageHero.astro:48` (h2 → h1)
- Modify: `frontend/src/pages/c4p.astro`, `frontend/src/pages/c4p/[slug]/submeter.astro`, `frontend/src/pages/c4p/[slug]/resultado.astro`, `frontend/src/pages/c4p/avaliar.astro`, `frontend/src/pages/c4p/avaliar/votar.astro`, `frontend/src/pages/eventos/convite.astro` (remover `<main id="conteudo">` aninhado; manter conteúdo direto no main do layout)
- Modify: `frontend/src/content/pages/conduta.md:71` e `frontend/src/pages/sobre/conduta.astro:19` ("Compartamento" → "Comportamento")
- Modify: `frontend/src/pages/bio.astro:43` (chip ano → `new Date().getFullYear()`)
- Modify: `frontend/src/pages/projetos.astro:46-49` (hierarquia: h2 sr-only + h2 visível → uma só hierarquia coerente)

- [ ] **Step 1:** Aplicar as edições (sem testes novos — conteúdo puro).
- [ ] **Step 2:** `cd frontend && npm run build` — verde; `npm run check` — 0 erros.
- [ ] **Step 3: Commit** — `fix(frontend): link docs, h1 no hero, main aninhado e typos`.

---

### Task 2: Dark variant `dark:` por `data-theme` (E3)

**Files:**
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1:** Adicionar no final do arquivo: `@custom-variant dark (&:where([data-theme="dark"] *));`
- [ ] **Step 2:** `cd frontend && npm run build` — verde. Conferir no `dist/` uma página C4P: o HTML tem `data-theme` no `<html>` e as classes `dark:` passam a responder ao atributo.
- [ ] **Step 3: Commit** — `fix(frontend): variante dark por data-theme no Tailwind v4`.

---

### Task 3: Contraste em ações e heróis (E5)

**Files:**
- Modify: `frontend/src/pages/clube.astro:21` (BTN_SOLID → `bg-action text-on-action`)
- Modify: `frontend/src/pages/trilhas/index.astro:83,182` e `frontend/src/pages/sobre/insights.astro:75` (gradiente `primary-700→500` → `primary-800→700`)

- [ ] **Step 1:** Trocar classes para tokens com contraste ≥ 3:1 (ação) e ≥ 4.5:1 (texto normal).
- [ ] **Step 2:** `npm run build` — verde. Grep para confirmar ausência de `bg-primary-500 text-white` restante em ações.
- [ ] **Step 3: Commit** — `fix(frontend): contraste AA em ações e heróis (primary-500 → 700/800)`.

---

### Task 4: Filtro `/eventos?source=` na listagem (E6)

**Files:**
- Modify: `frontend/src/pages/eventos/index.astro` (script inline vanilla)
- Test: `frontend/src/lib/event-source-filter.test.ts` (nova lib pura)

**Interfaces:**
- Produces: `applySourceFilterFromQuery(params: URLSearchParams, sourceKey: string | null): boolean` — decide se o filtro por fonte deve ser aplicado (true somente se `sourceKey` não-vazio E existir no mapa de fontes).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { shouldApplySourceFilter } from "./event-source-filter";
describe("shouldApplySourceFilter", () => {
  it("aplica filtro com sourceKey válido", () => {
    expect(shouldApplySourceFilter(new URLSearchParams("source=meetup:devparana", new Set(["meetup:devparana"]))).toBe(true);
  });
  it("sem query: não filtra", () => {
    expect(shouldApplySourceFilter(new URLSearchParams(), new Set())).toBe(false);
  });
  it("sourceKey desconhecido: não filtra (fallback = todos)", () => {
    expect(shouldApplySourceFilter(new URLSearchParams("source=inexistente", new Set())).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd frontend && npx vitest run src/lib/event-source-filter.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implement lib + wire no script inline** — criar `src/lib/event-source-filter.ts` com `shouldApplySourceFilter(params, knownSources)`; no script inline de `eventos/index.astro`, ler `new URLSearchParams(window.location.search).get("source")` na carga inicial e aplicar o filtro se `shouldApplySourceFilter` for true.
- [ ] **Step 4: Run test to verify it passes** — PASS; `npm run build` verde.
- [ ] **Step 5: Commit** — `feat(frontend): filtro por fonte via query string em /eventos`.

---

### Task 5: Tabs do `/membro` — rótulo e hierarquia (E7)

**Files:**
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx:574` (rótulo "SortCoins e reembolsos" → "Reembolsos")
- Modify: mesmo arquivo — sub-tabs com peso visual menor (fonte `caption`/`body2`, inset leve) preservando ink bar MUI
- Test: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.test.tsx` (estender/criar caso do rótulo)

- [ ] **Step 1: Write the failing test** — renderiza o painel (mock useAuth completo padrão) e asserta que existe tab "Reembolsos" e NÃO existe tab "SortCoins e reembolsos".
- [ ] **Step 2: Run test to verify it fails** — FAIL.
- [ ] **Step 3: Implement rótulo + hierarquia visual.**
- [ ] **Step 4: Run test to verify it passes** — PASS + build.
- [ ] **Step 5: Commit** — `fix(frontend): sub-aba Reembolsos e hierarquia visual de tabs no /membro`.

---

### Task 6: `aria-label` nos IconButtons do admin (E8)

**Files:**
- Modify: `eventos/DescriptionMarkdownEditor.tsx`, `eventos/InternalEventAccordion.tsx`, `overrides/ActivationTab.tsx`, `events/EventOrdersDialog.tsx`, `hub/AdminHubApp.tsx:414`, `pagamentos/PagamentosApp.tsx`, `carteiras/CarteirasApp.tsx`, `empresas/EmpresasApp.tsx`, `overrides/OverridesTab.tsx`, `overrides/OrganizersTab.tsx`, `fornecedores/FornecedoresApp.tsx`

- [ ] **Step 1: Write the failing test** — teste simples (grep-based? não: unit) — melhor: teste vitest renderizando um dos componentes afetados (ex.: `DescriptionMarkdownEditor`) e assertando que todo `IconButton` tem `aria-label`. Como cobertura mínima e barata: um teste por arquivo modificado, escolhendo 3 componentes representativos (DescriptionMarkdownEditor, InternalEventAccordion, AdminHubApp) com renderWithMui e assert `getAllByRole("button").every(b => b.getAttribute("aria-label"))`.
- [ ] **Step 2: Run test to verify it fails** — FAIL (há botões sem label).
- [ ] **Step 3: Adicionar `aria-label` descritivo em todos os IconButtons sem label nos arquivos listados** (texto da ação + alvo, ex.: "Editar descrição do evento X").
- [ ] **Step 4: Run test to verify it passes** — PASS + build.
- [ ] **Step 5: Commit** — `fix(frontend): aria-label em todos os IconButtons do admin`.

---

### Task 7: Confirmação nas ações destrutivas (E9)

**Files:**
- Modify: `frontend/src/components/islands/admin/c4p/C4pAdminDetailApp.tsx` (removeTalk :135, remove evaluator :294)
- Modify: `frontend/src/components/islands/admin/emails/EmailsCampaignsTab.tsx:643` (supressão)
- Modify: `frontend/src/components/islands/admin/sorteios/SorteiosApp.tsx:230` (cancelar sorteio)
- Modify: `frontend/src/components/islands/admin/eventos/useEventosMutations.ts:312` (remover staff)
- Modify: `frontend/src/components/islands/admin/announcements/AnnouncementsAdminApp.tsx:90` (`window.confirm` → ModalConfirm MUI)
- Test: estender specs existentes das ilhas

- [ ] **Step 1: Write the failing tests** — para 2 casos representativos (C4P removeTalk e announcements delete): ao clicar em "Excluir/Desativar", abre diálogo de confirmação e NÃO chama DELETE; ao confirmar, chama DELETE. (Padrão `renderWithMui` + `userEvent` + assert de authFetch.)
- [ ] **Step 2: Run tests to verify they fail** — FAIL (DELETE dispara direto, sem diálogo).
- [ ] **Step 3: Implement** — usar `ModalConfirm` existente (ou `Dialog` MUI com título/descrição/botões) nos 5 pontos + trocar `window.confirm` por diálogo MUI.
- [ ] **Step 4: Run tests to verify they pass** — PASS + build.
- [ ] **Step 5: Commit** — `fix(frontend): confirmação MUI em ações destrutivas do admin`.

---

### Task 8: Feedback estruturado + guard C4pAdminApp (E10, E11)

**Files:**
- Modify: `frontend/src/components/islands/admin/c4p/C4pAdminDetailApp.tsx:154,309` (feedback `{severity, text}`)
- Modify: `frontend/src/components/islands/admin/c4p/C4pAdminApp.tsx` (guard por roles)
- Test: estender `C4pAdminDetailApp.test.tsx` e `C4pAdminApp.test.tsx`

- [ ] **Step 1: Write the failing tests**
  - Guard: com `roles: ["membro"]` a ilha mostra mensagem de acesso restrito e NÃO faz fetch.
  - Feedback: após ação, `Alert` tem `severity="success"` em sucesso e `severity="error"` em erro da API (em inglês também, sem heurística de string).
- [ ] **Step 2: Run tests to verify they fail** — FAIL.
- [ ] **Step 3: Implement** — feedback `{ severity: "success"|"error", text }`; guard: `const allowed = isAdmin || isEventOrganizer || user?.roles.includes("diretor")`; se `!allowed` → `<Alert severity="warning">Acesso restrito a admin, organizadores de eventos e diretores.</Alert>` (sem fetch).
- [ ] **Step 4: Run tests to verify they pass** — PASS + build.
- [ ] **Step 5: Commit** — `fix(c4p): feedback estruturado e guard client-side no admin C4P`.

---

### Task 9: Abas do Clube com URL + `aria-labelledby` (E13)

**Files:**
- Modify: `frontend/src/pages/participe/apoiar` (abas) e `frontend/src/pages/clube.astro` + ilhas (`DonationFlowIsland`, `ClubWalletIsland`, `ClubRafflesIsland`)
- Test: `frontend/src/components/islands/club/ClubWalletIsland.test.tsx` (se existir; senão caso novo simples)

- [ ] **Step 1: Write the failing test** — `tabpanel` tem `aria-labelledby` apontando para a tab correspondente; trocar aba atualiza `?tab=` na URL (ou `?aba=` conforme o padrão da casa).
- [ ] **Step 2: Run test to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — `aria-labelledby`/`aria-controls` corretos nos Tabs+TabPanel; estado da aba na URL (ler no mount, escrever no change) mantendo o padrão existente de deep links.
- [ ] **Step 4: Run test to verify it passes** — PASS + build.
- [ ] **Step 5: Commit** — `fix(frontend): abas do Clube com deep link e aria-labelledby`.

---

### Task 10: C4P — `accept` exige `designation === 'evaluator'` (E14)

**Files:**
- Modify: `backend/src/c4p/c4p-evaluators.service.ts` (`accept`)
- Test: `backend/src/c4p/c4p-evaluators.service.spec.ts` (estender)

- [ ] **Step 1: Write the failing test** — designation `pending` de outro tipo (ex.: `mentor`) no alvo `c4p_campaign` do próprio membro → 404 (não confirmável por este endpoint). Complemento: `mentor @ extension_project` não é afetado (o endpoint restringe por `targetType === 'c4p_campaign'` já — a nova condição `designation === 'evaluator'` fecha a porta residual).
- [ ] **Step 2: Run test to verify it fails** — FAIL (hoje aceita qualquer designation pending do membro no alvo).
- [ ] **Step 3: Implement** — adicionar `|| designation.designation !== 'evaluator'` na condição de rejeição do `accept`.
- [ ] **Step 4: Run test to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `fix(c4p): accept de convite exige designation evaluator`.

---

### Task 11: C4P — convite com `ILike` sem escape (E15)

**Files:**
- Modify: `backend/src/c4p/c4p-evaluators.service.ts` (`invite`)
- Test: `backend/src/c4p/c4p-evaluators.service.spec.ts` (estender)

- [ ] **Step 1: Write the failing test** — `handleOrEmail: "maria%"` não pode casar por coringa (não convida o membro errado). A regra escolhida: buscar com `ILike` escapado — `escapeLikeWildcards(value)` substitui `\` → `\\`, `%` → `\%`, `_` → `\_` antes do ILike (Postgres aceita `ESCAPE '\'` default).
- [ ] **Step 2: Run test to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — helper `escapeLikeWildcards(value: string): string` aplicado nos dois campos do `ILike`. Se optar pela alternativa (find limitado + igualdade case-insensitive em memória), manter a asserção equivalente.
- [ ] **Step 4: Run test to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `fix(c4p): escapa coringas do ILike no convite de avaliador`.

---

### Task 12: C4P — teste "votos de avaliador removido continuam contando" (E16)

**Files:**
- Modify: `backend/src/c4p/c4p-dashboard.service.spec.ts` (novo caso)

- [ ] **Step 1: Write the test** — fixture com 1 voto de designation `removed` + 1 de `active` na mesma palestra: `avgTotal` inclui os dois; avaliador removido NÃO entra em `totals.evaluators` nem em `progressByEvaluator`.
- [ ] **Step 2: Run test to verify it passes já hoje** — deve PASS (o comportamento já está correto; o teste prende a regra contra futuros filtros). Se falhar, o código tem regressão real — corrigir antes de commitar.
- [ ] **Step 3: Commit** — `test(c4p): prende que votos de avaliador removido contam na média`.

---

### Task 13: C4P — aba Finalização carrega todas as propostas (E17)

**Files:**
- Modify: `frontend/src/components/islands/admin/c4p/C4pAdminDetailApp.tsx` (FinalizeTab `useEffect` de carga de talks)
- Test: estender `C4pAdminDetailApp.test.tsx`

- [ ] **Step 1: Write the failing test** — mock de 2 páginas (100 + 1 talks): a Finalização lista as 101 propostas (loop de páginas).
- [ ] **Step 2: Run test to verify it fails** — FAIL (hoje cap 100).
- [ ] **Step 3: Implement** — loop `page = 1; do { fetch(page) ; page++ } while (data.length === 100)` até esgotar, acumulando `allTalks` (cuidado com totalPages do envelope).
- [ ] **Step 4: Run test to verify it passes** — PASS + build.
- [ ] **Step 5: Commit** — `fix(c4p): finalização lista todas as propostas (paginação completa)`.

---

### Task 14: C4P — `getEvaluatorCall` com Set (E18)

**Files:**
- Modify: `backend/src/c4p/c4p-votes.service.ts` (`getEvaluatorCall`)
- Test: existente já cobre progresso — manter verde.

- [ ] **Step 1: Implement** — `const talkIds = new Set(talks.map(t => t.id)); const voted = votes.filter(v => talkIds.has(v.talkId)).map(v => v.talkId); progress.voted = new Set(voted).size` (elimina `talks.some` dentro do filter).
- [ ] **Step 2: Run test** — `npx jest c4p/c4p-votes.service` PASS (comportamento idêntico).
- [ ] **Step 3: Commit** — `refactor(c4p): progresso do avaliador com Set de ids`.

---

### Task 15: Vitrine e snapshot C4P filtram por janela (E19) + nota ADR 012

**Files:**
- Modify: `backend/src/c4p/c4p-calls.service.ts` (`listPublic`)
- Modify: `backend/src/c4p/c4p-dashboard.service.ts` (`getSnapshot`)
- Modify: `docs/adrs/012-c4p.md` (nota curta: vitrine e snapshot respeitam a janela de submissão)
- Test: `backend/src/c4p/c4p-calls.service.spec.ts` e `c4p-dashboard.service.spec.ts` (estender)

- [ ] **Step 1: Write the failing tests**
  - `listPublic`: campanha `open` com `submissionCloseAt` no passado NÃO aparece; com janela aberta ou sem janela aparece.
  - `getSnapshot`: idem (exclui fora-da-janela; inclui `closed && publicResults` sempre).
- [ ] **Step 2: Run tests to verify they fail** — FAIL (hoje inclui fora-da-janela).
- [ ] **Step 3: Implement** — filtro por janela (`(!submissionOpenAt || submissionOpenAt <= now) && (!submissionCloseAt || submissionCloseAt > now)`), reutilizando a lógica de `assertAccepting` das submissions (extrair helper `isWithinSubmissionWindow(call, now)` compartilhado entre os dois services).
- [ ] **Step 4: Run tests to verify they pass** — PASS; nota na ADR 012.
- [ ] **Step 5: Commit** — `feat(c4p): vitrine e snapshot respeitam a janela de submissão (+ nota ADR 012)`.

---

### Task 16: Gates finais

- [ ] **Step 1:** `cd backend && npm run build && npx jest --silent` — verde.
- [ ] **Step 2:** `npm run test:scripts` — verde.
- [ ] **Step 3:** `cd frontend && npm run test && npm run check && npm run build` — verde (build codaqui completo).
- [ ] **Step 4:** `make astro-verify` e `make astro-verify-tenants` — verdes (global.css e tokens compartilhados).
- [ ] **Step 5:** `git status` limpo de artefatos; commit final se necessário — `chore(frontend): gates da Onda 1`.

---

## Self-Review

1. **Cobertura da spec:** E1 (T1), E2 (T1), E3 (T2), E4 (T1), E5 (T3), E6 (T4), E7 (T5), E8 (T6), E9 (T7), E10 (T8), E11 (T8), E12 (T1), E13 (T9), E14 (T10), E15 (T11), E16 (T12), E17 (T13), E18 (T14), E19 (T15). Gates (T16). ✅ Completo.
2. **Consistência de tipos:** `shouldApplySourceFilter` (T4) tem contrato explícito; `isWithinSubmissionWindow` (T15) reutiliza a lógica de `assertAccepting` (não duplica).
3. **Review Focus:** os 5 itens têm teste na task dona (T2/build, T4, T7, T8, T15).
4. **Proporção:** cada task traz assinaturas/valores/asserções-chave, sem transcrição de implementação.
