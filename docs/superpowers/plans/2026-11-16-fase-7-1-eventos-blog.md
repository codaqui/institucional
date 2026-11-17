<!-- AGENT-INDEX
purpose: Plano TDD da Fase 7.1 para contenção de eventos e thumbnails do blog.
audience: Implementadores, revisores e futuros agentes consultando o histórico.
status: Concluído; commits integrados pela PR #652 e publicados na linha 1.1.0, após 1.0.2.
sections: [Resumo de Discord, Contenção visual de eventos, Thumbnails do blog, Gates]
related-docs: [../specs/2026-11-16-fase-7-1-eventos-blog-design.md]
agent-protocol: Registro histórico concluído; não reexecutar tasks nem checkboxes.
-->

# Fase 7.1 — Eventos e prévia do blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conter resumos longos nos cards de evento e exibir thumbnails decorativos nos posts que já possuem imagem, sem alterar o Design System.

**Architecture:** Normalização do Discord no script de sync e contenção CSS no `EventCard`. Derivação de imagem centralizada em `blog-utils.ts`, consumida pelo componente único `BlogPostCard.astro` em home, paginação e categorias.

**Tech Stack:** Astro 7 + Tailwind v4 + TypeScript/Vitest · Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-16-fase-7-1-eventos-blog-design.md`

## Global Constraints

- Não alterar tokens, layouts, URLs, slugs, feeds, schema ou Markdown canônico.
- Sem placeholders para posts sem imagem e sem novas dependências.
- Thumbnail sempre decorativo: `alt=""` e `aria-hidden="true"`, dimensões 640×360 e `loading="lazy"`.
- Trabalho inline em `develop`, com TDD e PR de acompanhamento.

## Review Focus

1. Descrição de evento com Markdown ou mais de 220 caracteres não produz HTML no snapshot nem resumo ilimitado (Task 1).
2. URL/palavra sem espaços no resumo não ultrapassa o card (Task 2).
3. `data.image` tem prioridade sobre qualquer imagem do corpo e caminho local usa `contentAssetUrl()` (Task 3).
4. HTML com `alt` antes de `src`, aspas simples ou imagem ausente não quebra o parser nem gera thumbnail vazio (Task 3).
5. Post sem imagem preserva o card atual; imagem remota permanece inalterada e toda thumbnail é decorativa (Task 3).

---

### Task 1: Resumo do Discord normalizado

**Files:**
- Modify: `scripts/sync-events.mjs:90-104,192-223,2015-2042`
- Test: `scripts/sync-events.test.mjs`

**Interfaces:**
- Produces: `mapDiscordEvent(event, config)` exportado para testes; `summary` com `stripMarkdown()` + `truncateText(..., 220)`.

- [ ] **Step 1: Write the failing tests**

Adicionar `mapDiscordEvent` ao import e uma fixture mínima com `entity_metadata: {}` e `recurrence_rule: null`:

```js
const mapped = mapDiscordEvent({
  id: "evt-1",
  name: "Encontro",
  description: `**Resumo** ${"x".repeat(230)}`,
  scheduled_start_time: "2026-12-01T18:00:00Z",
  entity_type: 3,
  status: 1,
  recurrence_rule: null,
  entity_metadata: {},
}, { defaultHost: "Codaqui", defaultLocation: "Online", defaultPlatform: "Discord" });
assert.equal(mapped.summary.startsWith("Resumo "), true);
assert.equal(mapped.summary.endsWith("…"), true);
assert.equal(mapped.summary.length <= 220, true);
assert.equal(mapDiscordEvent({ ...event, description: "" }, config).summary, "Evento publicado pela comunidade no Discord.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/sync-events.test.mjs`
Expected: FAIL porque `mapDiscordEvent` não é exportado e o resumo atual preserva Markdown/tamanho integral.

- [ ] **Step 3: Implement and export the mapper**

Em `mapDiscordEvent`, trocar somente o campo para `summary: truncateText(stripMarkdown(event.description) || "Evento publicado pela comunidade no Discord.")`; adicionar o mapper ao bloco `export { ... }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/sync-events.test.mjs`
Expected: todos os testes passam, incluindo Markdown removido, teto de 220 e fallback vazio.

- [ ] **Step 5: Commit**

`fix(eventos): normaliza resumo dos eventos do Discord`

---

### Task 2: Resumo contido no EventCard

**Files:**
- Modify: `frontend/src/components/astro/EventCard.astro:84-85,166-198`
- Test: `scripts/event-card-style.test.mjs` (novo)

**Interfaces:**
- Produces: classe `.event-summary` com clamp de 3 linhas e quebra de texto longo.

- [ ] **Step 1: Write the failing static contract test**

Ler `EventCard.astro` e asserir:

```js
assert.match(source, /class="event-summary mb-4 text-sm text-text-secondary"/);
assert.match(source, /\.event-summary\s*\{[^}]*-webkit-line-clamp:\s*3/s);
assert.match(source, /\.event-summary\s*\{[^}]*line-clamp:\s*3/s);
assert.match(source, /\.event-summary\s*\{[^}]*overflow-wrap:\s*anywhere/s);
assert.match(source, /\.event-summary\s*\{[^}]*overflow:\s*clip/s);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/event-card-style.test.mjs`
Expected: FAIL porque a classe não existe no parágrafo do resumo.

- [ ] **Step 3: Apply the CSS and class**

No parágrafo de `event.summary`, adicionar `event-summary` como primeira classe. No `<style>`, definir `display: -webkit-box`, `-webkit-line-clamp: 3`, `-webkit-box-orient: vertical`, `line-clamp: 3`, `overflow: clip` e `overflow-wrap: anywhere` no mesmo bloco.

- [ ] **Step 4: Run test and frontend build**

Run: `node --test scripts/event-card-style.test.mjs && cd frontend && npm run build`
Expected: contrato verde e build concluído.

- [ ] **Step 5: Commit**

`fix(eventos): limita resumo dos cards a três linhas`

---

### Task 3: Thumbnail progressivo no BlogPostCard

**Files:**
- Modify: `frontend/src/lib/blog-utils.ts:141-144,168-181`
- Modify: `frontend/src/components/astro/BlogPostCard.astro`
- Test: `frontend/src/lib/blog-utils.test.ts`

**Interfaces:**
- Produces: `resolvePostImage({ body?: string; data: { image?: string } }): { src: string; alt: "" } | null`; `postCardProps()` inclui `image` no mesmo formato.

- [ ] **Step 1: Write the failing tests**

Adicionar casos para:
1. `data.image` vence uma imagem diferente no corpo e usa `contentAssetUrl()`.
2. Markdown `![Capa](img/post/capa.png)` produz `/blog-assets/img/post/capa.png`.
3. HTML `<img alt="Capa" src='https://example.com/capa.png'>` é encontrado com atributos em ordem variável e URL remota preservada.
4. Corpo sem imagem retorna `null`.
5. `postCardProps()` expõe `image` com `alt: ""`; imagem remota não sofre rewrite.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/blog-utils.test.ts`
Expected: FAIL porque `resolvePostImage`/`image` não existem.

- [ ] **Step 3: Implement the defensive resolver**

Implementar `resolvePostImage` sem nova dependência: priorizar `data.image`; senão escolher a primeira ocorrência entre Markdown e `<img>` na ordem do corpo; extrair `src` com aspas duplas/simples e aplicar `contentAssetUrl()` em ambos os caminhos. Retornar `null` para corpo vazio/ausente de imagem. Repassar `image` em `postCardProps()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/blog-utils.test.ts`
Expected: todos os testes da lib passam.

- [ ] **Step 5: Render the thumbnail and verify the built card**

Adicionar `image` à interface e props do componente. Antes do título, quando `image` existir, renderizar `<img src={image.src} alt="" aria-hidden="true" width="640" height="360" loading="lazy" class="mb-4 aspect-video w-full rounded-md object-cover" />`. Sem `image`, não emitir wrapper/placeholder.

Run: `cd frontend && npm run check && npm run build`
Expected: 0 erros e build concluído; inspecionar `/blog/index.html` para confirmar pelo menos um thumbnail decorativo quando houver post com imagem.

- [ ] **Step 6: Commit**

`feat(blog): exibe thumbnails dos posts nas listagens`

---

### Task 4: Gates e revisão independente

- [ ] **Step 1:** `npm run test:scripts` — todos os testes passam.
- [ ] **Step 2:** `cd frontend && npm run test && npm run check && npm run build` — suíte, 0 erros e build verdes.
- [ ] **Step 3:** `make astro-verify && make astro-verify-tenants` — gates completos e paridade de URLs verdes.
- [ ] **Step 4:** remover artefatos gerados em `frontend/public/`, manter `git status` limpo e revisar o diff com um revisor independente. Corrigir Critical/Important antes do PR.
- [ ] **Step 5:** publicar `develop`, abrir PR para `main` com a conta `endersonmenezes` e verificar issues/duplicação no SonarCloud.

## Self-Review

1. **Spec coverage:** Discord (T1), card de evento (T2), imagem e apresentação decorativa (T3), gates (T4). Completo.
2. **Type consistency:** `resolvePostImage` e `postCardProps().image` compartilham `{src, alt: ""} | null`; o componente consome exatamente esse contrato.
3. **Review Focus:** todos os cinco itens têm teste na task dona.
4. **Proporção:** três mudanças pequenas e independentes, sem reescrita de conteúdo ou abstrações novas além do resolver necessário.
