# Fix community UX — toggle de tema + contraste dark AA (Fase 0.5)

**Data:** 2026-10-27 · **Branch:** `fix/fase-0-5-community-ux` (worktree `.worktrees/fix-community-ux`, base `develop`)
**Status:** ✅ concluído — 2 fixes reportados em produção (tisocial.org.br etc.) + auditoria WCAG AA completa.

---

## FIX 1 — Toggle de tema ausente no CommunityLayout

**Problema:** `CommunityLayout.astro` tinha o script anti-FOUC (`localStorage["cq-theme"]` → `data-theme`), mas nenhum controle para o usuário alternar — as regras `[data-theme="dark"]` ficavam inertes para quem não tinha tema salvo/system dark.

**Decisão:** adicionada a MESMA ilha `ThemeToggle` (`frontend/src/components/islands/ThemeToggle.tsx`) usada pelo `SiteHeader` do portal, como último `<li>` do `<ul>` do nav do tenant (`client:load`, wrapper `li.flex items-center`).

**A ilha precisou de ajuste? Não.** Verificação das premissas dela no contexto de comunidade:

- **Storage/semântica:** a ilha lê/escreve `document.documentElement.dataset.theme` + `localStorage["cq-theme"]` — chave e valores idênticos ao script anti-FOUC do `<head>` do CommunityLayout (e do BaseLayout do portal). Sem divergência de semântica.
- **Dependências:** não importa nada do SiteHeader; usa apenas utilitários Tailwind (`rounded-full p-2 text-text-primary hover:bg-sunken`) sobre os tokens `--cq-*`, disponíveis porque o CommunityLayout importa `styles/global.css`. `text-text-primary`/`bg-sunken` no header `bg-surface` passam AA em ambos os temas.
- **Builds tenant e codaqui:** ilhas React já eram usadas em componentes de comunidade (`CommunityApoiarPage` com `client:load`, `CommunityTransparenciaPage` com `client:visible`), então o pipeline `@astrojs/react` cobre os dois builds. Verificado no HTML gerado: botão `aria-label="Mudar para tema escuro"` presente em `TENANT=tisocial` dist.
- **Limitação conhecida (aceita, paridade com o portal):** o SSR da ilha sempre hidrata no estado inicial `"light"` (🌙) e sincroniza no `useEffect` — usuário dark vê o ícone inverter após hidratação, milissegundos. Mesmo comportamento do SiteHeader; não introduzido por este fix.

---

## FIX 2 — Auditoria de contraste WCAG AA

Método: razões calculadas por luminância relativa WCAG 2.x (script próprio, blending alfa incluso), nos **3 tenants reais** (TI Social, Elas no Código, DevParaná) × **2 temas**. Tokens fixos do design system auditados contra `tokens.css`; cores de comunidade como dados (`comunidades/<slug>/community.config.ts` → CSS vars `--community-*`). **Zero hex hardcoded novo** — todos os fixes usam `color-mix` com `black` (keyword), tokens `--cq-*`, vars `--community-*` ou hexes já existentes no próprio arquivo.

Legenda: 🟥 falhava AA antes · 🟨 marginal/dependente de dados · ✅ passava.

### CommunityLayout

| Par (fundo → texto) | Antes | Depois | Fix |
|---|---|---|---|
| Header nav `text-text-primary` / `bg-surface` (claro 12.76:1, escuro 13.32:1) | ✅ | ✅ | — |
| Chip "← Codaqui" `text-action` / `bg-surface` (claro 4.55:1 exato, escuro 8.29:1); hover `bg-action` + `text-on-action` (4.55 / 5.86) | ✅ | ✅ | — |
| Footer `text-white` nome / `--community-footer-bg` (10.15 / 17.10 / 19.80) | ✅ | ✅ | — |
| Footer links `text-white/75` / `--community-footer-bg` (6.58 / 9.90 / 11.11) | ✅ | ✅ | — |

Footer e chip auditados nos 3 tenants — passam com folga, sem alteração.

### CommunityTextHero (texto branco sobre `--community-primary`)

| Par | Antes | Depois | Fix |
|---|---|---|---|
| 🟥 **Hero claro** — branco (título/chip/subtitle/CTAs) sobre `--community-primary`: TI Social **2.15:1**, DevParaná **3.32:1** (subtitle 3.14), Elas 6.30 | ✅ 5.15 / 7.26 / 11.29 | `background-color: color-mix(in srgb, var(--community-primary) 62%, black)` no claro. Escuro (`--community-primary-dark`, ≥5.4:1) inalterado. Técnica robusta para dados: escurece a cor do tenant em vez de depender dela; cor primária mais clara que a do TI Social exigiria ajuste no config |
| 🟥 **CTA primário no escuro** — branco sobre `--community-primary` (bg da própria comunidade): TI Social **2.15**, DevParaná **3.32** | ✅ 10.15 / 17.10 / 5.42 | Regras claro/escuro **unificadas**: bg `#fff` (já usado no claro) + texto `var(--community-primary-dark)`, hover `#f1f5f9` (9.27 / 15.61 / 4.94) — hexes já presentes no arquivo |
| 🟥 **Chip** — branco sobre `bg-white/15` + hero: TI Social claro **3.83**, DevParaná escuro **4.06** | ✅ 7.85–14.08 (claro) / 12.95–18.40 (escuro) | `bg-white/15` → `bg-black/25`: a pill agora **escurece** o fundo atrás do texto (técnica sugerida no brief) em vez de clarear |
| 🟨 **CTA secundário** — borda `border-white/60` vs hero (não-texto 3:1): TI Social **2.96** | ✅ 3.43 / 6.26 / 4.47 | `border-white/60` → `border-white/70` |
| 🟨 **CTA secundário hover** — texto branco sobre `hover:bg-white/8` + hero: TI Social **4.38** | ✅ 4.64 / 9.98 / 6.44 | Mantido `white/5` (não restaurado o `white/8` do .tsx-fonte: o paridade-port conflitava com AA). Repouso 5.15+ e hover escuro 8.71 / 15.28 / 4.90 |

