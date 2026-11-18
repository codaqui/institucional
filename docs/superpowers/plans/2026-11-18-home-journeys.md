<!-- AGENT-INDEX
purpose: Plano TDD da Fase 10.1 — Home e navegação fiéis às jornadas, sem dados fictícios.
audience: Implementadores e revisores.
status: Implementada em develop/1.8.0; evidências e gates registrados no documento.
related-docs:
  - ../specs/2026-11-18-journeys-mockups-design.md — design ratificado das três entregas.
agent-protocol:
  - Executar as tasks em ordem; cada task termina verde e com commit próprio.
-->

# Fase 10.1 — Home e Jornadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reposicionar a Home e a navegação do portal como uma associação de comunidades, usando somente snapshots, conteúdo e rotas reais.

**Architecture:** Astro estático continua responsável pelo HTML e SEO; helpers puros selecionam eventos e resolvem a seção atual. Header, drawer e footer compartilham a mesma estrutura de navegação, enquanto componentes Astro pequenos compõem a Home sem ilhas novas.

**Tech Stack:** Astro 7, TypeScript, Tailwind v4, tokens `--cq-*`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-journeys-mockups-design.md`

## Global Constraints

- Trabalhar diretamente em `develop`; não alterar produção nem snapshots gerados.
- Não publicar números, pessoas, links ou atividades ilustrativos dos mockups.
- Preservar mecanismos atuais de drawer, `<details>`, hover-intent, autenticação e tema.
- Não mudar URLs existentes, adicionar dependências ou copiar CSS solto dos mockups.
- Não editar `frontend/src-tenants`; esta entrega altera o portal codaqui.

## Review Focus

- Evento sem data válida/cancelado: espera-se exclusão dos destaques; Task 2 testa filtro defensivo.
- Comunidade sem link primário: espera-se fallback `/comunidades/<slug>`, nunca `href="#"`; Task 3 fixa o comportamento.
- Rota filha e trailing slash: espera-se seção atual correta sem marcar links semelhantes; Task 1 testa matching por segmento.
- Ausência total de eventos futuros: espera-se empty state com link para agenda, não seção vazia; Task 4 valida no HTML.
- Viewport estreito/teclado: espera-se drawer e foco existentes intactos; Task 5 inclui verificação manual e testes de header existentes.

---

### Task 1: Navegação compartilhada e seção atual

**Files:**
- Create: `frontend/src/lib/site-navigation.ts`
- Test: `frontend/src/lib/site-navigation.test.ts`
- Modify: `frontend/src/components/astro/SiteHeader.astro`
- Modify: `frontend/src/components/astro/SiteFooter.astro`

**Interfaces:**
- Produces: `SITE_NAVIGATION`, `INTEGRATE_COMMUNITY_LINK`, `FOOTER_NAVIGATION` e `isNavigationCurrent(pathname: string, href: string): boolean`.
- Consumes: `Astro.url.pathname` no header; links sociais canônicos no footer.

- [x] **Step 1: Escrever testes falhos para matching e mapas de links**
  Cobrir `/comunidades/devparana`, `/eventos/foo`, `/transparencia/`, raiz e `/eventos-legado`; afirmar que matching é por segmento, que `/` só casa na Home e que Comunidades/Atividades/Transparência/Aprender/Apoiar estão no desktop e drawer. Conferir Blog, Projetos, Patrocinadores, C4P, Contato, Sobre e Trilhas no footer.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/lib/site-navigation.test.ts`
  Expected: FAIL porque o módulo não existe.

- [x] **Step 3: Implementar os dados e integrar header/footer**
  Criar arrays tipados e `isNavigationCurrent`; renderizar os mesmos links nas duas navegações, `aria-current="page"` com sublinhado/borda e CTA `/sobre/ong`. Manter busca, tema, `NavbarAuth` e scripts existentes. Ampliar o footer com landmarks nomeados e links externos seguros.

