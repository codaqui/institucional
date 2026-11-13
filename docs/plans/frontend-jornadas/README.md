<!-- AGENT-INDEX
purpose: Revisão completa do frontend (público + admin) do portal Codaqui organizada em jornadas, com backlog de melhorias priorizado — inventário realizado em 2026-11-13 (3 varreduras independentes) SEM alterar o system-design (Astro 7 + ilhas React/MUI v9 + tokens Tailwind/--cq-* preservados).
audience: Presidência, mantenedores, AI agents executando melhorias de UX.
status: Revisão concluída; ondas de melhoria propostas, **mantidas em especificação** (não implementar ainda — mantenedor em 2026-11-13). Decisão de nav ratificada: `/c4p` entra na nav pública agora; `/universitario` e `/assembleias` entram só com conteúdo real.
sections:
  - Princípios e o que NÃO muda
  - Visões do site (personas) — eixo organizador
  - Mapa de jornadas (público, membro, admin)
  - Backlog de melhorias por jornada (P0/P1/P2)
  - Ondas de execução propostas
  - Conexão com o roadmap pós-1.0.0
related-docs:
  - docs/plans/pos-1-0/README.md — roadmap pós-1.0.0 (Fases 7.1, 7.2, 8, 8b, 9)
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — Fase 0 (o system-design que permanece)
  - docs/adrs/011-frontend-astro-multi-tenant-pages.md — arquitetura que permanece
agent-protocol:
  - NÃO alterar o system-design: sem mudança de framework, layout ou tokens. Melhorias por jornada, com TDD onde houver comportamento novo, e os gates padrão (`make astro-verify`, tenants).
  - Itens P0/P1/P2 são PRIORIDADE relativa, não aprovação — a presidência escolhe a onda.
  - Cada onda vira spec/plano próprios quando ratificada (ritual fases 1a-7).
-->

# Frontend em jornadas — revisão e plano de melhorias

## Princípios e o que NÃO muda

Preservados integralmente: **Astro 7 + ilhas React/MUI v9 + Tailwind v4 + tokens `--cq-*`**, layouts (`BaseLayout`/`PublicLayout`/`AppLayout`), proxy same-origin, snapshots em build, multi-tenant, Design System e o `url-reference.json` (paridade de URLs continua sendo gate). O trabalho é **UX por jornada**, não refatoração de arquitetura.

Boas práticas aplicadas nesta revisão (guias `modern-web-guidance`, IDs oficiais):
- **tabs**: tabs não são navegação de página; o tab selecionado exige indicador não-cor (underline via border em pseudo-elemento — não box-shadow/background).
- **card**: semântica `<article>`, ordem de fonte significativa, imagem com `aspect-ratio` + `object-fit: cover`, `alt=""` em imagens decorativas, layout adapta ao espaço do card (não do viewport).
- **navbar**: navegação responsiva com indicação da página atual.
- **accessibility**: estrutura/landmarks (h1, `main` único), nomes acessíveis (aria-label em botões-ícone), foco/teclado, formulários, regiões vivas, contraste.
- **css-layout**: layouts responsivos intrínsecos (container queries quando cabível).

## Visões do site (personas) — eixo organizador

O site atende **4 visões**. Elas devem guiar Home, navegação e rodapé (mockup: `docs/mockups/home-jornadas.html`); as "jornadas" por rota abaixo são o inventário técnico que alimenta cada visão.

| Visão | Quem | Objetivo | Rotas-chave | Lacunas atuais |
|---|---|---|---|---|
| **1. Aprender** | Pessoas querendo estudar | Cursos, mentoria, eventos, certificados | `/participe/estudar`, `/trilhas`, `/participe/mentoria`, `/eventos`, `/certificado/verificar` | Turmas "A confirmar"; mentoria com 1 mentor; fluxo sem noscript |
| **2. Comunidades** | Donos/organizadores e comunidades | Integrar-se, ter agenda/site/C4P, receber apoio com prestação de contas | `/comunidades`, `/comunidades/<slug>/*`, `/eventos`, `/c4p`, `/desenvolvedores/api` | **Sem CTA "integrar minha comunidade"** (rota `/comunidades/participar` a criar); `/comunidades` órfã de nav; duas fontes de verdade |
| **3. Apoiar** | Pessoas e empresas | Doar, assinar o Clube, apoiar projeto, patrocinar | `/participe/apoiar`, `/clube`, `/projetos`, `/patrocinadores`, `/empresas` | `/empresas` órfã; apoio a **projeto específico** não tem fluxo; assinatura pessoal invisível (P7) |
| **4. Acompanhar/auditar** | Sociedade pública | Verificar contas, atas, impacto, projetos, dados abertos | `/transparencia`, `/assembleias`, `/sobre/insights`, `/projetos`, `/sobre/ong`, `/desenvolvedores/api` | Transparência escondida no rodapé; **sem visão por comunidade** (contas/atividade por comunidade); `/assembleias` vazia; insights com números hardcoded divergentes |

