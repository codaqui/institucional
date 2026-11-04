<!-- AGENT-INDEX
purpose: Plano executável da Fase 1b do Codaqui 1.0.0 — refinamento de navegação, privacidade por campo, Meus dados, P1–P3 e busca Pagefind no portal.
audience: AI agents e mantenedores executando a Fase 1b.
status: em implementação — tasks 1–6 concluídas; documentação/release e revisão final em andamento; backend 0.13.0.
sections:
  - Escopo e constraints
  - Baseline e arquitetura
  - Tasks 1–7 com TDD, comandos e commits
  - Critérios de pronto, gates e handoff
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe e escopo aprovado
  - docs/plans/codaqui-1-0/fase-1a.md — fundações concluídas
  - docs/plans/codaqui-1-0/rbac.md — designations e visibilidade pública
  - docs/plans/codaqui-1-0/transversais.md — decisão Pagefind e LGPD de operadores
  - docs/plans/codaqui-1-0/eca-lgpd.md — conteúdo obrigatório sobre crianças e adolescentes
  - AGENTS.md — gates, proxy, paginação, acessibilidade e design tokens
agent-protocol:
  - Não iniciar implementação sem comando explícito do mantenedor.
  - Executar as tasks em ordem, uma branch e um PR para a fase, com um commit por task.
  - Hour ledger, guest tokens, cutover de ownership, Autônoma/D2/split, redesenho completo de /@handle e C4P ficam fora deste plano.
-->

# Fase 1b — UX e Transversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar a navegação e o autosserviço do membro sem alterar os fluxos de eventos, doações ou tenants: sidebar/menu de perfil, `profileVisibility`, aba Meus dados, Política de Privacidade, Código de Conduta renovado e busca Pagefind no portal.

**Architecture:** Uma branch `feat/fase-1b-ux-transversal` criada a partir de `develop`, um PR e um commit por task. O backend recebe somente a migration aditiva `032` e endpoints de visibilidade; o frontend mantém páginas Astro finas e ilhas MUI. O backend sobe para `0.13.0` antes do merge. Pagefind roda somente no build codaqui, sem alterar os builds dos tenants.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Jest 30, Astro 7, React 19, MUI 9, Vitest 3, Pagefind, Node 24.

**Spec:** `docs/plans/codaqui-1-0/README.md`, com os contratos detalhados em `rbac.md`, `transversais.md` e `eca-lgpd.md`.

## Global Constraints

- Não implementar `hour_ledger`, guest tokens, cutover de `event_organizer_ownerships`, Autônoma/D2/split, redesenho completo de `/@handle` ou C4P.
- Não criar layout admin paralelo: refinar `AppLayout`, `AppNavIsland` e `NavbarAuth` existentes, inclusive drawer mobile e estados por role/designation.
- Preservar o comportamento público atual por padrão. Novas chaves de visibilidade só restringem quando o membro opta por ocultar; e-mail nunca é público.
- APIs de gestão não usam o prefixo `/admin/`; páginas `/admin/*` continuam assets estáticos e a allow-list do proxy permanece estreita.
- Zero hex fora de `tokens.css`; MUI 9 com `sx`/`slotProps`; Grid com `size`; hierarquia de headings e navegação por teclado preservadas.
- Pagefind somente no portal codaqui. `/busca` é noindex e fica fora do sitemap; tenants não recebem a dependência nem o índice.
- Textos legais passam por revisão humana antes da publicação. Não declarar ausência absoluta de PII nem de dados de adolescentes; incluir operadores e tratamento Turnstile quando aplicável.
- Toda alteração de visibilidade grava audit de governo. Nenhum segredo ou PII real entra em código, fixtures ou documentação.
- Gates finais obrigatórios: `make astro-verify`, `make astro-verify-tenants`, `npm run test:scripts`, `cd backend && npm run build && npx jest --silent`.

## Baseline e arquitetura

