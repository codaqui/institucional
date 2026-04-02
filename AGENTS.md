# AGENTS.md — Codaqui Institutional Site

> Instructions for AI agents, contributors, and maintainers.

## Tech Stack

### Frontend (Docusaurus — GitHub Pages)

| Layer | Technology |
|-------|-----------|
| **Framework** | Docusaurus 3.9.2 (`@docusaurus/preset-classic`) |
| **UI Library** | MUI v7 (`@mui/material` ^7.3, `@mui/icons-material`, `@mui/lab`) |
| **Styling** | `@emotion/react` + `@emotion/styled` (MUI's SSR-compatible engine) |
| **Language** | TypeScript 5.6, React 19, MDX |
| **Diagrams** | `@docusaurus/theme-mermaid` |
| **Live Code** | `@docusaurus/theme-live-codeblock` |
| **Comments** | Giscus (`@giscus/react`, repo: `codaqui/institucional`, category: "Blog") |
| **Analytics** | Google gtag `G-CL043JTTND` |
| **Redirects** | `@docusaurus/plugin-client-redirects` |
| **Node** | ≥24 (enforced in `package.json` engines) |
| **Hosting** | GitHub Pages via GitHub Actions |

### Backend (NestJS — local + produção ARM64)

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS (TypeScript) |
| **ORM** | TypeORM + PostgreSQL 15 |
| **Autenticação** | Keycloak 22 (via `KC_DB` postgres) |
| **Storage** | MinIO (S3-compatible) |
| **Pagamentos** | Stripe (Checkout Sessions + Webhooks) |
| **Reverse Proxy** | Traefik v2.10 |
| **Container** | Podman Compose |

**Site**: https://codaqui.dev · **Repo**: https://github.com/codaqui/institucional · **CNPJ**: 44.593.429/0001-05

---

## Commands

> Setup completo, variáveis de ambiente e guia de deploy em [DEVELOPMENT.md](./DEVELOPMENT.md).

Comandos que agentes devem rodar antes de submeter mudanças:

```bash
# Frontend — verificar antes de qualquer PR
npm run typecheck   # TypeScript (exclui /backend)
npm run build       # Build completo igual ao CI

# Backend — verificar antes de PR que altere o backend
cd backend && npm run build
```


---

## Directory Structure

Este repositório é um **monorepo**: o frontend Docusaurus fica na raiz e o backend NestJS em `backend/`. O CI do GitHub Pages **nunca** publica o `backend/`.

```
institucional/
├── backend/                     # 🖥️ API REST NestJS (NÃO vai para GitHub Pages)
│   ├── src/
│   │   ├── ledger/              # Contabilidade dupla partida
│   │   │   ├── entities/        # Account, Transaction (TypeORM)
│   │   │   ├── ledger.controller.ts  # GET /ledger/community-balances, etc.
│   │   │   └── ledger.service.ts     # getOrCreateCommunityAccount, getCommunityBalances
│   │   ├── stripe/              # Integração Stripe
│   │   │   ├── stripe.controller.ts  # POST /stripe/checkout-session, POST /stripe/webhook
│   │   │   └── stripe.service.ts     # createCheckoutSession, handleWebhookEvent
│   │   ├── auth/                # Autenticação (Keycloak)
│   │   ├── expenses/            # Gestão de despesas
│   │   └── storage/             # Armazenamento MinIO
│   └── Dockerfile               # Multi-stage: builder → runner (alpine + curl)
├── blog/                        # Blog posts (Markdown/MDX)
│   ├── authors.yml              # Blog author definitions
│   └── YYYY-MM-DD-slug.md      # Post files (slug in frontmatter)
├── trilhas/                     # Learning trails (Docusaurus docs plugin)
│   ├── python/                  # Python 101 (index.md + page-1..page-16.md)
│   └── github/                  # GitHub 101 (index.md + page-1..page-8.md)
├── src/
│   ├── components/              # Shared React components
│   │   ├── Badge/
│   │   ├── GiscusComponent/     # Giscus wrapper (reads config from themeConfig)
│   │   ├── LessonCard/
│   │   ├── StripeDonateSection/ # ⭐ Formulário de doação por comunidade via Stripe
│   │   ├── VideoEmbed/
│   │   └── index.ts             # Barrel exports
│   ├── data/                    # ⭐ Centralized data layer (see below)
│   │   ├── social.ts            # DISCORD_URL, WHATSAPP_URL, EMAIL, GITHUB_ORG, socialChannels[]
│   │   ├── team.ts              # diretoria[], membros[], alumni[], mentores[]
│   │   ├── communities.ts       # communities[] (5 partners)
│   │   ├── projects.ts          # projects[] (9 open-source projects)
│   │   └── timeline.ts          # timelineEvents[] (2020–2026)
│   ├── pages/                   # Custom pages (TSX or MD)
│   │   ├── index.tsx            # Homepage (MUI Grid + Cards)
│   │   ├── bio.tsx              # Links page
│   │   ├── contato.tsx          # Contact page
│   │   ├── projetos.tsx         # Projects page
│   │   ├── transparencia.tsx    # ⭐ Portal de transparência financeira (consome /ledger/community-balances)
│   │   ├── regex.md             # Regex learning page
│   │   ├── participe/           # Participation pages (TSX)
│   │   │   ├── apoiar.tsx       # ⭐ Doação (OpenCollective + Stripe por comunidade)
│   │   │   ├── estudar.tsx
│   │   │   └── mentoria.tsx
│   │   ├── sobre/               # About section
│   │   │   ├── equipe.tsx       # Team (MUI Avatar + Card + Chip)
│   │   │   ├── ong.tsx          # Association + communities
│   │   │   ├── insights.tsx     # Insights: stats + social presence + communities + timeline
│   │   │   ├── timeline.tsx     # ⚠️ Redirect → /sobre/insights
│   │   │   ├── conduta.md       # Code of conduct
│   │   │   └── pais-responsaveis.md
│   │   ├── blog/archive/        # Year archive redirects (2022–2025)
│   │   ├── quero/               # ⚠️ Legacy URL redirects — DO NOT DELETE
│   │   ├── team.tsx             # ⚠️ Redirect → /sobre/equipe
│   │   ├── contact.tsx          # ⚠️ Redirect → /contato
│   │   ├── conduta.tsx          # ⚠️ Redirect → /sobre/conduta
│   │   ├── ong.tsx              # ⚠️ Redirect → /sobre/ong
│   │   ├── timeline.tsx         # ⚠️ Redirect → /sobre/timeline → /sobre/insights
│   │   └── pais_responsaveis.tsx # ⚠️ Redirect → /sobre/pais-responsaveis
│   ├── theme/                   # Docusaurus theme overrides
│   │   ├── Root.tsx             # MUI ThemeProvider (SSR-safe, see below)
│   │   ├── muiTheme.ts          # createCodaquiTheme(mode) factory
│   │   └── BlogPostItem/        # Swizzled: injects Giscus comments
│   └── css/
│       └── custom.css           # Docusaurus CSS variables + global overrides
├── static/
│   ├── img/                     # logo.png, logo_blk.png, community logos
│   ├── assets/docs/             # PDFs (estatuto.pdf)
│   ├── events/                  # ⭐ Event snapshots (generated by workflow)
│   │   ├── index.json           # Aggregated index (all sources, all events)
│   │   ├── discord/codaqui/     # Per-event JSON + source index
│   │   └── meetup/devparana/    # Per-event JSON + source index
│   └── social-stats/            # ⭐ Social stats snapshot (generated by workflow)
│       └── index.json           # Counts: Discord members, Meetup members, GitHub followers
├── compose.yaml                 # 🐳 DEV: todos os serviços (Docusaurus + Backend + infra)
├── compose.prod.yaml            # 🏭 PROD ARM64: apenas backend + infra (sem Docusaurus)
├── Dockerfile                   # DEV-only: container Docusaurus (npm start)
├── .env.example                 # Template de variáveis de ambiente
├── docusaurus.config.ts         # Main Docusaurus configuration
├── sidebars.ts                  # Sidebar config for trilhas
├── tsconfig.json                # Exclui /backend para evitar conflito de decorators
├── CNAME                        # codaqui.dev
└── .github/workflows/
    └── gh-deploy.yml            # CI: npm ci → build → deploy
```

---

## Critical Architecture Decisions

### 1. MUI v7 Grid API (most common pitfall)

MUI v7 removed the `item` prop and replaced `xs`/`md`/etc. with the `size` prop:

```tsx
// ✅ CORRECT — MUI v7 Grid
import Grid from '@mui/material/Grid';

<Grid container spacing={3}>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    <Card>...</Card>
  </Grid>
</Grid>

// ❌ WRONG — MUI v5/v6 API (will NOT compile)
<Grid item xs={12} md={6}>
```

The codebase imports `Grid` (not `Grid2`) — MUI v7 unified the component name.

### 2. Dark Mode Sync (SSR-safe pattern)

`src/theme/Root.tsx` wraps the entire app in a MUI `ThemeProvider`. It reads Docusaurus's `data-theme` attribute on `<html>` via a `MutationObserver`:

```tsx
// Root.tsx — simplified
function MuiThemeWrapper({ children }) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const getMode = () =>
      document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setMode(getMode());

    const observer = new MutationObserver(() => setMode(getMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return <ThemeProvider theme={createCodaquiTheme(mode)}>{children}</ThemeProvider>;
}
```

> **⚠️ NEVER use `useColorMode()` in `Root.tsx`** — it causes `ReactContextError` during SSR because `ColorModeProvider` is a child of `Root` in the Docusaurus component tree.

`useColorMode()` is safe in any other component (pages, GiscusComponent, etc.) — just not in Root.

### 3. Data Layer Pattern

All shared data lives in `src/data/*.ts`. Pages import from these files — **never inline arrays in page components**.

| File | Exports | Used by |
|------|---------|---------|
| `social.ts` | `DISCORD_URL`, `WHATSAPP_URL`, `EMAIL`, `GITHUB_ORG`, `socialChannels[]`, `codaquiSocialProfiles[]` | index.tsx, contato.tsx, bio.tsx, sobre/insights.tsx |
| `team.ts` | `diretoria[]`, `membros[]`, `alumni[]`, `mentores[]` | sobre/equipe.tsx |
| `communities.ts` | `communities[]` (with `socialProfiles[]` per community) | index.tsx, sobre/ong.tsx, sobre/insights.tsx, **transparencia.tsx**, **StripeDonateSection** |
| `projects.ts` | `projects[]` | projetos.tsx |
| `timeline.ts` | `timelineEvents[]` | sobre/insights.tsx |
| `social-stats.ts` | `SocialProfile`, `SocialStatEntry`, `SocialStatsSnapshot`, `SOCIAL_STATS_URL` | sobre/insights.tsx, scripts/sync-social-stats.mjs |

**To add a team member** — edit `src/data/team.ts` only:
```typescript
// Add to the correct array: diretoria, membros, alumni, or mentores
{
  name: "Nome Completo",
  role: "Cargo",
  avatar: "https://avatars.githubusercontent.com/username?v=4",
  linkedin: "https://www.linkedin.com/in/username/",  // optional
  github: "https://github.com/username",              // optional
  specialty: "DevOps e Iniciantes",                    // mentores only
}
```

**To add a community** — edit `src/data/communities.ts` only:
```typescript
{
  id: "slug",
  name: "Community Name",
  emoji: "🤝",
  logo: "/img/community-logo.svg",      // or external URL
  description: "Short description.",
  location: "City, State",              // optional
  founded: 2020,                        // optional
  links: [
    { type: "website", label: "example.com", url: "https://example.com/" },
  ],
  socialProfiles: [                      // optional — shown in Insights page
    {
      platform: "meetup",               // discord | meetup | youtube | instagram | github
      handle: "my-group",
      url: "https://www.meetup.com/my-group/",
      countLabel: "membros",
      baselineCount: 500,               // manual fallback
    },
  ],
  tags: ["tag1", "tag2"],
}
```

> After adding a community's `socialProfiles`, also add a corresponding entry in `scripts/sync-social-stats.mjs` so the count is auto-fetched.

**To add a project** — edit `src/data/projects.ts` only.

**To add a timeline event** — edit `src/data/timeline.ts` only.

### 4. Blog URL Convention (SEO critical)

Posts live at `blog/YYYY-MM-DD-slug.md`. The frontmatter `slug` determines the final URL path — this preserves Google-indexed URLs from the legacy site:

```yaml
---
slug: 2024/07/22/meu-post
title: Título do Post
authors: [username]
tags: [tag1, tag2]
date: 2024-07-22
---

Resumo do post (appears in listing).

<!-- truncate -->

Full content below the fold...
```

- `tagsBasePath: 'category'` in `docusaurus.config.ts` preserves `/blog/category/X/` URLs — **do not change**.
- Blog comments: enabled by default via swizzled `BlogPostItem`. Disable per-post with `enableComments: false` in frontmatter.

### 5. Learning Trails (Trilhas)

Configured as a docs plugin: `path: "trilhas"`, `routeBasePath: "trilhas"`.

Lesson files: `trilhas/python/page-N.md` or `trilhas/github/page-N.md`:

```markdown
---
sidebar_position: N
title: Título da Aula
---

# Título da Aula

## Objetivos
## Conteúdo Principal
## Exercícios Práticos
## Referências
```

Sidebars are manually defined in `sidebars.ts` (not auto-generated).

### 6. Giscus Comments

Configuration lives in `docusaurus.config.ts` → `themeConfig.giscus`. The `GiscusComponent` reads it at runtime:

```typescript
const giscusConfig = siteConfig.themeConfig.giscus as Record<string, string>;
```

- **Mapping**: `og:title` — works for both blog posts and learning trail pages.
- **Theme**: automatically syncs with Docusaurus color mode.
- **Usage**: import `GiscusComponent` from `@site/src/components/GiscusComponent` wherever you need comments.

### 7. Events System

Events are powered by a **static snapshot pipeline**: a GitHub Actions workflow syncs external sources into `static/events/` at each run, and the frontend reads only the pre-generated JSON files. No API keys are exposed to the browser.

#### File layout

```
static/events/
├── index.json                         # Aggregated root index (UI reads only this)
├── discord/
│   └── codaqui/
│       ├── index.json                 # Source-scoped index + metadata
│       └── <event_id>.json           # Per-event detail file
└── meetup/
    └── devparana/
        ├── index.json
        └── <event_id>.json
```

#### Root index (`/events/index.json`)

Shape matches `EventIndexFile` in `src/data/events.ts`:
```json
{
  "generatedAt": "ISO timestamp",
  "sources": [ /* EventSourceSummary[] */ ],
  "events":  [ /* EventSummary[] — sorted ASC by startAt */ ]
}
```

#### Per-event detail (`/events/<source>/<sourceId>/<id>.json`)

Shape matches `EventDetailFile`:
```json
{
  "generatedAt": "ISO timestamp",
  "source": { /* EventSourceConfig */ },
  "event":  { /* EventItem */ }
}
```

#### TypeScript contract (`src/data/events.ts`)

| Type | Purpose |
|------|---------|
| `EventItem` | Core event fields (id, title, summary, startAt…) |
| `EventSummary` | `EventItem` + `source`, `sourceId`, `sourceKey`, `itemPath` |
| `EventSourceConfig` | Source metadata (label, emoji, ctaHref…) |
| `EventSourceSummary` | `EventSourceConfig` + `sourceKey`, `indexPath`, `itemCount` |
| `EventIndexFile` | Root index shape (`sources[]` + `events[]`) |
| `EventDetailFile` | Per-event detail shape (`source` + `event`) |

#### Adding a new source

Edit `events.config.json` only — add an object to the `sources` array:

```json
{
  "source": "meetup",
  "sourceId": "my-group",
  "urlname": "my-group-slug",
  "locale": "pt-BR",
  "label": "My Group no Meetup",
  "emoji": "📍",
  "description": "Short description.",
  "ctaLabel": "Abrir grupo",
  "ctaHref": "https://www.meetup.com/pt-BR/my-group-slug/",
  "defaultHost": "My Group",
  "defaultLocation": "Meetup",
  "defaultPlatform": "Meetup",
  "fallbackEvents": []
}
```

For Discord sources add `"guildId"` and `"widgetUrl"` instead of Meetup fields.

#### Sync workflow (`.github/workflows/sync-event-snapshots.yml`)

- Runs **hourly** via `schedule` + supports `workflow_dispatch`
- Requires `DISCORD_BOT_TOKEN` secret for Discord sources (falls back to cached snapshots if missing)
- Meetup sources use CSRF token extracted from the public Meetup page — **no API key needed**
- After sync, commits updated `static/events/` with message `chore: sync event snapshots`

#### Status values (`EventStatus`)

| Value | Meaning |
|-------|---------|
| `scheduled` | Future event, not yet started |
| `active` | Live right now |
| `completed` | Past event |
| `canceled` | Canceled |

#### Sort contract

- `static/events/index.json` → events sorted **ASC by `startAt`** (oldest first)
- `/eventos` page splits into upcoming (≠ completed, ASC) and past (= completed, DESC) client-side

---

### 8. Legacy URL Redirects

| Redirect file | Redirects to |
|---------------|-------------|
| `src/pages/quero/estudar.tsx` | `/participe/estudar` |
| `src/pages/quero/apoiar.tsx` | `/participe/apoiar` |
| `src/pages/quero/mentoria.tsx` | `/participe/mentoria` |
| `src/pages/team.tsx` | `/sobre/equipe` |
| `src/pages/contact.tsx` | `/contato` |
| `src/pages/conduta.tsx` | `/sobre/conduta` |
| `src/pages/ong.tsx` | `/sobre/ong` |
| `src/pages/timeline.tsx` | `/sobre/timeline` |
| `src/pages/pais_responsaveis.tsx` | `/sobre/pais-responsaveis` |

Pattern:
```tsx
import { Redirect } from "@docusaurus/router";
export default function RedirectX() {
  return <Redirect to="/new/path" />;
}
```

---

## MUI Theme

Defined in `src/theme/muiTheme.ts`:

| Token | Value |
|-------|-------|
| `primary.main` | `#22c55e` (Codaqui green) |
| `primary.dark` | `#16a34a` |
| `primary.light` | `#4ade80` |
| `secondary.main` | `#0ea5e9` (sky blue) |
| `background.default` (dark) | `#1b1b1d` |
| `background.paper` (dark) | `#242526` |
| `shape.borderRadius` | `8` |
| `typography.fontFamily` | `var(--ifm-font-family-base, ...)` — inherits from Docusaurus |

**Always use theme tokens** (`color="text.primary"`, `bgcolor="action.hover"`). Never hardcode hex values in components.

---

## Component Creation Pattern

New components go in `src/components/ComponentName/index.tsx`:

```tsx
import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

interface MyComponentProps {
  title: string;
  description: string;
}

export default function MyComponent({ title, description }: MyComponentProps) {
  return (
    <Card sx={{ height: "100%", "&:hover": { transform: "translateY(-4px)", boxShadow: 6 } }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </CardContent>
    </Card>
  );
}
```

Then export from `src/components/index.ts`:
```typescript
export { default as MyComponent } from "./MyComponent";
```

### Page Creation Pattern

Pages go in `src/pages/`:

```tsx
import React from "react";
import Layout from "@theme/Layout";
import { Container, Typography, Grid, Card, CardContent } from "@mui/material";
import { someData } from "../data/someFile";

export default function MyPage(): React.JSX.Element {
  return (
    <Layout title="Page Title" description="SEO description">
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h3" fontWeight={800} gutterBottom>
          Page Title
        </Typography>
        <Grid container spacing={3}>
          {someData.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography>{item.name}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
```

---

## Common Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| `<Grid item xs={12}>` | `<Grid size={{ xs: 12 }}>` (MUI v7) |
| `useColorMode()` in `Root.tsx` | Read `data-theme` via MutationObserver |
| Hardcode Discord/WhatsApp URLs | Import from `src/data/social.ts` |
| Inline team/community arrays in pages | Import from `src/data/*.ts` |
| `import * from '@mui/material'` | Named imports: `import { Card, Grid } from '@mui/material'` |
| `makeStyles()` or `styled-components` | MUI `sx` prop |
| Hardcode hex colors in components | Use theme tokens (`color="text.secondary"`) |
| Delete files in `src/pages/quero/` | They are SEO redirect stubs |
| `slug: meu-post` (blog) | `slug: 2024/07/22/meu-post` (preserves Google URLs) |
| Edit `equipe.tsx` to add a member | Edit `src/data/team.ts` |
| Use "alunos", "escola", "curso" | Use "participantes", "Associação", "programa" |

---

## Git Workflow & Deployment

### Branches

| Branch | Deploys to | URL |
|--------|-----------|-----|
| `main` | `gh-pages` | https://codaqui.dev (production) |
| `develop` | `gh-pages/previews/develop/` | https://codaqui.dev/previews/develop/ |

### CI Pipeline (`.github/workflows/gh-deploy.yml`)

On push to `develop` or `main`:
1. `actions/checkout@v6`
2. `actions/setup-node@v6` with Node 24 + npm cache
3. `npm ci`
4. `npm run build`
5. Deploy production from `main` to `gh-pages`, preserving `previews/`
6. Sync the `develop` preview to `gh-pages/previews/develop/`

### Commit Convention

```
feat: adiciona nova trilha de JavaScript
fix: corrige link quebrado na página inicial
docs: atualiza README com novas instruções
style: ajusta formatação do post sobre Python
refactor: reorganiza estrutura de pastas
chore: atualiza dependências do projeto
```

### Contribution Flow

1. Create branch from `develop`: `feat/nome` or `fix/nome`
2. Make changes, ensure `npm run build` passes
3. Open PR targeting `develop`
4. Review → merge → auto-update preview at `https://codaqui.dev/previews/develop/`
5. After validation, merge `develop` → `main` → auto-deploy to production

---

## PR Checklist

Before submitting:

- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes (runs only on frontend — backend is excluded)
- [ ] Blog posts include `slug: YYYY/MM/DD/name` in frontmatter
- [ ] Data changes go in `src/data/*.ts`, not inline in pages
- [ ] Social URLs imported from `src/data/social.ts`
- [ ] MUI Grid uses `size={{ xs, sm, md }}` (not `item xs={}`)
- [ ] Images optimized (max 500KB; SVG for logos, PNG for screenshots)
- [ ] External links have `target="_blank" rel="noopener noreferrer"`
- [ ] MUI Avatars have `alt={name}`
- [ ] IconButtons have `aria-label`
- [ ] Heading hierarchy is correct (h1 → h2 → h3, no skipping)
- [ ] Inclusive language: "participantes", "programa", "encontros", "Associação"
- [ ] No hardcoded hex colors — use MUI theme tokens
- [ ] No secrets or credentials committed (use `.env.example` for templates)
- [ ] Legacy redirect files untouched
- [ ] Backend changes: `cd backend && npm run build` passes before committing

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Blog post | `YYYY-MM-DD-slug.md` | `2024-07-22-welcome.md` |
| Blog image | `blog/img/YYYY-MM-DD-slug/` | `blog/img/2024-07-22-welcome/hero.png` |
| Component | `src/components/Name/index.tsx` | `src/components/Badge/index.tsx` |
| Data file | `src/data/name.ts` | `src/data/team.ts` |
| Page | `src/pages/name.tsx` or `.md` | `src/pages/projetos.tsx` |
| Static asset | `static/img/description.ext` | `static/img/elasnocodigo.svg` |

---

## About Codaqui

Codaqui is a **Brazilian non-profit association** (not a school or company) that democratizes technology education for youth. It serves as an umbrella for partner tech communities.

- **Branding**: "Associação Codaqui" — never "escola" or "empresa"
- **Language**: "participantes" (not "alunos"), "programa" (not "curso"), "encontros" (not "aulas")
- **Values**: Transparency, inclusion, collaboration, collective growth
- **License**: Creative Commons Attribution-ShareAlike
- **Contact**: contato@codaqui.dev
- **Communities**: DevParaná, Elas no Código, CamposTech, TI Social, Cloud Native Maringá

### Social

| Platform | Handle |
|----------|--------|
| GitHub | [@codaqui](https://github.com/codaqui) |
| Discord | [Server](https://discord.com/invite/xuTtxqCPpz) |
| WhatsApp | [Group](https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up) |
| Instagram | [@codaqui.dev](https://instagram.com/codaqui.dev) |
| LinkedIn | [codaqui](https://www.linkedin.com/company/codaqui) |
| Twitter/X | [@codaquidev](https://twitter.com/codaquidev) |
| YouTube | [@codaqui](https://youtube.com/@codaqui) |

---

## Regular Maintenance

| What | When | Where |
|------|------|-------|
| Team changes | As needed | `src/data/team.ts` |
| New community partners | As needed | `src/data/communities.ts` + `scripts/sync-social-stats.mjs` |
| Timeline events | Annually | `src/data/timeline.ts` |
| Social links (WhatsApp expires) | When links change | `src/data/social.ts` |
| Manual follower counts (YouTube/Instagram) | When updated | `src/data/social.ts` + `src/data/communities.ts` (`baselineCount`) |
| Event sources/fallbacks | As needed | `events.config.json` |
| Event snapshots sync | Automatic (hourly workflow) | `static/events/` via `sync-event-snapshots.yml` |
| Social stats sync (Discord/Meetup/GitHub) | Automatic (daily workflow) | `static/social-stats/` via `sync-social-stats.yml` |
| Dependencies | Quarterly | `package.json` → `npm update` |

---

## Insights & Social Stats

The `/sobre/insights` page aggregates four modules: **live stats bar**, **presença digital**, **comunidades parceiras**, and the **linha do tempo** (timeline). It replaces the old `/sobre/timeline` URL (now a redirect).

### Data sources

| What | Source | Auto-fetched? |
|------|--------|---------------|
| Discord member count (Codaqui) | Discord Bot API (`/guilds/{id}?with_counts=true`) | ✅ daily |
| Meetup member count (DevParaná) | Meetup gql2 GraphQL | ✅ daily |
| GitHub followers (Codaqui org) | GitHub public REST API | ✅ daily |
| YouTube subscribers | — (no public API) | ❌ manual `baselineCount` |
| Instagram followers | — (blocked) | ❌ manual `baselineCount` |
| Total events | Reads `static/events/index.json` | ✅ (from events sync) |

### Snapshot schema (`static/social-stats/index.json`)

```json
{
  "generatedAt": "ISO 8601",
  "totalEvents": 373,
  "profiles": [
    {
      "entityId": "codaqui",
      "platform": "discord",
      "handle": "@codaqui",
      "url": "https://discord.com/invite/...",
      "countLabel": "membros",
      "baselineCount": 692,
      "count": 722,
      "fetchedAt": "ISO 8601",
      "isFallback": false
    }
  ]
}
```

### Manual baseline updates

To update a manual count (YouTube, Instagram):
1. Edit `baselineCount` in `src/data/social.ts` (for Codaqui profiles) or `src/data/communities.ts` (for partner communities).
2. Run `node scripts/sync-social-stats.mjs` locally to regenerate `static/social-stats/index.json`.
3. Commit both the data file and the snapshot.

### Sync workflow

**File:** `.github/workflows/sync-social-stats.yml`  
**Schedule:** daily at 06:00 UTC + manual dispatch  
**Secret required:** `DISCORD_BOT_TOKEN`

**To run locally:**
```bash
DISCORD_BOT_TOKEN=<token> node scripts/sync-social-stats.mjs
```

### Adding a new social profile

1. Add a `SocialProfile` entry to `codaquiSocialProfiles` in `src/data/social.ts` (for Codaqui) or to `socialProfiles[]` in the community's entry in `src/data/communities.ts`.
2. If the platform has a public API, add a fetch function in `scripts/sync-social-stats.mjs` and call it in `main()`.
3. Regenerate the snapshot locally and commit.

---

## Events System

The `/eventos` page is powered by **static JSON snapshots** generated by a workflow — no hardcoded arrays in page components.

### Architecture

```
static/events/
├── index.json                          ← UI reads only this (merged, light)
├── discord/
│   └── codaqui/
│       ├── index.json                  ← per-source shard
│       └── <event_id>.json             ← one file per event (detail + cache)
└── meetup/
    └── devparana/
        ├── index.json
        └── <event_id>.json
```

- The UI fetches **only** `/events/index.json` (aggregated, all sources merged, sorted by `startAt`).
- Per-source indexes (`/events/<source>/<sourceId>/index.json`) are available for source-specific queries.
- Per-event files (`/events/<source>/<sourceId>/<id>.json`) hold full detail and serve as immutable cache.

### Event contract (`EventItem`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | ✅ | Unique within source |
| `title` | `string` | ✅ | |
| `summary` | `string` | ✅ | Max ~220 chars, no Markdown |
| `startAt` | ISO 8601 | ✅ | With timezone offset |
| `endAt` | ISO 8601 | — | |
| `timezone` | IANA | ✅ | e.g. `America/Sao_Paulo` |
| `platform` | `string` | ✅ | e.g. `Discord`, `Meetup` |
| `host` | `string` | ✅ | Organizer name |
| `location` | `string` | ✅ | Venue or `Online via Discord` |
| `href` | `string` | ✅ | Link to event page |
| `tags` | `string[]` | ✅ | Lowercase slugs |
| `ctaLabel` | `string` | ✅ | Button label |
| `status` | `scheduled \| active \| completed \| canceled` | — | |
| `entityType` | `stage_instance \| voice \| external` | — | Discord-specific |
| `featured` | `boolean` | — | Highlights in hero |
| `userCount` | `number` | — | Attendees/interested |
| `creatorName` | `string` | — | |
| `imageUrl` | `string` | — | High-res cover |
| `recurrenceLabel` | `string` | — | Human-readable (Discord only) |
| `recurrenceRule` | `EventRecurrenceRule` | — | Structured (Discord only) |

> TypeScript types live in `src/data/events.ts`. The JSON files follow the same shape.

### Adding a new event source

1. Add entry to `events.config.json`:
   ```json
   {
     "source": "meetup",
     "sourceId": "my-group",
     "urlname": "my-meetup-group",
     "locale": "pt-BR",
     "label": "Nome do Grupo",
     "emoji": "📍",
     "description": "Descrição curta da comunidade.",
     "ctaLabel": "Abrir no Meetup",
     "ctaHref": "https://www.meetup.com/pt-BR/my-meetup-group/",
     "defaultHost": "Nome do Grupo",
     "defaultLocation": "Meetup",
     "defaultPlatform": "Meetup",
     "fallbackEvents": []
   }
   ```
2. Implement `resolve<Source>Events(config, existingEvents)` in `scripts/sync-events.mjs`.
3. Add a branch in `main()` for the new `source` value.
4. Run `node scripts/sync-events.mjs` to generate initial snapshots.
5. Add a community card in `src/pages/eventos.tsx`.

### Sync workflow

**File:** `.github/workflows/sync-event-snapshots.yml`
**Schedule:** every hour (`0 * * * *`) + manual dispatch
**Secret required:** `DISCORD_BOT_TOKEN` (repo secret) — for Discord scheduled events API.

The workflow:
1. Runs `node scripts/sync-events.mjs`
2. Commits only `static/events/` if any file changed

**To run locally:**
```bash
DISCORD_BOT_TOKEN=<token> node scripts/sync-events.mjs
```

### Meetup integration details

- Uses the internal GraphQL endpoint `https://www.meetup.com/gql2`
- Queries `getPastGroupEvents` and `getUpcomingGroupEvents` with cursor pagination
- CSRF token is extracted from the public HTML page — no Meetup API key needed
- Safe pagination limit: 50 requests per kind (covers 2500+ events)

### Discord integration details

- Uses `GET /guilds/<id>/scheduled-events?with_user_count=true` (Discord API v10)
- Requires `DISCORD_BOT_TOKEN` secret with `GUILD_SCHEDULED_EVENTS` intent
- Falls back to `fallbackEvents` in `events.config.json` if token is absent or API fails



---

## References

- [Docusaurus 3 Docs](https://docusaurus.io/docs)
- [MUI v7 Components](https://mui.com/material-ui/all-components/)
- [MUI Timeline (@mui/lab)](https://mui.com/material-ui/react-timeline/)
- [Giscus](https://giscus.app/)
- [GitHub Discussions](https://github.com/codaqui/institucional/discussions)