- [x] **Step 4: Verificar comportamento**
  Run: `cd frontend && npx vitest run src/lib/site-navigation.test.ts src/lib/header-menu.test.ts`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/lib/site-navigation* frontend/src/components/astro/SiteHeader.astro frontend/src/components/astro/SiteFooter.astro && git commit -m "feat(fase-10): organiza navegação por jornadas"`

### Task 2: Seleção defensiva de atividades reais

**Files:**
- Create: `frontend/src/lib/home-journeys.ts`
- Test: `frontend/src/lib/home-journeys.test.ts`

**Interfaces:**
- Consumes: `EventSummary` de `lib/events` e `buildEventPublicPath` de `lib/event-path`.
- Produces: `HomeActivity` (`{title,summary,startAt,location,href,imageUrl?}`) e `selectUpcomingHomeActivities(events: EventSummary[], now: Date, limit?: number): HomeActivity[]`.

- [x] **Step 1: Escrever testes falhos**
  Usar fixtures sintéticas para ordenar os três próximos eventos, excluir canceled/completed/passados/data inválida, respeitar limite e gerar href canônico interno por slug e externo por source/sourceId/id.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/lib/home-journeys.test.ts`
  Expected: FAIL porque o helper não existe.

- [x] **Step 3: Implementar seleção pura**
  Normalizar datas uma vez, ordenar ASC por `startAt`, limitar com default 3 e mapear somente campos públicos do snapshot.

- [x] **Step 4: Verificar**
  Run: `cd frontend && npx vitest run src/lib/home-journeys.test.ts src/lib/event-path.test.ts`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/lib/home-journeys.ts frontend/src/lib/home-journeys.test.ts && git commit -m "feat(fase-10): seleciona atividades reais para a home"`

### Task 3: Componentes visuais da Home

**Files:**
- Create: `frontend/src/components/astro/home/HomeHero.astro`
- Create: `frontend/src/components/astro/home/HomeCommunities.astro`
- Create: `frontend/src/components/astro/home/HomeUmbrella.astro`
- Create: `frontend/src/components/astro/home/HomeActivities.astro`
- Create: `frontend/src/components/astro/home/HomeParticipation.astro`
- Test: `frontend/src/lib/home-journeys.test.ts`

**Interfaces:**
- Consumes: `HomeActivity[]`, `CommunityIndexEntry[]`, `getCommunityPrimaryLink()` e tokens/utilitários existentes.
- Produces: seções com headings `h1 → h2 → h3`, imagens dimensionadas e links reais.

- [x] **Step 1: Acrescentar teste falho do fallback de comunidade**
  Adicionar `getCommunityHomeHref(community)` ao helper, retornando link primário válido ou `/comunidades/<slug>`; testar slug codificado e ausência de `#`.

- [x] **Step 2: Confirmar a falha e implementar o helper**
  Rodar o teste da Task 2, ver FAIL, implementar e ver PASS antes dos componentes.

- [x] **Step 3: Implementar as cinco seções**
  Hero com texto/CTAs da spec; cartões de comunidades sem métricas; quatro passos institucionais; atividades com imagem real ou bloco tipográfico decorativo; participação com destinos existentes. Usar grid responsivo, `aspect-ratio`, foco visível e nenhum hex fora de tokens.

- [x] **Step 4: Verificar tipos**
  Run: `cd frontend && npm run check`
  Expected: PASS sem erros novos.

- [x] **Step 5: Commit**
  `git add frontend/src/components/astro/home frontend/src/lib/home-journeys* && git commit -m "feat(fase-10): cria seções da home por jornadas"`

### Task 4: Compor a Home e remover a apresentação anterior exclusiva

