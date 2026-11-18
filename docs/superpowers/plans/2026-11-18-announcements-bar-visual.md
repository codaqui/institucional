<!-- AGENT-INDEX
purpose: Plano de implementação da revisão visual da barra pública de anúncios.
audience: Implementers e revisores do frontend.
status: Executado nativamente na develop em 2026-11-18; integração em main e deploy pendentes.
sections:
  - Restrições globais
  - Foco de revisão
  - Task 1 — Estrutura e estilos
  - Task 2 — Documentação e gates
related-docs:
  - ../specs/2026-11-18-announcements-bar-visual-design.md — desenho aprovado
  - ../../adrs/017-announcements.md — comportamento funcional do módulo
agent-protocol:
  - Executar sem alterar contratos de dados ou adicionar dependências.
-->

# Announcements Bar Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Tornar a barra pública de anúncios fina, fluida e fiel ao mockup sem alterar seu comportamento funcional.

**Architecture:** Manter a ilha React e o snapshot atuais, adicionando um contêiner interno de largura compartilhada com o cabeçalho e agrupando texto/link em uma mensagem inline. Concentrar a apresentação nos estilos globais já existentes, usando tokens `--cq-*`.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Astro 7.

**Spec:** `docs/superpowers/specs/2026-11-18-announcements-bar-visual-design.md`

## Global Constraints

- Não alterar APIs, snapshot, ordenação, persistência ou regras de exibição.
- Não adicionar dismiss, toast, carrossel, animação ou comportamento sticky.
- Não adicionar dependências nem valores hexadecimais fora de `tokens.css`.
- Preservar texto escapado, links seguros, foco visível e os dois temas.

## Review Focus

- Texto longo e zoom: a mensagem deve quebrar sem transbordo; coberto pela estrutura inline e CSS com `min-width: 0`/`overflow-wrap`.
- Múltiplos anúncios: a ordem recebida deve permanecer; coberto pelo teste comportamental existente.
- Snapshot vazio/erro: nenhum espaço deve ser reservado; coberto pelo teste existente.
- HTML no texto e links externos: escape e atributos seguros permanecem; cobertos pelo teste existente.
- Dark mode: cores semânticas devem continuar legíveis; coberto pelo teste existente e revisão visual.

---

### Task 1: Estrutura inline e barra responsiva

**Files:**
- Modify: `frontend/src/components/islands/AnnouncementsBarIsland.tsx`
- Modify: `frontend/src/components/islands/AnnouncementsBarIsland.test.tsx`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes: o snapshot `AnnouncementSnapshot` e os componentes de teste existentes, sem mudanças de assinatura.
- Produces: artigos com `.announcement__content` e `.announcement__message`; nenhum contrato consumido por outros módulos.

- [x] **Step 1: Write the failing test**

Adicionar um teste que renderiza `snapshot`, localiza `.announcement__message` dentro de cada artigo e verifica que o link correspondente é filho dessa mensagem. Verificar também que cada artigo contém `.announcement__content`.

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/islands/AnnouncementsBarIsland.test.tsx`
Expected: FAIL porque `.announcement__message` e `.announcement__content` ainda não existem.

- [x] **Step 3: Implement the component structure**

Envolver badge e mensagem em `.announcement__content`; mover texto e link para um `<p className="announcement__message">`, mantendo o link como `.announcement__link` e todos os atributos atuais.

- [x] **Step 4: Replace card styling with compact bar styling**

Em `global.css`, remover margem externa, gap entre cartões, borda lateral e raio. Usar fundo semântico por artigo, separador inferior, conteúdo `max-width: 72rem`, padding vertical de `var(--cq-space-2)`, badge compacto e mensagem inline com quebra natural. Não definir altura fixa.

- [x] **Step 5: Run focused tests**

Run: `cd frontend && npx vitest run src/components/islands/AnnouncementsBarIsland.test.tsx`
Expected: todos os testes do arquivo PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/src/components/islands/AnnouncementsBarIsland.tsx frontend/src/components/islands/AnnouncementsBarIsland.test.tsx frontend/src/styles/global.css
git commit -m "fix(announcements): aproxima barra pública do mockup"
```

### Task 2: Documentação e verificação da entrega

**Files:**
- Modify: `docs/adrs/017-announcements.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-11-18-announcements-bar-visual.md`

**Interfaces:**
- Consumes: a implementação da Task 1.
- Produces: documentação sincronizada e evidências de verificação; nenhuma mudança de runtime.

- [x] **Step 1: Update living documentation**

Registrar no ADR 017 a apresentação compacta alinhada ao mockup e no changelog 1.8.1 a correção visual, sem declarar deploy. Marcar os passos concluídos neste plano com os resultados efetivamente obtidos.

- [x] **Step 2: Run frontend type and unit gates**

Run: `cd frontend && npm run check && npm run test`
Expected: `astro check` sem erros e todos os testes Vitest PASS.

- [x] **Step 3: Run site and tenant gates**

Run: `make astro-verify && make astro-verify-tenants`
Expected: build codaqui, smoke, paridade de URLs e os quatro builds/allow-lists PASS.

- [x] **Step 4: Inspect responsive rendering**

Servir o build com um snapshot local de anúncios e inspecionar desktop/mobile nos temas claro/escuro usando as ferramentas de browser disponíveis no ambiente. Confirmar alinhamento com o header, ausência de overflow e links navegáveis; não instalar uma dependência nova para essa inspeção.

- [x] **Step 5: Commit documentation and verification evidence**

```bash
git add docs/adrs/017-announcements.md docs/superpowers/specs/2026-11-18-announcements-bar-visual-design.md docs/superpowers/plans/2026-11-18-announcements-bar-visual.md CHANGELOG.md
git commit -m "docs(announcements): registra revisão visual da barra"
```

## Evidências da execução

- Novo teste de estrutura falhou por ausência de `.announcement__content` antes da implementação; depois, os 3 testes da ilha passaram.
- `astro check` concluiu e o Vitest passou com 154 arquivos e 1.224 testes.
- `make astro-verify` e `make astro-verify-tenants` passaram, incluindo smoke, paridade de URLs e os quatro builds/allow-lists.
- Build codaqui servido localmente e inspecionado com Playwright + Chrome já instalados, sem nova dependência e com snapshot interceptado somente no browser.
- Desktop 1440px e mobile 390px, ambos em claro/escuro: quatro severidades, texto longo, ausência de overflow, conteúdo alinhado ao cabeçalho, links inline, rota interna 200 e atributos seguros no link externo.
- A espera do teste visual usa `domcontentloaded` + seletor da barra porque `networkidle` permanecia pendente apesar de todos os recursos locais necessários terem respondido.
