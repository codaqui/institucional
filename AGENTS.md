# AGENTS.md — Codaqui Institutional Site

> Instructions for AI agents, contributors, and maintainers.

## Tech Stack

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
| **Node** | ≥20 (enforced in `package.json` engines) |
| **Hosting** | GitHub Pages via GitHub Actions |

**Site**: https://codaqui.dev · **Repo**: https://github.com/codaqui/institucional · **CNPJ**: 44.593.429/0001-05

---

## Commands

```bash
npm install        # Install dependencies
npm start          # Dev server → http://localhost:3000
npm run build      # Production build → ./build/
npm run serve      # Serve production build locally
npm run typecheck  # TypeScript check (tsc)
```

---

## Directory Structure

```
institucional/
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
│   │   ├── regex.md             # Regex learning page
│   │   ├── participe/           # Participation pages (Markdown)
│   │   │   ├── estudar.md
│   │   │   ├── mentoria.md
│   │   │   └── apoiar.md
│   │   ├── sobre/               # About section
│   │   │   ├── equipe.tsx       # Team (MUI Avatar + Card + Chip)
│   │   │   ├── ong.tsx          # Association + communities
│   │   │   ├── timeline.tsx     # Timeline (@mui/lab Timeline)
│   │   │   ├── conduta.md       # Code of conduct
│   │   │   └── pais-responsaveis.md
│   │   ├── blog/archive/        # Year archive redirects (2022–2025)
│   │   ├── quero/               # ⚠️ Legacy URL redirects — DO NOT DELETE
│   │   ├── team.tsx             # ⚠️ Redirect → /sobre/equipe
│   │   ├── contact.tsx          # ⚠️ Redirect → /contato
│   │   ├── conduta.tsx          # ⚠️ Redirect → /sobre/conduta
│   │   ├── ong.tsx              # ⚠️ Redirect → /sobre/ong
│   │   ├── timeline.tsx         # ⚠️ Redirect → /sobre/timeline
│   │   └── pais_responsaveis.tsx # ⚠️ Redirect → /sobre/pais-responsaveis
│   ├── theme/                   # Docusaurus theme overrides
│   │   ├── Root.tsx             # MUI ThemeProvider (SSR-safe, see below)
│   │   ├── muiTheme.ts          # createCodaquiTheme(mode) factory
│   │   └── BlogPostItem/        # Swizzled: injects Giscus comments
│   └── css/
│       └── custom.css           # Docusaurus CSS variables + global overrides
├── static/
│   ├── img/                     # logo.png, logo_blk.png, community logos
│   └── assets/docs/             # PDFs (estatuto.pdf)
├── docusaurus.config.ts         # Main Docusaurus configuration
├── sidebars.ts                  # Sidebar config for trilhas
├── tsconfig.json
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
| `social.ts` | `DISCORD_URL`, `WHATSAPP_URL`, `EMAIL`, `GITHUB_ORG`, `socialChannels[]` | index.tsx, contato.tsx, bio.tsx |
| `team.ts` | `diretoria[]`, `membros[]`, `alumni[]`, `mentores[]` | sobre/equipe.tsx |
| `communities.ts` | `communities[]` | index.tsx, sobre/ong.tsx |
| `projects.ts` | `projects[]` | projetos.tsx |
| `timeline.ts` | `timelineEvents[]` | sobre/timeline.tsx |

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
  tags: ["tag1", "tag2"],
}
```

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

### 7. Legacy URL Redirects

These files exist solely to redirect old URLs and **must not be deleted**:

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
| `develop` | `gh-pages-develop` | Preview environment |

### CI Pipeline (`.github/workflows/gh-deploy.yml`)

On push to `develop` or `main`:
1. `actions/checkout@v5`
2. `setup-node@v4` with Node 20 + npm cache
3. `npm ci`
4. `npm run build`
5. Deploy `./build/` to target branch via `peaceiris/actions-gh-pages@v4`

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
4. Review → merge → auto-deploy to `gh-pages-develop`
5. After validation, merge `develop` → `main` → auto-deploy to production

---

## PR Checklist

Before submitting:

- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
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
- [ ] No secrets or credentials committed
- [ ] Legacy redirect files untouched

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
| New community partners | As needed | `src/data/communities.ts` |
| Timeline events | Annually | `src/data/timeline.ts` |
| Social links (WhatsApp expires) | When links change | `src/data/social.ts` |
| External links | Monthly check | Throughout site |
| Dependencies | Quarterly | `package.json` → `npm update` |

---

## References

- [Docusaurus 3 Docs](https://docusaurus.io/docs)
- [MUI v7 Components](https://mui.com/material-ui/all-components/)
- [MUI Timeline (@mui/lab)](https://mui.com/material-ui/react-timeline/)
- [Giscus](https://giscus.app/)
- [GitHub Discussions](https://github.com/codaqui/institucional/discussions)