**Files:**
- Modify: `frontend/src/pages/index.astro`
- Modify: `frontend/src/components/islands/SocialProofStrip.tsx` somente se necessário para integração visual.
- Delete: `frontend/src/components/astro/HeroBanner.astro`, `FeaturesSection.astro`, `CommunitySection.astro` ou `JoinSection.astro` somente após confirmar que não possuem outros consumidores.
- Test: `frontend/src/lib/home-journeys.test.ts`
- Test: `frontend/src/lib/home-content.test.ts`

**Interfaces:**
- Consumes: `loadEventsIndex()`, `loadCommunitiesIndex()` e os componentes da Task 3.
- Produces: Home estática completa com title/description institucionais.

- [x] **Step 1: Escrever teste falho de composição**
  Criar `home-content.test.ts` lendo `pages/index.astro` e afirmando os imports/renderizações de HomeHero, HomeCommunities, HomeUmbrella, HomeActivities e HomeParticipation, além da ausência de HeroBanner/FeaturesSection na composição.

- [x] **Step 2: Confirmar a ausência na Home atual**
  Run: `cd frontend && npx vitest run src/lib/home-content.test.ts`
  Expected: FAIL porque a composição antiga permanece.

- [x] **Step 3: Substituir a composição**
  Carregar snapshots em build time, selecionar atividades com `new Date()`, manter `SocialProofStrip` somente com dados reais e renderizar empty state/link `/eventos` quando não houver atividades. Remover somente imports/componentes comprovadamente órfãos via busca.

- [x] **Step 4: Verificar HTML entregue**
  Run: `cd frontend && npx vitest run src/lib/home-content.test.ts && npm run build && node -e "const fs=require('fs');const s=fs.readFileSync('dist/index.html','utf8');for(const x of ['Uma associação que reúne comunidades de tecnologia','Como o guarda-chuva funciona','O que as comunidades estão fazendo'])if(!s.includes(x))process.exit(1)"`
  Expected: testes PASS e comando exit 0.

- [x] **Step 5: Commit**
  `git add frontend/src/pages/index.astro frontend/src/components frontend/src/lib/home-content.test.ts && git commit -m "feat(fase-10): posiciona home como associação de comunidades"`

### Task 5: Verificação visual e gate da entrega

**Files:**
- Modify: `docs/superpowers/plans/2026-11-18-home-journeys.md` para marcar somente passos concluídos.

- [x] **Step 1: Executar testes do portal**
  Run: `make astro-verify`
  Expected: build, check, Vitest, Function, smoke e diff-urls verdes.

- [x] **Step 2: Validar tenants por compartilhamento de layout**
  Run: `make astro-verify-tenants`
  Expected: quatro builds e URL gates verdes.

- [x] **Step 3: Exercitar a jornada visual**
  Em build local, abrir `/` em 360/768/1280 px nos dois temas; percorrer header/drawer/footer por Tab, Shift+Tab, Enter/Espaço e Esc; conferir ausência de overflow, um `main`, um `h1`, `aria-current` e links sem `#`. Registrar qualquer limitação no plano, sem declarar verificação visual se não houver evidência.

- [x] **Step 4: Commit final da etapa**
  `git add docs/superpowers/plans/2026-11-18-home-journeys.md && git commit -m "docs(fase-10): registra verificação da home e jornadas"`

## Evidência de execução — 2026-11-18

- `make astro-verify`: 149 arquivos/1.199 testes, Pages Function, smoke e paridade de 646 URLs aprovados.
- `make astro-verify-tenants`: codaqui, tisocial, elasnocodigo e devparana aprovados.
- Playwright Chromium: `/` em 360/768/1280 px, claro/escuro, sem overflow horizontal ou `href="#"`; um `main`, drawer aberto/fechado por Escape e `aria-current` em `/eventos` verificados.
- O smoke do `Makefile` e a revisão de produção foram atualizados porque protegiam a tagline/navegação anteriores, substituídas por esta spec.
- Nenhuma métrica fictícia ou tabela comparativa foi adicionada; sem eventos futuros válidos, a Home apresenta o empty state real.