**Home**: hero com h1 + 4 atalhos de visão → faixa de números (snapshots) → um bloco por visão (CTA primário + 4-6 caminhos) → vitrine viva (evento, C4P, blog).
**Navegação proposta**: Aprender · Comunidades · Eventos · Apoiar · Transparência · Blog (+ botão Apoiar). C4P e Projetos ficam dentro das visões (Comunidades e Apoiar/Acompanhar) em vez de itens soltos — **substitui a decisão anterior de colocar C4P direto na nav; a ratificar**. **Rodapé**: 4 colunas = as 4 visões.
**Novos itens de backlog derivados** (P1): CTA/landing "Integrar minha comunidade"; página de transparência por comunidade (`/comunidades/<slug>/transparencia`) reutilizando ledger/horas/eventos filtrados por comunidade; seletor "apoiar um projeto"; Transparência promovida à nav principal.

## Mapa de jornadas

### A. Jornadas públicas

| Jornada | Rotas | Fonte de dados | Estado |
|---|---|---|---|
| Conhecer a associação | `/`, `/sobre/ong`, `/sobre/equipe`, `/sobre/insights`, `/sobre/titulos`, `/sobre/conduta`, `/sobre/pais-responsaveis`, `/sobre/privacidade`, `/termos-de-compra`, `/contato`, `/bio` | estático + social-stats + donors runtime | OK, com issues P1/P2 |
| Eventos | `/eventos`, `/eventos/[...path]`, `/eventos/detalhe`, `/eventos/convite`, `/eventos/comprovante` | snapshot 415 eventos + API | OK, com issues P1 (peso, filtro query) |
| Apoiar financeiramente | `/participe/apoiar`, `/clube`, `/patrocinadores`, `/empresas`, `/transparencia`, `/descadastro` | API runtime + Stripe | OK, com issues (JS-dependência, headings) |
| Aprender | `/trilhas`, `/trilhas/[...slug]`, `/participe/estudar`, `/regex` | content collections | OK, com issues (datas, órfã) |
| Blog | `/blog`, `/blog/page/*`, `/blog/[...slug]`, categorias/autores | content collection | OK, com issue P8 |
| Comunidades | `/comunidades`, `/comunidades/<slug>/*` | snapshot registro + configs | conteúdo bom, **órfã de nav** |
| Mentoria | `/participe/mentoria`, `/mentoria/sessao` | snapshot (1 mentor) + API | funcional, dados mínimos, sem noscript |
| C4P | `/c4p`, `/c4p/<slug>/submeter`, `/c4p/<slug>/resultado`, `/c4p/avaliar*` | snapshot (0 campanhas) + API | lançado, **bugs próprios** (dark variant, main aninhado, órfã) |
| Universitário | `/universitario` | snapshot (0 IES) | vazia + órfã (aguarda conteúdo real) |
| Projetos de extensão | `/projetos`, `/projetos/[slug]`, `/projetos/comprovante` | data estático + snapshot (0) | seção dinâmica vazia |
| Assembleias | `/assembleias`, `/assembleias/<entity>/<slug>` | snapshot (0) + Giscus | vazia + órfã (aguarda assembleia real) |
| Membros/perfis | `/membros`, `/membros/perfil`, `/@handle` | API + build members | OK |
| Verificações | `/certificado/verificar`, `/projetos/comprovante` | API | OK |
| Desenvolvedores/design | `/desenvolvedores/api`, `/design-system`, `/busca` | estático + code-split | OK, com link quebrado em transparencia (P0) |

### B. Jornada do membro (`/membro`, `/@handle`, `/clube`)