- Fase 1a concluída com migrations 026–031, designations, diretorias, comunidades, E1, R1, Turnstile e ECA.
- Backend `0.12.3` inclui hardening das migrations e correção do callback OAuth HTTP/HTTPS.
- Astro e API local compartilham o Compose; `/admin/eventos` e `/admin/overrides` têm smoke autenticado no browser e o bundle de eventos não pode reintroduzir built-ins Node.
- A migration `032` adiciona `members.profileVisibility jsonb NOT NULL DEFAULT '{}'::jsonb`. Um objeto vazio preserva o comportamento anterior.
- O endpoint público de membros aplica a visibilidade antes do build de `/@handle`; snapshots individuais adicionais e o redesenho visual do perfil ficam para a Fase 2.

### Task 1: Sidebar admin e menu de perfil

**Files:**
- Modify: `frontend/src/layouts/AppLayout.astro`
- Modify: `frontend/src/components/islands/AppNavIsland.tsx`
- Modify: `frontend/src/components/islands/__tests__/AppNavIsland.test.tsx`
- Modify: `frontend/src/components/islands/NavbarAuth.tsx`
- Modify: `frontend/src/components/islands/__tests__/NavbarAuth.test.tsx`
- Modify: `frontend/src/lib/header-menu.ts` e testes, se necessário

**Interfaces:**
- Sidebar agrupada por sistema de valor, busca/filtro, submenus acessíveis, item ativo por prefixo e seções ocultas quando vazias.
- Menu de perfil com identidade, chips de roles/designations, grupos Conta/Gestão/Sessão e link para Privacidade.
- Nenhuma mudança nas regras de autorização do backend.

- [x] **Step 1: Write failing navigation tests**
  Cobrir grupos, filtro, item ativo por prefixo, seção vazia, roles/designations, drawer mobile, foco/teclado e link de privacidade. Preservar os casos atuais.
- [x] **Step 2: Implement the refined sidebar and profile menu**
  Manter sidebar 240px, drawer e topbar atuais. Não duplicar menus nem criar outro layout.
- [x] **Step 3: Verify behavior in browser**
  Conferir desktop/mobile, ESC, clique fora, single-open, navegação por teclado e usuários com papéis distintos.
- [x] **Step 4: Run focused tests**
  `cd frontend && npx vitest run src/components/islands/__tests__/AppNavIsland.test.tsx src/components/islands/__tests__/NavbarAuth.test.tsx src/lib/header-menu.test.ts`
- [x] **Step 5: Commit**
  `git add frontend/src/layouts/AppLayout.astro frontend/src/components/islands frontend/src/lib/header-menu* && git commit -m "feat(fase-1b): agrupa navegação admin e menu de perfil"`

### Task 2: Migration 032 e API de visibilidade do perfil

