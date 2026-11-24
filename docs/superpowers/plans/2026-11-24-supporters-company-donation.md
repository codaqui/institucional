<!-- AGENT-INDEX
purpose: Plano de implementação do sorteio de apoiadores e do seletor empresarial na 1.13.0.
audience: Mantenedores e AI agents executores.
status: Desenho aprovado; implementação na develop/PR #673.
sections:
  - Global Constraints
  - Review Focus
  - Task 1
  - Task 2
  - Task 3
related-docs:
  - docs/superpowers/specs/2026-11-24-supporters-company-donation-design.md — desenho aprovado.
agent-protocol:
  - Executar com TDD; preservar acessibilidade, URLs, payloads e a correção de Pix.
-->

# Supporters and Company Donation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortear apoiadores com navegação acessível e tornar o seletor empresarial legível e consistente com a doação pessoal.

**Architecture:** O mapeamento atual continua separado da ordenação. Fisher–Yates recebe uma função aleatória injetável, e o carrossel mantém uma fila em estado, reembaralhando apenas ao completar o ciclo. O seletor empresarial usa exclusivamente tokens MUI existentes.

**Tech Stack:** React 19, MUI v9, TypeScript, Vitest, Testing Library, Astro.

**Spec:** `docs/superpowers/specs/2026-11-24-supporters-company-donation-design.md`

## Global Constraints

- Uma pessoa ou empresa por slide; autoplay de seis segundos e pausas atuais preservados.
- Não repetir o último item na primeira posição do novo ciclo quando houver mais de um item.
- Não alterar endpoints, dados públicos, URLs, payloads Stripe ou a correção de Pix.
- Seleção com `primary.main` + `primary.contrastText`; hover com `primary.dark`.
- Release 1.13.0 na PR #673, sem migration.

## Review Focus

- Um único apoiador: ciclo não quebra nem tenta evitar o impossível; teste na Task 1.
- Nova ordem: todos os IDs/tipos são preservados sem duplicatas; teste na Task 1.
- Tema escuro: seleção usa `primary.contrastText`, não branco fixo; teste na Task 2 e capturas na Task 3.
- Redução de movimento: autoplay continua desativado e navegação manual funciona; suíte existente na Task 1.
- Props recarregadas: fila e índice não podem apontar para item inexistente; reset coberto na Task 1.

---

### Task 1: Fila aleatória de apoiadores

**Files:**
- Modify: `frontend/src/components/islands/SocialProofStrip.tsx`
- Test: `frontend/src/components/islands/SocialProofStrip.test.tsx`

**Interfaces:**
- Produces: `shuffleSupporterSlides(slides: SupporterSlide[], random?: () => number, avoidFirst?: SupporterSlide): SupporterSlide[]` e `shuffleSupporters(donors: Donor[], sponsors: Sponsor[], random?: () => number): SupporterSlide[]`.

- [ ] **Step 1: Write failing tests**

Testar que `shuffleSupporters` usa Fisher–Yates com `() => 0` e produz `["Teste", "Bruno Lima", "Ana Souza"]` a partir da sequência atual Ana/Teste/Bruno. Testar que todos os itens são preservados, que `avoidFirst` troca o primeiro quando necessário e que um item único permanece válido. Mockar `Math.random` com `0.999999` nos testes existentes para preservar sua ordem determinística.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: FAIL porque os exports de sorteio não existem.

- [ ] **Step 3: Implement shuffling and cycle integration**

Implementar Fisher–Yates sem mutar a entrada. Se `avoidFirst` coincidir com o primeiro item e houver alternativa, trocar pelo primeiro item diferente. Usar `shuffleSupporters` no carregamento. No carrossel, manter `orderedSlides` e índice; ao avançar após o último, reembaralhar com o último como `avoidFirst` e voltar ao índice zero. Resetar fila/índice se as props mudarem. Anterior e indicadores continuam percorrendo a fila atual.

- [ ] **Step 4: Run the complete carousel suite**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: todos os testes PASS, incluindo autoplay e reduced motion.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/SocialProofStrip.tsx frontend/src/components/islands/SocialProofStrip.test.tsx docs/superpowers/specs/2026-11-24-supporters-company-donation-design.md docs/superpowers/plans/2026-11-24-supporters-company-donation.md
git commit -m "feat(home): sorteia apoiadores no carrossel"
```

### Task 2: Contraste do seletor empresarial

**Files:**
- Modify: `frontend/src/components/islands/CompanySupportIsland.tsx`
- Test: `frontend/src/components/islands/__tests__/CompanySupportIsland.test.tsx`

**Interfaces:**
- Consumes: tokens `primary.main`, `primary.contrastText`, `primary.dark` e `text.primary` do tema MUI.

- [ ] **Step 1: Write the failing dark-theme test**

Definir `data-theme="dark"`, renderizar e verificar no botão selecionado `backgroundColor: rgb(137, 203, 179)` e `color: rgb(28, 69, 56)`. Verificar no botão não selecionado `color: rgb(240, 237, 242)`. Limpar o atributo após o teste.

- [ ] **Step 2: Run the test to verify failure**

Run: `cd frontend && npm run test -- --run src/components/islands/__tests__/CompanySupportIsland.test.tsx`
Expected: FAIL pelas cores atuais.

- [ ] **Step 3: Apply the existing personal-frequency tokens**

Adicionar `size="small"` e os mesmos pesos/padding da frequência pessoal. Aplicar `text.primary` por padrão e, em `.Mui-selected`, `primary.main` + `primary.contrastText`, com `primary.dark` no hover. Não alterar o estado ou a URL.

- [ ] **Step 4: Run the company-support suite**

Run: `cd frontend && npm run test -- --run src/components/islands/__tests__/CompanySupportIsland.test.tsx`
Expected: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/islands/CompanySupportIsland.tsx frontend/src/components/islands/__tests__/CompanySupportIsland.test.tsx
git commit -m "fix(doacoes): melhora contraste do apoio empresarial"
```

### Task 3: Release 1.13.0 e evidência final

**Files:**
- Modify: `frontend/package.json` e `frontend/package-lock.json`
- Modify: `backend/package.json` e `backend/package-lock.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update release metadata**

Alterar os quatro manifests/lockfiles para 1.13.0. Criar entrada para o carrossel aleatório e o seletor empresarial, preservando a correção de Pix na mesma release. Atualizar AGENT-INDEX e PR #673.

- [ ] **Step 2: Run full verification**

Run: `make astro-verify && make astro-verify-tenants`
Expected: exit 0; remover artefatos gerados sem commitá-los.

- [ ] **Step 3: Inspect the delivered UI**

Capturar home e `/participe/apoiar/?modo=empresa` em 1440×900 e 390×844, claro e escuro. Confirmar variedade sem repetição na fronteira, seletor legível e ausência de overflow. Publicar a PR e acompanhar CI/Sonar.

- [ ] **Step 4: Commit and update PR**

```bash
git add frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json CHANGELOG.md
git commit -m "chore(release): prepara 1.13.0"
git push origin develop
```
