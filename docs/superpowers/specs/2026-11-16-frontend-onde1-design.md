<!-- AGENT-INDEX
purpose: Spec da Onda 1 (Fase 9a) do pacote pós-1.0.0 de frontend — correções P0/P1 de UX em páginas públicas, membro e admin, mais os menores deferidos de baixo risco do C4P. Sem mudança de system-design (Astro 7 + MUI v9 + tokens --cq-* preservados).
audience: Mantenedores, implementers e revisores da Onda 1.
status: Concluída e publicada em v1.0.2-backend pela PR #650; o filtro de janela da vitrine C4P está registrado na ADR 012.
sections:
  - Contexto e objetivo
  - Abordagens e por que esta onda
  - Escopo item a item (E1–E18)
  - Fora de escopo (ondas 2 e 3)
  - Decisões a ratificar
  - ADRs impactadas (nenhuma exceto nota opcional na 012)
  - Testes e gates
related-docs:
  - docs/plans/frontend-jornadas/README.md — mapa de jornadas e backlog (origem dos itens)
  - docs/plans/pos-1-0/README.md — roadmap pós-1.0.0 (ondas 2 e 3 a seguir)
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — system-design preservado
  - docs/adrs/011-frontend-astro-multi-tenant-pages.md — permanece válida
  - docs/adrs/012-c4p.md — possível nota sobre filtro de janela na vitrine (DECISÃO 4)
agent-protocol:
  - Não alterar framework, layouts, tokens nem o proxy; corrigir UX por jornada.
  - Zero hex solto fora de `tokens.css` (regra do design system — o fix de contraste usa tokens, nunca cores novas).
  - TDD onde houver comportamento novo (lib pura + ilhas com vitest; backend com jest).
  - Não portar PII de produção para testes (dados sintéticos).
-->

# Onda 1 (Fase 9a) — Correções P0/P1 de UX no frontend

## Contexto e objetivo

A revisão do frontend em jornadas (`docs/plans/frontend-jornadas/README.md`) mapeou os problemas reais em cada jornada. Esta onda endereça os de **maior visibilidade e menor risco** — sem mudar o system-design (Astro 7 + ilhas React/MUI v9 + Tailwind v4 com tokens `--cq-*`, layouts e proxy preservados). Não é refatoração de arquitetura: são correções pontuais de contraste, semântica, acessibilidade, confirmações, guard, filtros e textos, mais os menores deferidos de baixo risco da revisão independente do C4P.

## Abordagens e por que esta onda

- **A (mega-fase única)** — descartada: spec grande demais, valor só no fim.
- **B (por onda, aprovada)** — 3 ciclos pequenos com valor visível rápido: 9a (esta), 9b (robustez), 9c (consolidação estrutural).
- **C (por jornada)** — descartada: itens transversais (tokens, PageHero, hooks) seriam tocados em paralelo, gerando conflitos.

## Escopo item a item (E1–E18)

**E1. Link de documentação em `/transparencia`** — trocar `https://api.codaqui.dev/docs` (Swagger dev-only, 404 em prod) por `/desenvolvedores/api` (`transparencia.astro:83`).

**E2. h1 no `PageHero`** — o título do hero renderiza `<h2>` hoje (`PageHero.astro:48`): vira `<h1>` (SEO/landmarks). Verificar páginas que passam título próprio (continuam coerentes: hero com h1 + seções com h2).

**E3. Dark mode no Tailwind v4 (`dark:` por `data-theme`)** — as 5 páginas C4P usam classes `dark:` que hoje respondem a `prefers-color-scheme`, não ao `data-theme` do site. Adicionar em `frontend/src/styles/global.css` o `@custom-variant dark (&:where([data-theme="dark"] *));` — variante aditiva que ativa `dark:` apenas quando `html[data-theme="dark"]`, sem afetar outras páginas (o resto do site já usa `data-theme`). Isso cobre todas as classes `dark:*` existentes.

**E4. `<main id="conteudo">` aninhado nas páginas C4P** — `PublicLayout` já emite `<main id="conteudo">`; as 5 páginas C4P têm outro `<main id="conteudo">` dentro (id duplicado + landmarks ambíguos). Remover o `<main>` aninhado (o conteúdo fica no `<main>` do layout). Também `<main>` de `eventos/convite.astro` (sem id, aninhado igual).