4 abas top-level: **Visão geral** (6 cards + ações), **Participação** (Eventos/Certificados/Projetos; Eventos tem sub-sub-Tabs Futuros/Comprei/Histórico — 3 níveis), **Financeiro** (Doações/Assinaturas/"SortCoins e reembolsos"), **Conta e privacidade**. Perfil público `/@handle` é automático (build). Clube tem ilha de carteira/sorteios com abas inline.

### C. Jornadas admin (25 páginas, 70 arquivos/22.885 linhas)

| Jornada | Páginas | Complexidade/estado |
|---|---|---|
| Membros & acesso | `/admin` (hub) | tabela + 3 modais, PAGE_SIZE=20 hardcoded |
| Pessoas & horas | `/admin/horas` | OK |
| Mentoria | `/admin/mentoria` | **bem modular — modelo a seguir** |
| Financeiro | `/admin/lancamento`, `/admin/reembolsos`, `/admin/fornecedores`, `/admin/pagamentos`, `/admin/recebimentos`, `/admin/carteiras` | **a mais afetada**: tabelas sem paginação |
| Clube & SortCoins | `/admin/sorteios` | OK |
| Empresas | `/admin/empresas` | OK, sem paginação |
| Eventos | `/admin/eventos`, `/admin/overrides`, `/admin/eventos-checkin` | bem fatiada em hooks; `ActivationTab` 1.081 linhas |
| C4P | `/admin/c4p`, `/admin/c4p/detalhe` | list OK; detail média-alta |
| Governança | `/admin/comunidades`, `/admin/assembleias`, `/admin/entidades`, `/admin/projetos`, `/admin/diretorias`, `/admin/universitario`, `/admin/configuracoes` | **monólitos** (assembl. 1.004, comunidades 836, diretorias 668) |
| Comunicação | `/admin/emails`, `/admin/announcements` | `EmailsCampaignsTab` 1.429 linhas (maior arquivo) |

## Backlog de melhorias por jornada

Prioridades: **P0** = quebra usuário · **P1** = UX ruim, entra no próximo ciclo · **P2** = polish/consistência.

### P0 — confirmado

| # | Issue | Evidência | Onda |
|---|---|---|---|
| P0-1 | Link "Ver documentação completa" em `/transparencia` aponta para Swagger dev-only (404 em prod se `SWAGGER_ENABLED` ausente) | `frontend/src/pages/transparencia.astro:83`; alternativa pronta `/desenvolvedores/api` | 1 |

### P1 — por jornada