### CommunityExploreSection / CommunityImpactSection

| Par | Antes | Depois | Fix |
|---|---|---|---|
| 🟥 **Ícone do card** (Explore) — `--community-primary` sobre `bg-surface` (ícone, ≥3:1): TI Social claro **2.15**, Elas escuro **2.02** | ✅ claro 10.15/17.10/5.42 · escuro 7.26/5.34/6.57 | `color: var(--community-primary)` → classe `.cq-accent`: `primary-dark` no claro, `primary-light` no escuro |
| 🟥 **Valor do stat** (Impact) — idem acima (texto grande `text-4xl/5xl`, ≥3:1): TI Social claro **2.15**, Elas escuro **2.02** | ✅ idem | Mesmo fix `.cq-accent` |
| Títulos `text-text-primary`/`text-3xl`, subtitles/descrições `text-text-secondary`, cards `bg-surface` sobre `bg-sunken` (claro ≥5.7, escuro ≥8.7) | ✅ | ✅ | — |

### CommunityChannelsSection

| Par | Antes | Depois | Fix |
|---|---|---|---|
| 🟥 **Botões outlined (claro)** — `text-action` `#378369` sobre body: **4.29:1**; hover `bg-sunken`: **4.00:1** | ✅ 6.23 / 5.82 | `text-action` → `text-link` (`#2C6753`, token existente). Escuro já passava (8.29/8.82) e continua passando com `text-link` |

### CommunityHero (hero sobre imagem — DevParaná, único tenant com `heroVisual`)

| Par | Antes | Depois | Fix |
|---|---|---|---|
| 🟥 **CTA primário** — branco sobre `--community-primary`: DevParaná **3.32:1** em AMBOS os temas | ✅ 7.26 (hover 8.20–14.39 com 45%) | `background-color: color-mix(in srgb, var(--community-primary) 62%, black)`; hover 45% — mesmo princípio do TextHero |
| Chip `.cq-hero-chip` (texto `primary-dark` sobre fundo quase-branco / `primary-light` sobre quase-preto), subtitle `text-primary` 78% (~6.4:1), título em gradiente (pior stop 3.32 ≥ 3:1, texto grande) | ✅ | ✅ | — (inversão claro-sobre-escuro/escuro-sobre-claro já robusta) |

---

## Gates (worktree `.worktrees/fix-community-ux`)

| Gate | Resultado |
|---|---|
| `npx vitest run` (inclui smoke test da ilha ThemeToggle, `AuthSmoke.test.tsx`) | ✅ 496 passed (56 arquivos) |
| `npm run check` (astro check, 414 arquivos) | ✅ 0 erros, 0 warnings (59 hints pré-existentes) |
| `npm run build` (codaqui) | ✅ 641 páginas |
| `node scripts/diff-urls.mjs` | ✅ paridade 100% nas seções públicas |
| `TENANT=tisocial npm run build` | ✅ 28 páginas + `_redirects` |
| Verificação no artefato | ✅ toggle no HTML do tenant; `.cq-accent`, `color-mix 62%`, `bg-black/25`, `border-white/70`, `text-link` no CSS/HTML gerados |

Setup do worktree: `npm ci` em `frontend/` + symlink `build → ../../build` na raiz do worktree (gate anti falso-verde do diff-urls). Warning conhecido do `npm ci` (`esbuild`/`fsevents` install-scripts bloqueados): sem impacto — builds e testes passaram.

## Arquivos alterados

- `frontend/src/components/astro/community/CommunityLayout.astro` — ilha ThemeToggle no nav; comentário de cabeçalho (zero-JS → único JS de runtime)
- `frontend/src/components/astro/community/CommunityTextHero.astro` — hero darken 62%, CTA primário unificado branco/`primary-dark`, chip `bg-black/25`, borda `white/70`, hover `white/5`
- `frontend/src/components/astro/community/CommunityExploreSection.astro` — `.cq-accent` dark/light
- `frontend/src/components/astro/community/CommunityImpactSection.astro` — `.cq-accent` dark/light
- `frontend/src/components/astro/community/CommunityChannelsSection.astro` — `text-link`
- `frontend/src/components/astro/community/CommunityHero.astro` — CTA primário darken 62%/45%

## Notas / follow-ups

- **Limitação declarada do fix do hero:** `color-mix 62%` garante AA para os primários dos 3 tenants cadastrados (pior caso TI Social 5.15:1). Uma comunidade futura com primária mais clara que `#8DC044` exigiria ajuste no percentual ou no config — registrado em comentário no `<style>`.
- **Paridade com os .tsx-fonte:** dois desvios intencionais além dos mapeados pela 0.5 — hover do CTA secundário ficou em `white/5` (o `white/8` do fonte falharia AA sobre o hero escurecido) e o CTA primário do dark não inverte mais para a cor da marca (falhava AA). Os componentes .tsx-fonte (Docusaurus) **não** foram alterados — vivem até a Fase 0.6; o relatório registra os pares para a eventual miguação.
- Report: `.superpowers/sdd/2026-10-27-fase-0-5-multi-tenant-pages/fix-community-ux-report.md`.