**E5. Contraste primary-500 em ações e heróis** —
- `clube.astro:21` (BTN_SOLID `bg-primary-500 text-white`, 2.49:1) → `bg-action text-on-action` (primary-700+).
- Heróis em gradiente `primary-700→primary-500` com texto branco grande (`trilhas/index.astro:83,182`, `sobre/insights.astro:75`): parada final passa a `primary-700` (#378369, 4.55:1 ≥ 3:1 para texto grande).

**E6. Filtro `/eventos?source=<key>`** — o script inline da listagem não lê query string: ao carregar, aplicar o filtro `sourceKey` do query param (o mapa `statsByFilter` já existe em `eventos/index.astro`). Link "Ver todos" das comunidades volta a funcionar.

**E7. Rótulo e hierarquia de tabs no `/membro`** — sub-aba "SortCoins e reembolsos" vira **"Reembolsos"** (o conteúdo já é só isso, `WalletTab.tsx:147`). Hierarquia visual: sub-tabs com peso menor (fonte menor/inset), mantendo a ink bar MUI como indicador não-cor (guia `tabs`). Sem mudar deep links existentes (`member-navigation.ts`).

**E8. `aria-label` nos 21 IconButtons do admin** — adicionar nos que faltam (eventos/DescriptionMarkdownEditor, InternalEventAccordion, overrides/ActivationTab, EventOrdersDialog, hub/AdminHubApp, pagamentos, carteiras, empresas, overrides/OverridesTab, OrganizersTab, fornecedores).

**E9. Confirmação nas ações destrutivas** — usar `ModalConfirm`/Dialog MUI (padrão da casa) em: remover proposta (`C4pAdminDetailApp.tsx:135`), remover avaliador (`:294`), supressão (`EmailsCampaignsTab.tsx:643`), cancelar sorteio (`SorteiosApp.tsx:230`), remover staff (`useEventosMutations.ts:312`), e `window.confirm` de anúncios (`AnnouncementsAdminApp.tsx:90`).

**E10. Feedback estruturado no C4P admin** — substituir a heurística `includes("Não")` por `{ severity: "success"|"error", text }` em `C4pAdminDetailApp.tsx:154,309`.

**E11. Guard client-side em `C4pAdminApp`** — bloquear com mensagem/redirect quem não é `admin`/`event_organizer`/`diretor` (o detail já faz correto). Não mudar o guard de backend (já correto).

**E12. Typos e textos** — "Compartamento" → "Comportamento" (`content/pages/conduta.md:71` + TOC `sobre/conduta.astro:19`); chip "2026" da bio (`bio.astro:43`) vira ano corrente; hierarquia de headings em `projetos.astro:46-49` (h2 sr-only + h2 visível na mesma section).

**E13. Abas do Clube com estado na URL + `aria-labelledby` nos tabpanels** — deep linkável e acessível (`/participe/apoiar`, `/clube`).

**E14. C4P — `accept` exige `designation === 'evaluator'`** (hardening do endpoint, hoje inalcançável).

**E15. C4P — convite com `ILike` sem escape** — escapar `%`/`_` em `handleOrEmail` antes do `ILike` (ou casar igualdade case-insensitive em memória após `find` limitado).

**E16. C4P — teste "votos de avaliador removido continuam contando"** — cobre a regra já implementada no dashboard (impede regressão por filtro futuro de designation ativa).

**E17. C4P — aba Finalização carrega todas as propostas** — hoje cap 100 (o DTO aceita até 100/página). Iterar páginas até esgotar (evita seleção parcial em campanhas grandes).

**E18. C4P — `getEvaluatorCall` O(votes × talks) → Set de ids.**

## Fora de escopo (ondas 2 e 3)

Tabelas financeiras com paginação real; paginação unificada; `API_URL`→`resolveApiUrl`; `<dialog>` nativo→MUI; retry em erros; Skeleton; `/eventos` paginação real; números de mentoria do snapshot; atas/assembleias como fonte; datas de estudar; `/projetos/comprovante` sem código; doação por comunidade com contexto; monólitos extraídos; hooks compartilhados; DataTable ampliado; sidebar nova taxonomia; fonte única de comunidades.

## Decisões a ratificar

1. **Filtro de janela na vitrine/snapshot C4P (deferred minor 4)**: manter campanha `open` fora da janela na vitrine (CTA morto) ou filtrar por janela em `listPublic` e `getSnapshot`? **Recomendo filtrar por janela** (coerente com a página da ilha, que já recusa submissão fora dela) — com nota na ADR 012 se aprovado.
2. **Aviso da Onda 1 entra em produção como um só PR em `develop`** (commits em sequência, PR de acompanhamento aberto).

## ADRs impactadas

Nenhuma modificação de contrato. ADR 011 (frontend Astro) permanece válida. ADR 012 (C4P) pode ganhar nota curta se a Decisão 1 for aprovada (vitrine filtra por janela) — atualização documental, não de contrato. Demais ADRs intactas.

## Testes e gates

- **Frontend (vitest)**: `c4p.ts` loader (dark variant não é testável por unit — coberto por build), `C4pSubmissionIsland` (sem alteração de comportamento), `C4pAdminApp` (guard), `C4pAdminDetailApp` (feedback estruturado, confirmações), ilhas com novos estados (tabs do Clube).
- **Backend (jest)**: accept com designation correta (e negação), ILike escape, votos de removido contando, finalização com >100 propostas, progresso com Set.
- **Gates**: `npm run build && npx jest` (backend), `npm run test` (frontend), `npm run test:scripts`, `make astro-verify`, `make astro-verify-tenants` (global.css é compartilhado com os tenants).