**Global/transversal**
- **Sem h1 na maioria das páginas públicas** — `PageHero.astro:48` renderiza o título como `<h2>` (afeta ~16 rotas: /sobre/*, /eventos, /transparencia, /comunidades, /projetos, /patrocinadores, /empresas, /membros, /clube, /participe/*, /universitario, /c4p, /sobre/titulos, /desenvolvedores/api, /contato). **Onda 1.**
- **Páginas órfãs de navegação** — `/comunidades`, `/c4p`, `/universitario`, `/assembleias`, `/empresas`, `/regex` não constam no header (`SiteHeader.astro:5-33`) nem no footer. **Onda 1 (nav) + decisão de conteúdo (abaixo).**
- **C4P: dark variant e main duplicado** — as 5 páginas C4P usam classes `dark:` sem `@custom-variant dark` no Tailwind v4 (responde a `prefers-color-scheme`, não a `data-theme`) e `<main id="conteudo">` aninhado ao do `PublicLayout` (skip-link/landmarks ambíguos). **Onda 1 (nosso próprio bug).**
- **Dependência total de JS sem noscript** — só 4 páginas têm fallback; `/clube`, `/participe/mentoria`, `/desenvolvedores/api` e CTAs de evento renderizam vazio sem JS. **Onda 2 (fallbacks progressivos).**
- **Contraste primary-500 como texto/fundo acionável** — botão `bg-primary-500 text-white` (`clube.astro:21`) = 2.49:1; heróis em gradiente `primary-700→500` com texto branco (`trilhas/index.astro:83,182`, `sobre/insights.astro:75`) violam a regra do próprio DS (texto grande exige 3:1). **Onda 1.**

**Eventos**
- **Peso do HTML** — os 415 eventos passados são renderizados no HTML (filtro só via CSS): página inicial pesada. **Onda 2 (paginação real/por fonte).**
- **Filtro por fonte ignorado na query string** — `/eventos?source=<key>` (link "Ver todos" das comunidades) é ignorado pelo script inline. **Onda 1.**

**Membro**
- **"SortCoins e reembolsos" contém apenas reembolsos** — rótulo errado (`WalletTab.tsx:147`); doações/assinaturas/reembolsos aparecem em 3 lugares cada. **Onda 1 (rótulo) + Onda 2 (consolidação).**
- **Tabs aninhadas em 3 níveis com mesmo peso visual** (`EventsTab.tsx:343`; `MemberDashboardApp.tsx:467,565,574`) e sem indicador não-cor consistente — guia `tabs` exige indicador via border. **Onda 1 (hierarquia visual).**
- **Deep link impossível nas abas do Clube** (sem estado na URL) e `tabpanel` sem `aria-labelledby` (`/participe/apoiar`, `/clube`). **Onda 1 (a11y).**

**Admin**
- **Ações destrutivas sem confirmação** — remover proposta C4P (`C4pAdminDetailApp.tsx:135`), remover avaliador (`:294`), supressão de campanha (`EmailsCampaignsTab.tsx:643`), cancelar sorteio (`SorteiosApp.tsx:230`), remover staff (`useEventosMutations.ts:312`) — todos DELETE direto no clique. **Onda 1 (ModalConfirm existente).**
- **`window.confirm` nativo** fora do padrão (`AnnouncementsAdminApp.tsx:90`). **Onda 1.**
- **21 dos 26 IconButtons sem `aria-label`** — eventos, overrides, orders, hub, pagamentos, carteiras, empresas, fornecedores. **Onda 1.**
- **Tabelas financeiras sem paginação** — reembolsos, fornecedores, pagamentos, recebimentos, sorteios, empresas. **Onda 2 (DataTable + PaginationControls).**
- **Heurística de erro/sucesso por substring `"Não"`** — `C4pAdminDetailApp.tsx:154,309`. **Onda 1 (useFeedback estruturado).**
- **`C4pAdminApp` sem guard client-side** — qualquer membro logado abre a tela e falha no fetch (o detail já faz certo). **Onda 1.**
- **Paginação em 4 sabores** — PaginationControls (14 ilhas ✓), `<Pagination>` MUI cru (2), `TablePagination` (1), nenhuma (6+). **Onda 2.**
- **`API_URL` cru em vez de `resolveApiUrl`** — 8 arquivos (`overrides/*`, `ReembolsosApp`, `PagamentosApp`, `RecebimentosApp`, `EventosAdminApp`). **Onda 2.**
- **`<dialog>` nativo misturado com MUI Dialog** — `overrides/ActivationTab.tsx:790-817`. **Onda 2.**
- **Estados de erro sem retry** — só 2 ilhas têm "Tentar novamente"; padrão da decisão 16 deve virar norma. **Onda 2.**
- **Loading sempre `CircularProgress`, zero Skeleton** — tabelas pulsam. **Onda 2.**

**Conteúdo/dados**
- **Páginas publicadas mas vazias** — `/universitario` (0 IES), `/assembleias` (0), `/c4p` (0 campanhas): indexáveis sem conteúdo e sem entrada de nav. **Decisão: manter `/universitario` e `/assembleias` fora da nav até conteúdo real; `/c4p` entra na nav agora (a feature é real e o empty state orienta) — ratificar.**
- **Duas fontes de verdade para comunidades** — `data/communities.ts` (7 hardcoded em /sobre/ong, /sobre/insights) vs snapshot registro (6 em /comunidades, home). **Onda 3 (fonte única = snapshot).**
- **Números de mentoria divergentes** — `/sobre/insights` diz "126+ mentorias/89h+" hardcoded vs snapshot real (54 concluídas); timeline 2025 diz "95 — recorde". **Onda 2.**
- **"Atas de Reuniões" no Google Drive legado** (`/sobre/ong:219`) — duplicará `/assembleias` quando populado. **Onda 2.**
- **5 avatares ghost na equipe** (`data/team.ts` — Everton, Gustavo, Fernando, Gabriel, Geovane) + equipe desconectada (já na Fase 8 do roadmap). **Fase 8, não aqui.**
- **Estudar: 7 de 11 turmas "A confirmar"** e selo "Certificado — Em desenvolvimento" coexistindo com o fluxo real de certificados. **Onda 2.**
- **Typo "Compartamento"** no Código de Conduta (`content/pages/conduta.md:71` + TOC `sobre/conduta.astro:19`). **Onda 1.**
- **Chip "2026" hardcoded na bio** (`bio.astro:43`). **Onda 1.**
- **`projetos.astro:46-49`** — h2 `sr-only` + h2 visível na mesma section (hierarquia confusa). **Onda 1.**
- **`/projetos/comprovante` sem `?code=`** mostra só instrução (sem UX de erro). **Onda 2.**
- **Deep link de doação por comunidade perde contexto** — `authCommunitySlug` não portado (`CommunityApoiarPage.astro:13`). **Onda 2.**

### P2 — consolidação estrutural (Onda 3)

1. **Guard de acesso repetido em ~23 ilhas** → hook `useRequireAccess({roles, designations})` (o `canSee` da nav e os guards de página podem divergir hoje).
2. **Autocomplete de membro em ≥4 lugares** → `MemberAutocomplete` compartilhado (staff, organizer, mentor, vendors).
3. **Feedback em 3 formatos** → `useFeedback()` + `<FeedbackAlert>` (resolve a heurística "Não" de P1 também).
4. **Fetch + parseAuthJson + loadError copiado** → `useAuthQuery<T>(path)` com retry embutido (resolve P2-6 junto).
5. **`DataTable` subutilizado** (só hub + carteiras) — ampliar com filtros/empty state/skeleton e migrar as tabelas sem paginação.
6. **Paginação consolidada** na lib + PaginationControls/DataTable.
7. **`TabPanel` ignorado pelo `CheckinApp`** (reimplementa render condicional).
8. **Monólitos >800 linhas** (5 arquivos) — extrair hooks/dialogs no modelo `useEventos*` (Events já mostra o caminho).
9. **Nova taxonomia da sidebar admin** (resolve P10: órfãos, grupos de 1 item, Universitário fora de "Programas", role-vs-designation misto em Governança, C4P dentro de Eventos, "Configurações" solitária, label "Carteira"≠"Lançamento").
10. **Unidades de estudo/SEO**: avaliar `client:only` em páginas que poderiam ser `client:visible` (render inicial com conteúdo).

## Ondas de execução propostas

**Onda 1 — correções P0/P1 baratas (1-2 PRs):** P0-1 (link docs); h1 no PageHero; C4P dark variant + main id; contraste primary-500; filtro `/eventos?source=`; rótulo "Reembolsos" no /membro + indicador de tabs (guia tabs); aria-labels dos IconButtons; confirmações destrutivas + `window.confirm`; feedback estruturado C4P; guard C4pAdminApp; typos/chip bio/headings projetos; abas do Clube com estado na URL + `aria-labelledby`.
**Onda 2 — robustez e dados (1-2 PRs):** tabelas financeiras com paginação real; paginação unificada; API_URL→resolveApiUrl; `<dialog>` nativo→MUI; error states com retry; Skeleton no lugar de CircularProgress nas tabelas; /eventos paginação real; números de mentoria do snapshot; atas/assembleias como fonte; estudar datas; /projetos/comprovante sem código; doação por comunidade com contexto; monólitos (extração dos 5 arquivos grandes).
**Onda 3 — consolidação estrutural (1-2 PRs):** hooks compartilhados (`useRequireAccess`, `useFeedback`, `useAuthQuery`, `MemberAutocomplete`), DataTable ampliado, sidebar nova taxonomia, fonte única de comunidades, revisão de `client:only`→`client:visible`.
**Decisões ratificadas (2026-11-13):** (a) `/c4p` **entra na nav pública agora**; `/universitario` e `/assembleias` **entram só com conteúdo real**. (b) Ondas 1→3 **mantidas em especificação por ora** — execução fica para um momento posterior, quando a presidência liberar (prioridade atual é o rollout do C4P e as pendências operacionais).

## Conexão com o roadmap pós-1.0.0

Este documento detalha a **Fase 9** do roadmap (`pos-1-0/README.md`) e a "onda 2 de consolidação de frontend". As demandas funcionais (P1 mentoria, P3 equipe, P4 ONG, P6/P7 projetos/patrocínio, P12 cadastro) seguem nas fases 7.2/8/8b do roadmap — este doc cobre a **revisão de UX de todo o frontend** e não as substitui.
