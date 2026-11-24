<!-- AGENT-INDEX
purpose: Plano de implementação da jornada compartilhada entre Comunidades, Associação e Títulos na 1.12.1.
audience: Mantenedores e AI agents executores.
status: Aprovado quanto ao desenho; implementação na develop.
sections:
  - Global Constraints
  - Review Focus
  - Task 1
  - Task 2
related-docs:
  - docs/superpowers/specs/2026-11-24-community-institutional-journey-design.md — desenho aprovado.
agent-protocol:
  - Executar com TDD e gates do monorepo; não alterar o cabeçalho global nem o conteúdo factual.
-->

# Community Institutional Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar as três páginas institucionais em uma navegação local clara e publicar a correção como 1.12.1.

**Architecture:** Um componente Astro sem JavaScript recebe o caminho atual e renderiza os mesmos três destinos após cada hero. O footer usa a configuração de navegação existente; não haverá nova dependência nem alteração de rotas.

**Tech Stack:** Astro, Tailwind v4, tokens CSS, Vitest, npm.

**Spec:** `docs/superpowers/specs/2026-11-24-community-institutional-journey-design.md`

## Global Constraints

- Preservar identidade visual, conteúdo factual, URLs e navegação principal.
- Usar tokens existentes, landmark próprio, foco visível e `aria-current="page"`.
- O estado atual deve ter indicação textual, não apenas cor.
- Manter frontend e backend, inclusive lockfiles, na versão 1.12.1.
- Trabalhar na `develop`; não editar snapshots em `static/` nem cópias geradas.

## Review Focus

- Página atual: cada roda identifica somente seu próprio destino; conferir no teste da Task 1 e visualmente na Task 2.
- Mobile: três cartões não podem criar overflow nem exigir rolagem horizontal; conferir nas capturas de 390 px da Task 2.
- Temas: texto, bordas e foco devem continuar legíveis em claro e escuro; conferir nas capturas da Task 2.
- Rodapé: Títulos deve aparecer uma única vez no grupo institucional; cobrir na asserção da Task 1.
- Conteúdo: os novos textos apenas explicam destinos existentes, sem criar alegações; revisar no diff da Task 2.

---

### Task 1: Navegação institucional compartilhada

**Files:**
- Create: `frontend/src/components/astro/CommunityInstitutionalNav.astro`
- Modify: `frontend/src/pages/comunidades/index.astro`
- Modify: `frontend/src/pages/sobre/ong.astro`
- Modify: `frontend/src/pages/sobre/titulos.astro`
- Modify: `frontend/src/lib/site-navigation.ts`
- Test: `frontend/src/lib/ui-production-review.test.ts`
- Test: `frontend/src/lib/site-navigation.test.ts`

**Interfaces:**
- Consumes: tokens e utilitários Tailwind já usados pelas páginas.
- Produces: `<CommunityInstitutionalNav currentPath="/comunidades" | "/sobre/ong" | "/sobre/titulos" />`; item de rodapé `{ label: "Títulos e reconhecimentos", href: "/sobre/titulos" }`.

- [ ] **Step 1: Write the failing tests**

Em `ui-production-review.test.ts`, exigir o componente nas três páginas com seu `currentPath`, os três `href` no componente, `aria-current` e o texto visível “Página atual”. Em `site-navigation.test.ts`, exigir exatamente uma ocorrência do item de Títulos no grupo “Associação e transparência”.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- --run src/lib/ui-production-review.test.ts src/lib/site-navigation.test.ts`

Expected: FAIL por ausência do componente e do destino `/sobre/titulos`.

- [ ] **Step 3: Implement the shared navigation**

Criar o componente com `currentPath: string`, `<nav aria-label="Relação entre comunidades e Associação">` e três links: Comunidades participantes, Apoio institucional e Títulos e reconhecimentos, cada um com descrição curta. Renderizar “Página atual” e `aria-current="page"` somente no destino correspondente. Usar uma grade vertical no mobile e três colunas em `md`, superfícies e estados de foco/hover pelos tokens existentes.

Importar e renderizar o componente imediatamente após `PageHero` nas três páginas. Adicionar Títulos ao grupo institucional de `FOOTER_NAVIGATION`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `cd frontend && npm run test -- --run src/lib/ui-production-review.test.ts src/lib/site-navigation.test.ts && npm run check`

Expected: testes PASS e `astro check` com 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/astro/CommunityInstitutionalNav.astro \
  frontend/src/pages/comunidades/index.astro frontend/src/pages/sobre/ong.astro \
  frontend/src/pages/sobre/titulos.astro frontend/src/lib/site-navigation.ts \
  frontend/src/lib/ui-production-review.test.ts frontend/src/lib/site-navigation.test.ts \
  docs/superpowers/specs/2026-11-24-community-institutional-journey-design.md \
  docs/superpowers/plans/2026-11-24-community-institutional-journey.md
git commit -m "fix(comunidades): conecta jornada institucional"
```

### Task 2: Release 1.12.1 e verificação completa

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: navegação compartilhada entregue na Task 1.
- Produces: release de produto 1.12.1 documentada, sem migration.

- [ ] **Step 1: Update version and changelog**

Alterar os quatro manifests/lockfiles para `1.12.1`. Criar entrada datada de 2026-11-24 descrevendo a navegação compartilhada, a identificação da página atual e a entrada no rodapé; classificar como correção, sem migration. Atualizar o AGENT-INDEX do changelog.

- [ ] **Step 2: Run frontend and tenant gates**

Run: `cd frontend && npm run build && npm run check && npm run test`

Run: `cd .. && make astro-verify && make astro-verify-tenants`

Expected: todos os comandos exit 0; nenhum artefato gerado incluído no commit.

- [ ] **Step 3: Inspect the delivered UI**

Usar `impeccable shot` nas três rotas em 1440×900 e 390×844, incluindo claro e escuro. Confirmar que a navegação aparece imediatamente após o hero, cada página marca somente seu destino, os textos não truncam, não há overflow e o footer contém Títulos.

- [ ] **Step 4: Commit and publish develop**

```bash
git add frontend/package.json frontend/package-lock.json \
  backend/package.json backend/package-lock.json CHANGELOG.md
git commit -m "chore(release): prepara 1.12.1"
git push origin develop
```

Confirmar `git status --short --branch` limpo e reportar o commit e as verificações executadas.