**Files:**
- Create: `backend/src/migrations/<timestamp>-Migration032_ProfileVisibility.ts`
- Modify: `backend/src/members/entities/member.entity.ts`
- Create: `backend/src/members/dto/update-profile-visibility.dto.ts`
- Create: `backend/src/members/profile-visibility.ts` e testes
- Modify: `backend/src/members/members.service.ts` e testes
- Modify: `backend/src/members/members.controller.ts` e testes
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/app.module.ts` se necessário

**Interfaces:**
- `members.profileVisibility`: objeto JSON com chaves conhecidas para bio, LinkedIn, roles, membro desde, eventos, certificados, horas, doações, SortCoins e designations.
- `GET /members/me/visibility`: configuração efetiva e metadados explicativos.
- `PATCH /members/me/visibility`: whitelist estrita de chaves/booleanos, audit e retorno da configuração efetiva.
- Serialização pública de `/@handle` omite campos ocultos; e-mail nunca aparece, independentemente do payload.

- [x] **Step 1: Write failing visibility tests**
  Cobrir default compatível, chave desconhecida, valor não booleano, e-mail sempre privado, ocultar/restaurar campo, audit e ausência de dados ocultos no payload público.
- [x] **Step 2: Create migration and visibility helpers**
  `DEFAULT_PROFILE_VISIBILITY` e `resolveProfileVisibility` são a única fonte de defaults/fusão. `up` aditivo; `down` remove somente a coluna.
- [x] **Step 3: Implement API and public filtering**
  Validar com DTO, aplicar no service e testar o payload público antes da geração das páginas.
- [x] **Step 4: Validate against restored production copy**
  Restaurar dump descartável, executar 026–032, conferir membros preservados e defaults inalterados; testar `down`/`up` da 032 no banco descartável.
- [x] **Step 5: Run focused tests**
  `cd backend && npx jest src/members src/common/allowed-origins.spec.ts --runInBand`
- [x] **Step 6: Commit**
  `git add backend/src/migrations backend/src/members backend/src/audit backend/src/app.module.ts && git commit -m "feat(fase-1b): adiciona visibilidade por campo ao perfil"`

### Task 3: Aba Meus dados e autosserviço de privacidade

**Files:**
- Modify: `frontend/src/components/islands/MemberProfileIsland.tsx` ou decomposição equivalente existente
- Create: componentes específicos de Meus dados sob `frontend/src/components/islands/member/`
- Create: testes dos componentes e do contrato de visibilidade
- Modify: `frontend/src/lib/api-proxy-paths.ts` somente se um prefixo novo for indispensável

**Interfaces:**
- Aba Meus dados mostra dados coletados, fonte, finalidade e controles por campo.
- Salvar usa `authFetch`, exibe sucesso/erro e atualiza a configuração sem exigir logout.
- Explica quando uma alteração passa a valer no perfil público/build.

- [x] **Step 1: Write failing island tests**
  Cobrir carregamento, defaults, toggles, save, erro da API, e-mail somente leitura e mensagem de propagação.
- [x] **Step 2: Implement Meus dados**
  Reutilizar padrões admin/membro, tokens e componentes compartilhados; não criar uma segunda API no cliente.
- [x] **Step 3: Verify end to end**
  Alterar visibilidade, confirmar audit e ausência do campo no payload público após rebuild/refresh aplicável.
- [x] **Step 4: Run focused tests**
  `cd frontend && npx vitest run src/components/islands/member src/components/islands/__tests__`
- [x] **Step 5: Commit**
  `git add frontend/src/components/islands frontend/src/lib/api-proxy-paths* && git commit -m "feat(fase-1b): adiciona Meus dados e controles de privacidade"`

### Task 4: P1/P2 — Política de Privacidade e inventário de tratamentos

**Files:**
- Create: `docs/modules/privacy/README.md`
- Create: `docs/modules/privacy/treatments.md`
- Create: `frontend/src/pages/sobre/privacidade.astro`
- Modify: `frontend/src/components/astro/SiteFooter.astro` ou footer equivalente
- Modify: `frontend/src/components/islands/NavbarAuth.tsx` e testes
- Modify: `docs/README.md`

**Interfaces:**
- Página pública por perfil de titular: visitante, membro, mentorando, empresa e palestrante C4P futuro.
- Inventário: dado → fonte → finalidade → acesso/compartilhamento → retenção → direitos/canal.
- Seção específica de crianças e adolescentes, operadores, GitHub/Stripe/Google/SMTP/Cloudflare e retenções E1/G6.

- [x] **Step 1: Draft inventory before legal copy**
  Preencher o inventário com os tratamentos reais do código; marcar revisão jurídica como gate humano.
- [x] **Step 2: Publish the privacy page and links**
  URL `/sobre/privacidade`, footer e menu do perfil. Conteúdo revisável, sem promessas absolutas.
- [x] **Step 3: Verify content and navigation**
  Conferir links, headings, responsividade, contraste e presença no sitemap após revisão humana.
- [x] **Step 4: Commit**
  `git add docs/modules/privacy docs/README.md frontend/src/pages/sobre/privacidade.astro frontend/src/components/astro frontend/src/components/islands/NavbarAuth.tsx frontend/src/components/islands/__tests__/NavbarAuth.test.tsx && git commit -m "docs(fase-1b): publica privacidade e inventário de tratamentos"`

### Task 5: P3 — UI do Código de Conduta sem alterar o texto

**Files:**
- Modify: página/conteúdo atual de `frontend/src/pages/sobre/conduta*` e componentes associados
- Create: testes/smoke de navegação da página
- Modify: links cruzados com `/sobre/privacidade`

**Interfaces:**
- Hero, resumo em cards, TOC responsivo, destaque para Como reportar, contato e versão print-friendly.
- Texto canônico preservado integralmente e URL mantida; link para Privacidade.

- [x] **Step 1: Write failing page smoke tests**
  Verificar TOC, heading hierarchy, contato, link cruzado e preservação do conteúdo.
- [x] **Step 2: Implement responsive layout**
  Usar tokens e componentes de servidor sempre que possível; sem JS desnecessário.
- [x] **Step 3: Verify desktop, mobile and print**
  Conferir TOC, foco, contraste e impressão.
- [x] **Step 4: Commit**
  `git add frontend/src/pages/sobre frontend/src/components && git commit -m "feat(fase-1b): renova apresentação do código de conduta"`

### Task 6: G4 — Pagefind somente no portal codaqui

**Files:**
- Modify: `frontend/package.json` e `frontend/package-lock.json`
- Modify: `frontend/astro.config.mjs`
- Create: `frontend/src/pages/busca.astro`
- Create: integração Pagefind e testes
- Modify: `frontend/src/layouts/BaseLayout.astro`
- Modify: `frontend/src/components/astro/SiteHeader.astro` e navegação mobile
- Modify: `frontend/scripts/diff-urls.mjs`/smoke se necessário

**Interfaces:**
- `pagefind --site dist` somente no build sem `TENANT`; índice em `dist/pagefind/`.
- `/busca` noindex/fora do sitemap, UI pt-BR e carregamento sob demanda.
- Excluir rotas noindex, app autenticado, `/_*` e o próprio índice; link Buscar e atalho `/` fora de formulários.

- [x] **Step 1: Write failing search contract tests**
  Cobrir decisão codaqui × tenant, exclusões, atalho de teclado e presença do índice no build.
- [x] **Step 2: Add Pagefind and portal-only build wiring**
  Instalar a versão compatível registrada no lockfile; não executar o índice em builds tenant.
- [x] **Step 3: Implement search page and navigation**
  Usar UI oficial, pt-BR, noindex, carregamento sob demanda e fallback sem JS.
- [x] **Step 4: Verify real search**
  Executar build codaqui e confirmar que um termo de blog/trilha retorna resultado; builds tenant não contêm `dist/pagefind/`.
- [x] **Step 5: Commit**
  `git add frontend/package.json frontend/package-lock.json frontend/astro.config.mjs frontend/src frontend/scripts && git commit -m "feat(fase-1b): adiciona busca Pagefind ao portal"`

### Task 7: Documentação, release e handoff

**Files:**
- Modify: `backend/package.json` e `backend/package-lock.json` para `0.13.0`
- Modify: `docs/plans/codaqui-1-0/README.md`
- Modify: `docs/README.md`
- Create/update: ADR ou documentação viva de privacidade/navegação aplicável

- [ ] **Step 1: Update living documentation**
  Marcar tasks concluídas, registrar comportamento de visibilidade e decisões Pagefind sem alterar o escopo da Fase 2.
- [ ] **Step 2: Run all required gates**
  `cd backend && npm run build && npx jest --silent`; `make astro-verify`; `make astro-verify-tenants`; `npm run test:scripts`.
- [ ] **Step 3: Verify the production-like journey**
  Compose em HTTP e HTTPS, login real, Meus dados, payload público, conduta, privacidade e busca. Restaurar dump e validar 026–032.
- [ ] **Step 4: Commit**
  `git add backend/package.json backend/package-lock.json docs && git commit -m "chore(fase-1b): prepara release 0.13.0 e handoff"`

## Completion Checklist

- [ ] Sidebar e menu de perfil agrupados, acessíveis e testados em desktop/mobile.
- [ ] Migration 032 validada em cópia real; visibilidade por campo e e-mail sempre privado.
- [ ] Meus dados funciona ponta a ponta com audit e sem logout.
- [ ] Política publicada após revisão humana; inventário reflete o código.
- [ ] Conduta renovada sem alterar o texto; busca funcional somente no portal.
- [ ] Todos os gates verdes e backend `0.13.0` publicado pelo workflow manual.
- [ ] Fase 2 preparada sem antecipar hour ledger, guest tokens ou cutover de ownership.

## Handoff para a Fase 2

A Fase 2 começa somente após comando explícito e deve consumir: designations/roles, directorates, check-in atômico, `profileVisibility`, Meus dados e a política publicada. O plano da Fase 2 precisa detalhar `hour_ledger`, dual-write/seed/cutover de `event_organizer_ownerships`, guest claim com Turnstile, três fontes de horas, aprovações e o redesenho de `/@handle` respeitando a visibilidade entregue aqui.
