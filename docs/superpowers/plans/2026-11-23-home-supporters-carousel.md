<!-- AGENT-INDEX
purpose: Plano de implementação do carrossel de apoiadores da home.
audience: Implementadores e revisores do frontend.
status: Aprovado para execução com subagente; sem commits nesta etapa.
sections:
  - Constraints
  - Review Focus
  - Tasks
related-docs:
  - docs/superpowers/specs/2026-11-23-home-supporters-carousel-design.md
agent-protocol:
  - Executar com superpowers:subagent-driven-development; preservar alterações alheias e não commitar.
-->

# Home Supporters Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alternar pessoas apoiadoras e empresas patrocinadoras em um carrossel acessível na home e publicar a presença na home como benefício da Empresa Amiga.

**Architecture:** Evoluir `SocialProofStrip` para buscar as duas fontes públicas já existentes, intercalar os resultados e renderizar um slide por vez sem nova dependência. Um estado explícito controla índice, pausa e preferência de movimento; CSS e textos seguem tokens e padrões atuais.

**Tech Stack:** React 19, TypeScript, Astro 7, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-home-supporters-carousel-design.md`

## Global Constraints

- Usar somente `/members/donors` e `/companies/sponsors`; não exibir valores ou quantidade de doações de pessoas.
- Não criar dependências, endpoints, tiers ou benefícios novos.
- Autoplay pausa por hover, foco, página oculta e `prefers-reduced-motion`.
- Não commitar nem alterar arquivos fora do escopo deste plano.

## Review Focus

- Uma fonte vazia ou com erro: a outra deve continuar disponível sem slides inventados; testar na Task 1.
- Pessoa sem avatar ou empresa sem logo: usar iniciais/ícone e nome acessível; testar na Task 1.
- Autoplay durante foco ou movimento reduzido: índice não pode avançar; testar na Task 2.
- Navegação manual: anunciar posição sem releituras automáticas contínuas; testar na Task 2.
- Empresa sem site: não renderizar link vazio; testar na Task 1.

---

### Task 1: Dados e apresentação do carrossel

**Files:**
- Modify: `frontend/src/components/islands/SocialProofStrip.tsx`
- Create: `frontend/src/components/islands/SocialProofStrip.test.tsx`

**Interfaces:**
- Consumes: envelopes atuais de donors e sponsors, `resolveApiUrl(import.meta.env.SITE)` e `useFetchMock()`.
- Produces: `interleaveSupporters(donors: Donor[], sponsors: Sponsor[]): SupporterSlide[]`; slides discriminated por `kind: "person" | "sponsor"`.

- [ ] **Step 1: Write failing tests**

Criar testes que verificam: alternância pessoa/patrocinador, preservação da contagem, avatar/nome sem valores de doação, logo/tier/site da empresa, benefícios “Vitrine na home”, “Selo” e “SortCoins”, fallback sem imagem e ausência de link quando `websiteUrl` for nulo.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: FAIL porque o componente atual só renderiza a contagem.

- [ ] **Step 3: Implement data loading and slides**

Buscar as duas fontes, normalizar respostas paginadas e intercalar até a maior coleção. Renderizar região com `aria-roledescription="carousel"`, um slide por vez, anterior/próximo, posição e indicadores. Usar dimensões reservadas e `object-fit: contain`.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: PASS.

### Task 2: Autoplay e interação acessível

**Files:**
- Modify: `frontend/src/components/islands/SocialProofStrip.tsx`
- Modify: `frontend/src/components/islands/SocialProofStrip.test.tsx`

**Interfaces:**
- Consumes: slides da Task 1.
- Produces: intervalo de 6000 ms, pausa por hover/focus/visibilidade/movimento reduzido e live region `off` no autoplay/`polite` após ação manual.

- [ ] **Step 1: Write failing interaction tests**

Com timers falsos, provar avanço automático, anterior/próximo, seleção por indicador, pausa ao focar/hover, página oculta e índice estável com `prefers-reduced-motion`.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: FAIL porque ainda não existe autoplay/pausa.

- [ ] **Step 3: Implement autoplay and pause state**

Centralizar mudança de índice, limpar intervalos, ouvir `visibilitychange` e media query. Não mover foco; usar `aria-live="off"` durante autoplay e `polite` depois de controle manual.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm run test -- --run src/components/islands/SocialProofStrip.test.tsx`
Expected: PASS.

### Task 3: Benefícios e verificação de entrega

**Files:**
- Modify: `frontend/src/pages/empresas.astro`
- Modify: `frontend/src/pages/patrocinadores.astro`
- Modify: `docs/superpowers/specs/2026-11-23-home-supporters-carousel-design.md`

**Interfaces:**
- Consumes: comportamento implementado nas Tasks 1–2.
- Produces: benefício “Presença no banner rotativo da página inicial” e chamada pública coerente.

- [ ] **Step 1: Update benefits copy and spec status**

Adicionar a presença na home à Empresa Amiga e à chamada de `/patrocinadores`; marcar o desenho como implementado somente após os gates.

- [ ] **Step 2: Run frontend gates**

Run: `cd frontend && npm run check && npm run test && npm run build`
Expected: 0 erros, suíte aprovada e build concluído.

- [ ] **Step 3: Verify real rendering**

Com fixtures controladas, exercitar alternância, pausa e movimento reduzido em Playwright. Capturar claro/escuro em 390×844 e 1440×900, conferir overflow, foco e links; remover screenshots e artefatos gerados antes da entrega.

- [ ] **Step 4: Report without committing**

Run: `git diff --check && git status --short`
Expected: somente arquivos pretendidos modificados; nenhum commit realizado.
