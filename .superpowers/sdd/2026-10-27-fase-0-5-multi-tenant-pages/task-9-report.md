# Task 9 — campostechpg no build codaqui + gate de paridade atualizado

**Status:** ✅ concluída — paridade 100% (incluindo `/comunidades`) na primeira rodada do gate.

## O que foi entregue

### 1. Wrappers codaqui da CamposTech (`frontend/src/pages/comunidades/campostechpg/`)

A CamposTech **não é tenant** (sem build de domínio próprio) — o config é importado
direto de `comunidades/campostechpg/community.config` (`loadTenantConfig` só conhece
os três tenants) e `homeHref = communityBasePath(config)` (`/comunidades/campostechpg`).

| Arquivo | Port 1:1 de |
|---|---|
| `index.astro` | `comunidades/campostechpg/src/pages/index.tsx` — hero (chip + CTAs + logo), "Como podemos ajudar?" (3 pilares: Networking/Conhecimento/Divulgação), "Próximos eventos" (`eventSources: ["sympla:campostech"]`, build time via `loadEventsIndex`), `CommunityImpactSection`, `CommunityExploreSection` (cards: Quem Somos → Mentores → Apoiar → Transparência), `CommunityChannelsSection` |
| `apoiar.astro` | `apoiar.tsx` + `comunidades/shared/components/CommunityApoiarPage.tsx` — hero `💙 Apoie a CamposTech`, DonationFlowIsland travado (`lockedTargetId`/`hideWallets`/accents). Sem infoCards (o original não passa) |
| `transparencia.astro` | `transparencia.tsx` + `CommunityTransparenciaPage.tsx` — hero accent, `CommunityTransparencyIsland` (`slug={config.slug}`), CTA final |
| `mentores.astro` | `mentores.tsx` — hero + "Mentores voluntários" (12 cards de `comunidades/campostechpg/src/data/team.ts`, avatares locais `/img/comunidades/campostechpg/mentores/*`, ícones LinkedIn/Instagram) |
| `docs/[...slug].astro` | `comunidades/campostechpg/docs/index.md` (único doc, "Quem Somos") — import direto do markdown, mesmo padrão do wrapper docs da elasnocodigo |

Suportes novos, seguindo as convenções T7/T8:
- `frontend/src/lib/community-campostechpg.ts` (+ `.test.ts`, 7 testes): `campostechFeatureCards`, `upcomingCommunityEvents`, `formatFullEventDate` — derivações 1:1 do fonte.
- `frontend/src/components/astro/community/campostechpg/HomeEventsSection.astro`: port zero-JS de `UpcomingEventsSection` (modelado no do devparana; "Ver na Sympla").
- `frontend/src/lib/community-sections.ts` + `CommunityExploreSection.astro`: ícone `school` adicionado ao union/ICON_PATHS (card "Mentores") — extensão aditiva, não afeta tenants existentes.

### 2. Gate `diff-urls` cobre `/comunidades`

- `frontend/scripts/diff-urls.mjs`: exclusão `/^\/comunidades(\/|$)/` removida, `"comunidades"` adicionada a `SECTIONS` (sem só a remoção a seção não entraria na comparação), comentário de histórico atualizado.

### 3. Item deferido da T5 (og:image do tenant tisocial)

- `frontend/scripts/copy-snapshots.mjs`: `og-tisocial.jpg` adicionada a `imgFiles` (padrão T7 do `og-elasnocodigo.jpg`); JPG copiado e **versionado** em `frontend/public/img/`.
- De quebra, os assets que os wrappers campostech precisam para não 404: `og-campostech.jpg` (socialImage do config, OG das páginas), `campostech.svg` (logo — já estava versionada) e os 12 avatares de mentores (`imgDirs` — cópia recursiva de `static/img/comunidades/campostechpg/mentores`).

## URLs faltantes encontradas no gate e como foram resolvidas

**Nenhuma.** `npm run build && node scripts/diff-urls.mjs` bateu 100% na primeira
execução, em todas as 13 seções:

```
→ /comunidades: 50 URLs na referência, todas presentes
✔ diff-urls: paridade 100% nas seções públicas cobertas
```

(50/50 na referência: 5 campostechpg + 8 devparana + 5 elasnocodigo + 32 tisocial
incluindo blog/tags/paginação e os feeds rss/atom/feed.json das T6–T8.)

## Desvio vs. brief: `equipe.astro` não criado

O brief listava `equipe.astro` entre os wrappers, mas **não existe
`equipe.tsx` no fonte campostechpg** (o `navMenu` do config confirma: Início →
Sobre (Quem Somos/Mentores) → Apoiar → Transparência) e a referência `build/`
não tem `equipe.html`. Criar a página seria inventar conteúdo fora do spec
("fonte é spec") — extras no dist são tolerados, mas conteúdo inventado não.
**Ficou fora deliberadamente.**

## Gates

| Gate | Resultado |
|---|---|
| `npx vitest run` | 55 arquivos / **482 testes** passando (7 novos do `community-campostechpg`) |
| `npm run check` (astro check) | 0 erros, 0 warnings |
| `npm run build && node scripts/diff-urls.mjs` | paridade **100%** (641 páginas) |
| `TENANT=tisocial npm run build` | OK, 28 páginas, `_redirects` escrito — sem regressão |

## Notas / preocupações

- Os 10 eventos `sympla:campostech` do snapshot estão todos `completed` — a
  seção "Próximos eventos" renderiza o estado vazio 1:1 com o original
  (client-side faria o mesmo).
- `Astro.site` fallback nos wrappers: `?? "https://codaqui.dev"` (campostech não
  é tenant — `tenantSite()` lançaria para slug desconhecido).
- `/design-system` continua como URL extra informativa no build Astro (já
  existia antes desta task; o topo da referência não a tem).
