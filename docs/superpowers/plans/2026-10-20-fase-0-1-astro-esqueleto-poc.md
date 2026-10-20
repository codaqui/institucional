<!-- AGENT-INDEX
purpose: Plano de implementação da Fase 0.1 (Esqueleto + POC) — app Astro 5 em frontend/ com tokens do Design System, auth-client para a API NestJS atual e 3 páginas representativas (/, /eventos/<slug>, /admin/eventos).
audience: AI agents executores, mantenedores (review por task).
status: pronto para execução (2026-10-20), branch develop.
sections:
  - Global Constraints
  - Tasks 1–11 (scaffold → tokens → libs → layouts → páginas → docs → verificação)
related-docs:
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — spec da Fase 0 (0.1 é a primeira subfase)
  - docs/plans/codaqui-1-0/design-system.md — tokens canônicos e correção WCAG
  - DEVELOPMENT.md — atualizado na Task 10
agent-protocol:
  - Executar task por task, em ordem; cada task termina em commit próprio.
  - Não tocar no app Docusaurus da raiz exceto onde o plano manda (.gitignore, tsconfig.json, package.json scripts, docs).
-->

# Fase 0.1 — Astro Esqueleto + POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o app Astro 5 em `frontend/` com tokens do Design System, auth-client consumindo a API NestJS atual e 3 páginas representativas (`/`, `/eventos/<slug>`, `/admin/eventos`) + `/auth/callback`, sem quebrar o Docusaurus da raiz.

**Architecture:** Astro 5 `output: 'static'` com ilhas React (`@astrojs/react`), Tailwind v4 via `@tailwindcss/vite`, MUI nos app-shells. O app vive em `frontend/` até a Fase 0.6 (cutover); o Docusaurus segue intocado como site oficial. Tokens `--cq-*` (gramática unificada, ver Task 2) são a fonte única, consumidos por Tailwind (`@theme inline`) e pelo `createCodaquiTheme` (MUI).

**Tech Stack:** Astro ^5, React ^19, Tailwind CSS ^4, MUI, TypeScript strict, Vitest, Node ≥24.

**Spec:** [docs/plans/codaqui-1-0/refatoracao-frontend-astro.md](../plans/codaqui-1-0/refatoracao-frontend-astro.md) (subfase 0.1) + [docs/plans/codaqui-1-0/design-system.md](../plans/codaqui-1-0/design-system.md)

## Global Constraints

- **Branch:** `develop` (instrução explícita do usuário — sem worktree).
- **Node ≥ 24** (engines do monorepo).
- **Backend intocado:** consumir a API atual como está (`http://localhost:3001` em dev). Zero mudanças em `backend/`.
- **Docusaurus intocado** exceto: `.gitignore`, `tsconfig.json` (exclude), `package.json` (scripts de conveniência), `DEVELOPMENT.md`, `AGENTS.md`.
- **MUI:** spec pede **v9** (`@mui/material@^9`). Se o npm não resolver v9, usar a v7 mais recente (`^7.3.9`, mesma linha do Docusaurus atual) e registrar o desvio no PR.
- **Tokens:** gramática canônica = a do arquivo `codaqui-tokens.css` do protótipo (`--cq-color-primary-*`, `--cq-action-primary-bg`, `--cq-border-default`, `--cq-focus-ring`). **Sem** a ponte `--ifm-*` e **sem** aliases `--codaqui-*` (decisão do anexo: nascemos limpos no Astro).
- **Cor acionável:** `#378369` (claro) / `#89CBB3` (escuro). `#57B593` é só marca/decoração.
- **Nunca hardcode de hex em componentes** — tokens CSS ou tema MUI.
- **Auth:** cookie httpOnly + `credentials: "include"`; 401 → estado local limpo + redirect. O app Astro em dev roda em `localhost:4321`; o CORS do backend já aceita qualquer `localhost:<porta>` (regex em `backend/src/main.ts`) — nenhuma mudança de CORS.
- **SessionStorage keys de auth (compatibilidade com o backend atual):** `codaqui_auth_return`, `codaqui_auth_community`, `codaqui_auth_logout_return`.
- **gtag:** `G-CL043JTTND`, `anonymize_ip: true`, só em produção (`import.meta.env.PROD`).
- **Idioma da UI:** pt-BR. Linguagem inclusiva ("participantes", nunca "alunos").
- **Desvios conhecidos da POC (registrados no PR, fecham nas fases 0.3/0.4):** checkout Stripe por **redirect** (embedded dialog fica para a 0.4); CRUD de eventos do admin fica para a 0.4 (POC é read-only); retorno de sucesso de pagamento mostra mensagem inline (não redireciona para `/membro`, que só nasce na 0.4).

---

### Task 1: Scaffold `frontend/` + wiring do monorepo

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/astro.config.mjs`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/.env.example`
- Create: `frontend/src/env.d.ts`
- Create: `frontend/src/pages/index.astro` (smoke)
- Modify: `.gitignore` (adicionar bloco Astro)
- Modify: `tsconfig.json:8` (exclude `frontend`)

**Interfaces:**
- Produces: scripts `dev`/`build`/`preview`/`check`/`test` em `frontend/`; `PUBLIC_API_URL` como env pública.

- [ ] **Step 1: Criar os arquivos de scaffold**

`frontend/package.json`:

```json
{
  "name": "codaqui-frontend-astro",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/react": "^4.3.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/material": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "astro": "^5.13.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.6.2",
    "vitest": "^3.2.0"
  }
}
```

`frontend/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://codaqui.dev",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

`frontend/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
```

`frontend/.env.example`:

```
# URL base da API NestJS (backend local via compose: porta 3001 no host)
PUBLIC_API_URL=http://localhost:3001
```

`frontend/src/env.d.ts`:

```ts
/// <reference types="astro/client" />
```

`frontend/src/pages/index.astro` (smoke, substituído na Task 6):

```astro
---
---
<html lang="pt-BR">
  <head><title>Codaqui — Astro POC</title></head>
  <body><h1>Astro POC OK</h1></body>
</html>
```

`.gitignore` — adicionar após o bloco "Docusaurus (frontend — raiz)":

```gitignore
# ─────────────────────────────────────────────────────
# Astro (frontend/ — Fase 0)
# ─────────────────────────────────────────────────────
frontend/dist/
frontend/.astro/
```

`tsconfig.json` (raiz) — exclude vira:

```json
"exclude": [".docusaurus", "build", "backend", "frontend", "node_modules"]
```

- [ ] **Step 2: Instalar e buildar**

```bash
cd frontend && npm install && npm run build
```

Expected: build gera `frontend/dist/index.html`. Se `@mui/material@^9` não resolver, trocar para `^7.3.9` e registrar o desvio no PR (ver Global Constraints).

- [ ] **Step 3: Verificar que o Docusaurus continua íntegro**

```bash
cd .. && npm run typecheck
```

Expected: PASS (frontend excluído do tsc da raiz).

- [ ] **Step 4: Commit**

```bash
git add frontend/ .gitignore tsconfig.json
git commit -m "feat(fase-0.1): scaffold do app Astro em frontend/ (Task 1)"
```

---

### Task 2: Tokens do Design System + tema MUI + BaseLayout com anti-FOUC

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/lib/mui-theme.ts`
- Test: `frontend/src/lib/mui-theme.test.ts`
- Create: `frontend/src/layouts/BaseLayout.astro`
- Modify: `frontend/src/pages/index.astro` (usar BaseLayout)

**Interfaces:**
- Produces: `createCodaquiTheme(mode: "light" | "dark"): Theme` (mesma API do Docusaurus atual); `cqColors` exportado; `BaseLayout` com props `{ title: string; description?: string; ogImage?: string; jsonLd?: Record<string, unknown> }`; `data-theme` no `<html>` como fonte de verdade do modo.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/mui-theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCodaquiTheme, cqColors } from "./mui-theme";

describe("createCodaquiTheme (Design System v1.0)", () => {
  it("usa cor acionável AA no claro (#378369), não o verde de marca", () => {
    const theme = createCodaquiTheme("light");
    expect(theme.palette.primary.main).toBe("#378369");
    expect(theme.palette.primary.contrastText).toBe("#FFFFFF");
  });

  it("usa primary-300 (#89CBB3) como acionável no escuro", () => {
    const theme = createCodaquiTheme("dark");
    expect(theme.palette.primary.main).toBe("#89CBB3");
    expect(theme.palette.primary.contrastText).toBe(cqColors.primary[900]);
  });

  it("mantém #57B593 disponível apenas como cor de marca (primary 500)", () => {
    expect(cqColors.primary[500]).toBe("#57B593");
  });

  it("secondary é o neutro plum (não o verde claro legado)", () => {
    expect(createCodaquiTheme("light").palette.secondary.main).toBe("#3A2F39");
  });

  it("mantém borderRadius 8 e backgrounds dark do tema atual", () => {
    const dark = createCodaquiTheme("dark");
    expect(dark.shape.borderRadius).toBe(8);
    expect(dark.palette.background.default).toBe("#2A2130");
    expect(dark.palette.background.paper).toBe("#3A2F39");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/mui-theme.test.ts
```

Expected: FAIL — `Cannot find module './mui-theme'`.

- [ ] **Step 3: Implementar `mui-theme.ts`**

Copiar o conteúdo de `code-to-analyze/Kimi_Agent_Codaqui Design System (1)/codaqui-mui-theme.ts` para `frontend/src/lib/mui-theme.ts` — o arquivo já implementa o tema corrigido (cor acionável `#378369`/`#89CBB3`, secondary plum, escala tipográfica, overrides de foco). Única adaptação: remover comentários que mencionam "Substitui `src/theme/muiTheme.ts`" e ajustar o cabeçalho para: `/** Tema MUI do Design System Codaqui — espelha src/styles/tokens.css (fonte única). */`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/mui-theme.test.ts
```

Expected: PASS (5 testes).

- [ ] **Step 5: Criar `tokens.css` (gramática unificada, sem ponte Docusaurus)**

`frontend/src/styles/tokens.css` — copiar de `code-to-analyze/Kimi_Agent_Codaqui Design System (1)/codaqui-tokens.css` **somente** as seções 1–8 e 10 do `:root`, mais o bloco `[data-theme="dark"]`, fazendo estas remoções:

- Remover toda a seção "9. CAMADA INFMA (ponte Docusaurus)" (`--ifm-*`, `--docusaurus-*`, aliases `--codaqui-*`).
- No bloco dark, remover as linhas `--ifm-*` e `--docusaurus-highlighted-code-line-bg`.
- Manter intactos: primitivos primary/neutral/semânticas, tokens semânticos `--cq-bg-*`/`--cq-text-*`/`--cq-border-*`/`--cq-action-*`/`--cq-link*`/`--cq-focus-ring`, tipografia, espaçamento, raios/sombras, movimento, e os utilitários de acessibilidade (`:focus-visible`, `prefers-reduced-motion`, `.cq-visually-hidden`).

- [ ] **Step 6: Criar `global.css` (Tailwind v4 + ponte @theme)**

`frontend/src/styles/global.css`:

```css
@import "tailwindcss";
@import "./tokens.css";

/* Ponte tokens → utilitários Tailwind (bg-action, text-primary, etc.) */
@theme inline {
  --color-primary-50: var(--cq-color-primary-50);
  --color-primary-100: var(--cq-color-primary-100);
  --color-primary-200: var(--cq-color-primary-200);
  --color-primary-300: var(--cq-color-primary-300);
  --color-primary-400: var(--cq-color-primary-400);
  --color-primary-500: var(--cq-color-primary-500);
  --color-primary-600: var(--cq-color-primary-600);
  --color-primary-700: var(--cq-color-primary-700);
  --color-primary-800: var(--cq-color-primary-800);
  --color-primary-900: var(--cq-color-primary-900);
  --color-neutral-50: var(--cq-color-neutral-50);
  --color-neutral-100: var(--cq-color-neutral-100);
  --color-neutral-200: var(--cq-color-neutral-200);
  --color-neutral-300: var(--cq-color-neutral-300);
  --color-neutral-400: var(--cq-color-neutral-400);
  --color-neutral-500: var(--cq-color-neutral-500);
  --color-neutral-600: var(--cq-color-neutral-600);
  --color-neutral-700: var(--cq-color-neutral-700);
  --color-neutral-800: var(--cq-color-neutral-800);
  --color-neutral-900: var(--cq-color-neutral-900);
  --color-body: var(--cq-bg-body);
  --color-surface: var(--cq-bg-surface);
  --color-sunken: var(--cq-bg-sunken);
  --color-action: var(--cq-action-primary-bg);
  --color-action-hover: var(--cq-action-primary-hover);
  --color-on-action: var(--cq-action-primary-text);
  --color-link: var(--cq-link);
  --color-link-hover: var(--cq-link-hover);
  --color-text-primary: var(--cq-text-primary);
  --color-text-secondary: var(--cq-text-secondary);
  --color-border: var(--cq-border-default);
  --color-border-strong: var(--cq-border-strong);
  --font-sans: var(--cq-font-family-base);
  --font-mono: var(--cq-font-family-mono);
  --radius-sm: var(--cq-radius-sm);
  --radius-md: var(--cq-radius-md);
  --radius-lg: var(--cq-radius-lg);
  --radius-xl: var(--cq-radius-xl);
  --shadow-sm: var(--cq-shadow-sm);
  --shadow-md: var(--cq-shadow-md);
  --shadow-lg: var(--cq-shadow-lg);
}

body {
  background-color: var(--cq-bg-body);
  color: var(--cq-text-primary);
  font-family: var(--cq-font-family-base);
}

a {
  color: var(--cq-link);
}
a:hover {
  color: var(--cq-link-hover);
}
```

- [ ] **Step 7: Criar `BaseLayout.astro` com script de tema anti-FOUC**

`frontend/src/layouts/BaseLayout.astro`:

```astro
---
import "../styles/global.css";

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown>;
}

const {
  title,
  description = "Codaqui — Democratizando comunidades e projetos de tecnologia!",
  ogImage = "/img/og-codaqui.jpg",
  jsonLd,
} = Astro.props;

const canonical = new URL(Astro.url.pathname, Astro.site);
const ogImageAbsolute = new URL(ogImage, Astro.site);
const isProd = import.meta.env.PROD;
---

<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImageAbsolute} />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/img/favicon.ico" />
    {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
    <script is:inline>
      // Anti-FOUC: resolve o tema antes do primeiro paint.
      // Fonte de verdade: localStorage "cq-theme" → prefers-color-scheme.
      (() => {
        const stored = localStorage.getItem("cq-theme");
        const mode =
          stored === "dark" || stored === "light"
            ? stored
            : matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        document.documentElement.dataset.theme = mode;
      })();
    </script>
    {isProd && (
      <>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-CL043JTTND"></script>
        <script is:inline>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CL043JTTND', { anonymize_ip: true });
        </script>
      </>
    )}
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 8: Apontar `index.astro` para o BaseLayout + copiar assets mínimos**

```bash
mkdir -p frontend/public/img
cp static/img/logo_principal.svg static/img/logo_monocromatica.svg static/img/logo_mono2.svg frontend/public/img/
cp static/img/favicon.ico frontend/public/img/ 2>/dev/null || cp static/favicon.ico frontend/public/img/ 2>/dev/null || true
cp static/img/og-codaqui.jpg frontend/public/img/ 2>/dev/null || true
ls static/img/ | head -30   # confirmar nomes reais de favicon/og; ajustar os cp acima se necessário
```

`frontend/src/pages/index.astro`:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="Codaqui — Astro POC">
  <main class="mx-auto max-w-5xl px-4 py-16">
    <h1 class="text-4xl font-extrabold">Astro POC OK</h1>
  </main>
</BaseLayout>
```

- [ ] **Step 9: Build + testes**

```bash
cd frontend && npm run build && npm run check && npm run test
```

Expected: tudo verde; `dist/index.html` contém `data-theme` script e CSS com `--cq-color-primary-700`.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.1): tokens do Design System + tema MUI corrigido + BaseLayout (Task 2)"
```

---

### Task 3: Lib de eventos (tipos + loader do snapshot + event-path) — TDD

**Files:**
- Create: `frontend/src/lib/events.ts`
- Create: `frontend/src/lib/event-path.ts`
- Test: `frontend/src/lib/event-path.test.ts`
- Test: `frontend/src/lib/events.test.ts`

**Interfaces:**
- Produces: `EventStatus`, `EventItem`, `EventSummary`, `EventIndexFile`, `loadEventsIndex(): EventIndexFile`, `buildEventPath(source, sourceId, eventId): string`, `buildEventSlugPath(slug): string`, `buildEventPublicPath(event): string`, `eventRouteParam(event: EventSummary): string` (param do `[...path]` — usado na Task 7), `resolveEventImageUrl`, `truncateEventSummary`, `buildEventJsonLd`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/event-path.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildEventPath,
  buildEventSlugPath,
  buildEventPublicPath,
  eventRouteParam,
  truncateEventSummary,
  buildEventJsonLd,
} from "./event-path";
import type { EventSummary } from "./events";

const external: EventSummary = {
  id: "ev:123",
  title: "Meetup DevPR",
  summary: "Encontro mensal",
  startAt: "2026-11-10T19:00:00-03:00",
  timezone: "America/Sao_Paulo",
  platform: "meetup",
  host: "DevParaná",
  location: "Curitiba",
  href: "https://meetup.com/x",
  tags: [],
  ctaLabel: "Inscrever-se",
  source: "meetup",
  sourceId: "devparana",
  sourceKey: "meetup:devparana",
  itemPath: "meetup/devparana/ev123.json",
};

const internal: EventSummary = {
  ...external,
  id: "uuid-1",
  slug: "devpr-conf-2026",
  source: "internal",
  sourceId: "codaqui",
  sourceKey: "internal:codaqui",
};

describe("event-path", () => {
  it("monta path de externo codificando segmentos", () => {
    expect(buildEventPath("meetup", "devparana", "ev:123")).toBe(
      "/eventos/meetup/devparana/ev%3A123",
    );
  });

  it("interno com slug usa /eventos/<slug>", () => {
    expect(buildEventSlugPath("devpr-conf-2026")).toBe("/eventos/devpr-conf-2026");
    expect(buildEventPublicPath(internal)).toBe("/eventos/devpr-conf-2026");
  });

  it("interno sem slug cai no formato externo (legado)", () => {
    const { slug, ...semSlug } = internal;
    expect(buildEventPublicPath(semSlug)).toBe(
      "/eventos/internal/codaqui/uuid-1",
    );
  });

  it("eventRouteParam remove o prefixo /eventos/ para o [...path]", () => {
    expect(eventRouteParam(internal)).toBe("devpr-conf-2026");
    expect(eventRouteParam(external)).toBe("meetup/devparana/ev%3A123");
  });

  it("truncateEventSummary corta em 160 chars com reticências", () => {
    const long = "a".repeat(200);
    expect(truncateEventSummary(long)).toHaveLength(160);
    expect(truncateEventSummary("curto")).toBe("curto");
  });

  it("buildEventJsonLd emite schema.org/Event com status mapeado", () => {
    const ld = buildEventJsonLd(
      { ...internal, status: "canceled" },
      "https://codaqui.dev/eventos/devpr-conf-2026",
    );
    expect(ld["@type"]).toBe("Event");
    expect(ld.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(ld.organizer.name).toBe("DevParaná");
  });
});
```

`frontend/src/lib/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadEventsIndex } from "./events";

describe("loadEventsIndex", () => {
  it("lê o snapshot real do monorepo (static/events/index.json)", () => {
    const index = loadEventsIndex();
    expect(Array.isArray(index.events)).toBe(true);
    expect(index.events.length).toBeGreaterThan(0);
    const first = index.events[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("source");
    expect(first).toHaveProperty("sourceKey");
    expect(first).toHaveProperty("startAt");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/lib/event-path.test.ts src/lib/events.test.ts
```

Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `events.ts` e `event-path.ts`**

`frontend/src/lib/events.ts`:

```ts
export type EventStatus = "scheduled" | "active" | "completed" | "canceled";

export interface EventOrganizer {
  name: string;
  id?: string;
  photoUrl?: string;
}

export interface EventItem {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  platform: string;
  host: string;
  location: string;
  href: string;
  tags: string[];
  ctaLabel: string;
  featured?: boolean;
  status?: EventStatus;
  organizers?: EventOrganizer[];
  imageUrl?: string;
}

export interface EventSummary extends EventItem {
  source: string;
  sourceId: string;
  sourceKey: string;
  itemPath: string;
  hasOverride?: boolean;
}

export interface EventSourceSummary {
  key: string;
  source: string;
  sourceId: string;
  label?: string;
}

export interface EventIndexFile {
  generatedAt?: string;
  sources: EventSourceSummary[];
  events: EventSummary[];
}
```

> Se campos acima divergirem de `src/data/events.ts` do Docusaurus, o Docusaurus vence — copiar os tipos de lá e ajustar os testes.

`loadEventsIndex` (mesmo arquivo, em `events.ts`):

```ts
import { readFileSync } from "node:fs";

/**
 * Lê o snapshot agregado do monorepo em build time.
 * Caminho: frontend/src/lib/events.ts → repo/static/events/index.json.
 */
export function loadEventsIndex(): EventIndexFile {
  const url = new URL("../../../static/events/index.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf-8")) as EventIndexFile;
}
```

`frontend/src/lib/event-path.ts`: copiar **integralmente** `src/utils/event-path.ts` do Docusaurus, trocando apenas o import de tipos para `./events` e adicionando no final:

```ts
/** Param da rota Astro `[...path]` para o evento (sem o prefixo /eventos/). */
export function eventRouteParam(event: {
  source?: string;
  sourceId?: string;
  id: string;
  slug?: string | null;
}): string {
  return buildEventPublicPath(event).replace(/^\/eventos\//, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/lib/event-path.test.ts src/lib/events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat(fase-0.1): lib de eventos + event-path portados (Task 3)"
```

---

### Task 4: `auth-client` framework-agnostic + hook `useAuth` — TDD

Porta o contrato de `src/hooks/useAuth.ts` do Docusaurus para um módulo puro + hook fino. Endpoints consumidos (backend atual, sem mudanças): `GET /auth/me`, `GET /auth/github`, `GET /auth/logout`, `POST /auth/finalize` (este último usado na Task 8).

**Files:**
- Create: `frontend/src/lib/config.ts`
- Create: `frontend/src/lib/auth-client.ts`
- Create: `frontend/src/lib/use-auth.ts`
- Test: `frontend/src/lib/auth-client.test.ts`

**Interfaces:**
- Produces:
  - `API_URL: string` (de `import.meta.env.PUBLIC_API_URL`, fallback `http://localhost:3001`) — em `config.ts`
  - `AuthUser` = `{ sub: string; githubId: string; handle: string; name: string; avatarUrl: string; roles: string[] }`
  - `fetchMe(apiUrl: string): Promise<AuthUser | null>`
  - `startLogin(apiUrl: string, options?: { returnTo?: string; switchAccount?: boolean }): void`
  - `startLogout(apiUrl: string, options?: { returnTo?: string }): void`
  - `authFetch(apiUrl: string, path: string, init?: RequestInit, onUnauthorized?: () => void): Promise<Response>`
  - `useAuth()` retornando `{ user, ready, isLoggedIn, isAdmin, isEventOrganizer, login, logout, refreshUser, authFetch }` (subconjunto usado pela POC; demais flags de role entram na 0.4)

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/auth-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMe, authFetch, startLogin, startLogout } from "./auth-client";

const API = "http://localhost:3001";
const user = {
  sub: "uuid",
  githubId: "1",
  handle: "octocat",
  name: "Octo",
  avatarUrl: "https://x",
  roles: ["membro"],
};

describe("fetchMe", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("retorna o usuário quando 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(user), { status: 200 })),
    );
    expect(await fetchMe(API)).toEqual(user);
  });

  it("retorna null quando 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    expect(await fetchMe(API)).toBeNull();
  });

  it("retorna null em erro de rede", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await fetchMe(API)).toBeNull();
  });
});

describe("authFetch", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("envia credentials include e Content-Type JSON", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await authFetch(API, "/events", { method: "POST", body: "{}" });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`${API}/events`);
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("dispara onUnauthorized em 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const onUnauthorized = vi.fn();
    await authFetch(API, "/events", {}, onUnauthorized);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("aceita URL absoluta sem prefixar apiUrl", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await authFetch(API, "https://outro.dev/x");
    expect(spy.mock.calls[0][0]).toBe("https://outro.dev/x");
  });
});

describe("startLogin / startLogout", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("login redireciona para /auth/github com returnTo=/auth/callback absoluto", () => {
    const location = new URL("http://localhost:4321/eventos");
    vi.stubGlobal("location", { ...location, href: "" });
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => session.set(k, v),
      removeItem: (k: string) => session.delete(k),
      getItem: (k: string) => session.get(k),
    });
    startLogin(API);
    const redirect = new URL((globalThis as any).location.href);
    expect(redirect.origin).toBe(API);
    expect(redirect.pathname).toBe("/auth/github");
    expect(redirect.searchParams.get("returnTo")).toBe(
      "http://localhost:4321/auth/callback",
    );
    expect(session.get("codaqui_auth_return")).toBe("/eventos");
  });

  it("logout chama /auth/logout e limpa estado via callback", () => {
    vi.stubGlobal("location", { href: "" });
    startLogout(API, { returnTo: "/" });
    const href = (globalThis as any).location.href as string;
    expect(href.startsWith(`${API}/auth/logout?returnTo=`)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/auth-client.test.ts
```

Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `config.ts`, `auth-client.ts` e `use-auth.ts`**

`frontend/src/lib/config.ts`:

```ts
/** URL base da API NestJS. Em dev: http://localhost:3001 (compose). */
export const API_URL: string =
  import.meta.env.PUBLIC_API_URL ?? "http://localhost:3001";
```

`frontend/src/lib/auth-client.ts`:

```ts
export interface AuthUser {
  sub: string;
  githubId: string;
  handle: string;
  name: string;
  avatarUrl: string;
  roles: string[];
}

const RETURN_KEY = "codaqui_auth_return";
const COMMUNITY_KEY = "codaqui_auth_community";
const LOGOUT_RETURN_KEY = "codaqui_auth_logout_return";

/** GET /auth/me com cookie httpOnly. Null quando não autenticado. */
export async function fetchMe(apiUrl: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Inicia o OAuth do GitHub. O backend sempre redireciona para
 * `/auth/callback` no domínio atual (a página final fica no sessionStorage,
 * evitando colisão de query params — ver useAuth.ts legado).
 */
export function startLogin(
  apiUrl: string,
  options?: { returnTo?: string; switchAccount?: boolean },
): void {
  const returnPath = options?.returnTo ?? globalThis.location.pathname;
  sessionStorage.setItem(RETURN_KEY, returnPath);
  sessionStorage.removeItem(COMMUNITY_KEY);
  const absoluteReturn = new URL(
    "/auth/callback",
    globalThis.location.origin,
  ).toString();
  const url = new URL(`${apiUrl}/auth/github`);
  url.searchParams.set("returnTo", absoluteReturn);
  if (options?.switchAccount) url.searchParams.set("login", "");
  globalThis.location.href = url.toString();
}

/** Encerra a sessão no backend e redireciona. */
export function startLogout(
  apiUrl: string,
  options?: { returnTo?: string },
): void {
  if (options?.returnTo) {
    sessionStorage.setItem(LOGOUT_RETURN_KEY, options.returnTo);
  }
  const absoluteReturn = options?.returnTo
    ? new URL(options.returnTo, globalThis.location.origin).toString()
    : null;
  const returnParam = absoluteReturn
    ? `?returnTo=${encodeURIComponent(absoluteReturn)}`
    : "";
  globalThis.location.href = `${apiUrl}/auth/logout${returnParam}`;
}

/**
 * fetch autenticado: credentials include + JSON. Em 401 dispara
 * onUnauthorized (o consumidor limpa o estado local → guard redireciona).
 */
export async function authFetch(
  apiUrl: string,
  path: string,
  init: RequestInit = {},
  onUnauthorized?: () => void,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) onUnauthorized?.();
  return res;
}
```

`frontend/src/lib/use-auth.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  API_URL,
} from "./config";
import {
  authFetch as authFetchClient,
  fetchMe,
  startLogin,
  startLogout,
  type AuthUser,
} from "./auth-client";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const profile = await fetchMe(API_URL);
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  const login = useCallback(
    (options?: { returnTo?: string; switchAccount?: boolean }) =>
      startLogin(API_URL, options),
    [],
  );

  const logout = useCallback(
    (options?: { returnTo?: string }) => {
      setUser(null);
      startLogout(API_URL, options);
    },
    [],
  );

  const authFetch = useCallback(
    (path: string, init: RequestInit = {}) =>
      authFetchClient(API_URL, path, init, () => setUser(null)),
    [],
  );

  return {
    user,
    ready,
    isLoggedIn: user !== null,
    isAdmin: user?.roles.includes("admin") ?? false,
    isEventOrganizer: user?.roles.includes("event_organizer") ?? false,
    login,
    logout,
    refreshUser,
    authFetch,
  };
}

export type { AuthUser };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test
```

Expected: PASS (todos os testes, incluindo Tasks 2–3).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat(fase-0.1): auth-client framework-agnostic + hook useAuth (Task 4)"
```

---

### Task 5: Layouts público/app + header/footer + ilhas NavbarAuth e ThemeToggle

**Files:**
- Create: `frontend/src/components/astro/SiteHeader.astro`
- Create: `frontend/src/components/astro/SiteFooter.astro`
- Create: `frontend/src/components/islands/NavbarAuth.tsx`
- Create: `frontend/src/components/islands/ThemeToggle.tsx`
- Create: `frontend/src/components/islands/MuiIslandProvider.tsx`
- Create: `frontend/src/layouts/PublicLayout.astro`
- Create: `frontend/src/layouts/AppLayout.astro`

**Interfaces:**
- Consumes: `BaseLayout` (Task 2), `useAuth` (Task 4).
- Produces: `PublicLayout` (props = BaseLayout props) usado pelas Tasks 6–8; `AppLayout` (props `{ title: string }`) usado pela Task 9; `MuiIslandProvider` (wrapper `ThemeProvider` sincronizado com `data-theme` via MutationObserver — substituto do `Root.tsx` do Docusaurus) usado por toda ilha MUI.

- [ ] **Step 1: Criar `MuiIslandProvider.tsx` (tema MUI sincronizado com `data-theme`)**

`frontend/src/components/islands/MuiIslandProvider.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createCodaquiTheme } from "../../lib/mui-theme";

/**
 * Envolve ilhas MUI. Lê `data-theme` do <html> (setado pelo script
 * anti-FOUC do BaseLayout) e reage a mudanças via MutationObserver.
 * Ilhas React rodam só no client (client:only/client:load) — sem SSR,
 * portanto sem a restrição do useColorMode do Docusaurus.
 */
export default function MuiIslandProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const getMode = () =>
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setMode(getMode());
    const observer = new MutationObserver(() => setMode(getMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider theme={createCodaquiTheme(mode)}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Criar `ThemeToggle.tsx` e `NavbarAuth.tsx`**

`frontend/src/components/islands/ThemeToggle.tsx`:

```tsx
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMode(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cq-theme", next);
    setMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="rounded-full p-2 text-text-primary hover:bg-sunken"
    >
      {mode === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
```

`frontend/src/components/islands/NavbarAuth.tsx`:

```tsx
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import { Avatar, Button, Chip, Stack } from "@mui/material";

function NavbarAuthInner() {
  const { user, ready, isLoggedIn, login, logout } = useAuth();

  if (!ready) {
    return <span className="inline-block h-9 w-24 animate-pulse rounded-md bg-sunken" />;
  }

  if (!isLoggedIn || !user) {
    return (
      <Button variant="contained" size="small" onClick={() => login()}>
        Entrar com GitHub
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        avatar={<Avatar src={user.avatarUrl} alt={user.name} />}
        label={user.handle}
        size="small"
      />
      <Button size="small" color="inherit" onClick={() => logout({ returnTo: "/" })}>
        Sair
      </Button>
    </Stack>
  );
}

export default function NavbarAuth() {
  return (
    <MuiIslandProvider>
      <NavbarAuthInner />
    </MuiIslandProvider>
  );
}
```

- [ ] **Step 3: Criar `SiteHeader.astro` e `SiteFooter.astro`**

`SiteHeader.astro` — navbar pública portada do `docusaurus.config.ts` (itens: Início `/`; dropdowns Sobre/Participe/Trilhas via `<details>`; Eventos `/eventos`; Projetos `/projetos`; Patrocinadores `/patrocinadores`; Blog `/blog`; Contato `/contato`). Estrutura:

```astro
---
import NavbarAuth from "../islands/NavbarAuth";
import ThemeToggle from "../islands/ThemeToggle";

const sobreItems = [
  { label: "Equipe", href: "/sobre/equipe" },
  { label: "Membros", href: "/membros" },
  { label: "Associação", href: "/sobre/ong" },
  { label: "Títulos e Reconhecimentos", href: "/sobre/titulos" },
  { label: "Insights", href: "/sobre/insights" },
  { label: "Transparência", href: "/transparencia" },
  { label: "Pais e Responsáveis", href: "/sobre/pais-responsaveis" },
  { label: "Código de Conduta", href: "/sobre/conduta" },
];
const participeItems = [
  { label: "#QueroEstudar", href: "/participe/estudar" },
  { label: "#QueroApoiar", href: "/participe/apoiar" },
  { label: "#QueroMentoria", href: "/participe/mentoria" },
  { label: "#ClubCodaqui", href: "/clube" },
];
const trilhasItems = [
  { label: "Visão Geral", href: "/trilhas" },
  { label: "Python 101", href: "/trilhas/python/" },
  { label: "GitHub 101", href: "/trilhas/github/" },
];
const directLinks = [
  { label: "Eventos", href: "/eventos" },
  { label: "Projetos", href: "/projetos" },
  { label: "Patrocinadores", href: "/patrocinadores" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "/contato" },
];
const groups = [
  { label: "Sobre", items: sobreItems },
  { label: "Participe", items: participeItems },
  { label: "Trilhas", items: trilhasItems },
];
---

<header class="sticky top-0 z-40 border-b border-border bg-surface">
  <nav class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4" aria-label="Navegação principal">
    <a href="/" class="flex items-center gap-2 font-extrabold text-text-primary">
      <img src="/img/logo_principal.svg" alt="Codaqui" class="h-8 w-auto" />
    </a>
    <a href="/" class="text-sm font-bold text-text-primary hover:text-link">Início</a>
    {groups.map((group) => (
      <details class="group relative">
        <summary class="cursor-pointer list-none text-sm font-bold text-text-primary hover:text-link">
          {group.label}
        </summary>
        <ul class="absolute left-0 mt-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-md">
          {group.items.map((item) => (
            <li>
              <a href={item.href} class="block rounded-md px-3 py-2 text-sm text-text-primary hover:bg-sunken">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </details>
    ))}
    {directLinks.map((link) => (
      <a href={link.href} class="hidden text-sm font-bold text-text-primary hover:text-link lg:inline">
        {link.label}
      </a>
    ))}
    <span class="ms-auto flex items-center gap-1">
      <ThemeToggle client:load />
      <NavbarAuth client:load />
    </span>
  </nav>
</header>
```

> ⚠️ Os links para rotas que ainda não existem no Astro (`/blog`, `/projetos` etc.) são intencionais na POC: o header é o definitivo, e a paridade de rotas é requisito das fases 0.2/0.3 — não da 0.1. Registrar no PR. Se preferir, esconda-os atrás de um flag `POC` — mas manter o header completo força o checklist de paridade.

`SiteFooter.astro` — rodapé simples com CNPJ `44.593.429/0001-05`, e-mail `contato@codaqui.dev`, link para GitHub `https://github.com/codaqui` e o texto de licença CC BY-SA (copiar o texto do footer do `docusaurus.config.ts`).

- [ ] **Step 4: Criar `PublicLayout.astro` e `AppLayout.astro`**

`frontend/src/layouts/PublicLayout.astro`:

```astro
---
import BaseLayout from "./BaseLayout.astro";
import SiteHeader from "../components/astro/SiteHeader.astro";
import SiteFooter from "../components/astro/SiteFooter.astro";

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown>;
}
---

<BaseLayout {...Astro.props}>
  <a href="#conteudo" class="cq-visually-hidden focus:not-sr-only">Pular para o conteúdo</a>
  <SiteHeader />
  <main id="conteudo">
    <slot />
  </main>
  <SiteFooter />
</BaseLayout>
```

`frontend/src/layouts/AppLayout.astro` (app-shell mínimo da POC — a sidebar completa do 1.0.0 nasce na 0.4):

```astro
---
import BaseLayout from "./BaseLayout.astro";

interface Props {
  title: string;
}
---

<BaseLayout {...Astro.props}>
  <div class="flex min-h-screen flex-col">
    <header class="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <img src="/img/logo_principal.svg" alt="Codaqui" class="h-7 w-auto" />
      <span class="text-sm font-bold text-text-secondary">Painel</span>
      <span class="text-sm text-text-secondary">›</span>
      <span class="text-sm font-bold text-text-primary">{Astro.props.title}</span>
      <a href="/" class="ms-auto text-sm text-link hover:text-link-hover">← Voltar ao site</a>
    </header>
    <div class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <slot />
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 5: Build + check**

```bash
cd frontend && npm run build && npm run check
```

Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat(fase-0.1): layouts Base/Public/App + ilhas NavbarAuth e ThemeToggle (Task 5)"
```

---

### Task 6: Homepage `/` (seções em `.astro` + ilha SocialProofStrip)

**Files:**
- Create: `frontend/src/data/social.ts` (subconjunto portado)
- Create: `frontend/src/data/communities.ts` (cópia de `src/data/communities.ts`)
- Create: `frontend/src/components/astro/HeroBanner.astro`
- Create: `frontend/src/components/astro/FeaturesSection.astro`
- Create: `frontend/src/components/astro/CommunitySection.astro`
- Create: `frontend/src/components/astro/JoinSection.astro`
- Create: `frontend/src/components/islands/SocialProofStrip.tsx`
- Modify: `frontend/src/pages/index.astro`

**Interfaces:**
- Consumes: `PublicLayout` (Task 5), `API_URL` (Task 4).
- Produces: `/` renderizada 100% estática exceto a ilha `SocialProofStrip` (`client:visible`).

- [ ] **Step 1: Portar dados**

```bash
cp src/data/communities.ts frontend/src/data/communities.ts
```

`frontend/src/data/social.ts` — copiar de `src/data/social.ts` **somente** os exports usados pela homepage e footer: `DISCORD_URL`, `WHATSAPP_URL`, `EMAIL`, `GITHUB_ORG`, `socialChannels`, `DISCORD_WIDGET_URL` (se existir no arquivo de origem). Ajustar imports quebrados.

- [ ] **Step 2: Criar as seções `.astro`**

Portar de `src/pages/index.tsx` (linhas 21–325), trocando MUI por HTML + Tailwind (tokens `--cq-*`):

- `HeroBanner.astro`: logo monocromática, tagline "Democratizando comunidades e projetos de tecnologia! 🇧🇷", CTAs `#QueroEstudar` → `/participe/estudar` e `#QueroApoiar` → `/participe/apoiar`. Fundo em gradiente da marca (usa `--cq-color-primary-900` → `--cq-color-primary-500` — decoração, permitido).
- `FeaturesSection.astro`: título "🎓 Nossa solução" + os 4 cards — **copiar o array `features` literal de `src/pages/index.tsx` (linhas ~121–188)** e renderizar com cards Tailwind (`bg-surface`, `border-border`, `rounded-xl`, `shadow-sm`).
- `CommunitySection.astro`: título "🤝 Comunidades Participantes" + grid dos `communities` (logo, nome, descrição, links).
- `JoinSection.astro`: título "💬 Entre na comunidade" + iframe do widget do Discord (`DISCORD_WIDGET_URL`, `loading="lazy"`, `title="Widget do servidor Discord"`) + cards de `socialChannels` (exceto discord) + botão `DISCORD_URL`.

- [ ] **Step 3: Criar a ilha `SocialProofStrip.tsx`**

`frontend/src/components/islands/SocialProofStrip.tsx`:

```tsx
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/config";

interface Donor {
  id: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
}

/** Faixa "N pessoas apoiam…" — dados públicos de GET /members/donors. */
export default function SocialProofStrip() {
  const [donors, setDonors] = useState<Donor[] | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/members/donors`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Donor[]) => setDonors(Array.isArray(data) ? data : []))
      .catch(() => setDonors([]));
  }, []);

  if (donors === null) {
    return <span className="inline-block h-6 w-64 animate-pulse rounded bg-sunken" />;
  }
  if (donors.length === 0) return null;

  return (
    <p className="text-sm text-text-secondary">
      <strong className="text-text-primary">{donors.length} pessoas</strong>{" "}
      já apoiam a Codaqui — obrigado! 💚
    </p>
  );
}
```

> ⚠️ Verificar o shape real de `GET /members/donors` no backend (`backend/src/members/`) durante a execução; se for `{ donors: [...] }` em vez de array, ajustar o parse.

- [ ] **Step 4: Montar `index.astro`**

```astro
---
import PublicLayout from "../layouts/PublicLayout.astro";
import HeroBanner from "../components/astro/HeroBanner.astro";
import FeaturesSection from "../components/astro/FeaturesSection.astro";
import CommunitySection from "../components/astro/CommunitySection.astro";
import JoinSection from "../components/astro/JoinSection.astro";
import SocialProofStrip from "../components/islands/SocialProofStrip";
---

<PublicLayout title="Codaqui — Democratizando comunidades e projetos de tecnologia!">
  <HeroBanner />
  <div class="mx-auto max-w-6xl px-4 py-4">
    <SocialProofStrip client:visible />
  </div>
  <FeaturesSection />
  <CommunitySection />
  <JoinSection />
</PublicLayout>
```

- [ ] **Step 5: Build + check + test**

```bash
cd frontend && npm run build && npm run check && npm run test
```

Expected: verde; `dist/index.html` contém a tagline e os 4 cards.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat(fase-0.1): homepage em Astro com ilha SocialProofStrip (Task 6)"
```

---

### Task 7: `/eventos/[...path]` (getStaticPaths do snapshot) + ilha de inscrição

**Files:**
- Create: `frontend/src/pages/eventos/[...path].astro`
- Create: `frontend/src/components/islands/EventRegistrationIsland.tsx`
- Test: `frontend/src/lib/event-route.test.ts` (cobre `eventRouteParam` × paths gerados)

**Interfaces:**
- Consumes: `loadEventsIndex`, `eventRouteParam`, `buildEventPublicPath`, `buildEventJsonLd`, `truncateEventSummary` (Task 3); `useAuth`, `API_URL` (Task 4); `PublicLayout` (Task 5).
- Produces: rotas `/eventos/<slug>` e `/eventos/<source>/<sourceId>/<id>`; ilha com props `{ eventId: string; source: string; sourceId: string }`.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/event-route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadEventsIndex } from "./events";
import { eventRouteParam } from "./event-path";

describe("rotas de eventos (snapshot real)", () => {
  it("gera um param único por evento", () => {
    const { events } = loadEventsIndex();
    const params = events.map((e) => eventRouteParam(e));
    expect(new Set(params).size).toBe(params.length);
  });

  it("todo param é não-vazio e sem espaços", () => {
    const { events } = loadEventsIndex();
    for (const e of events) {
      const p = eventRouteParam(e);
      expect(p.length).toBeGreaterThan(0);
      expect(p).not.toMatch(/\s/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails** (o helper já existe — o teste deve passar; se falhar por duplicatas, investigar o snapshot antes de prosseguir)

```bash
cd frontend && npx vitest run src/lib/event-route.test.ts
```

Expected: PASS (teste de caracterização sobre o snapshot real). Se houver colisão de params no snapshot real, reportar — não contornar.

- [ ] **Step 3: Criar a página `[...path].astro`**

```astro
---
import PublicLayout from "../../layouts/PublicLayout.astro";
import EventRegistrationIsland from "../../components/islands/EventRegistrationIsland";
import { loadEventsIndex, type EventSummary } from "../../lib/events";
import {
  buildEventJsonLd,
  buildEventPublicPath,
  eventRouteParam,
  truncateEventSummary,
} from "../../lib/event-path";

export function getStaticPaths() {
  return loadEventsIndex().events.map((event) => ({
    params: { path: eventRouteParam(event) },
    props: { event },
  }));
}

interface Props {
  event: EventSummary;
}

const { event } = Astro.props;
const absoluteUrl = new URL(buildEventPublicPath(event), Astro.site).toString();
const jsonLd = buildEventJsonLd(event, absoluteUrl);
const description = truncateEventSummary(event.summary ?? "");

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: event.timezone || "America/Sao_Paulo",
});
const start = new Date(event.startAt);
const isPast = event.status === "completed" || event.status === "canceled";
---

<PublicLayout title={`${event.title} — Codaqui`} description={description} jsonLd={jsonLd}>
  <article class="mx-auto max-w-3xl px-4 py-10">
    <p class="text-sm font-bold text-text-secondary">{event.host}</p>
    <h1 class="mt-1 text-3xl font-extrabold text-text-primary">{event.title}</h1>
    <p class="mt-4 text-text-secondary">
      📅 <time datetime={event.startAt}>{dateFmt.format(start)}</time><br />
      📍 {event.location}
    </p>
    {event.tags.length > 0 && (
      <ul class="mt-3 flex flex-wrap gap-2">
        {event.tags.map((tag) => (
          <li class="rounded-full bg-sunken px-3 py-1 text-xs font-bold text-text-secondary">{tag}</li>
        ))}
      </ul>
    )}
    <p class="mt-6 text-lg text-text-primary">{event.summary}</p>

    {!isPast && (
      <section class="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <EventRegistrationIsland
          client:only="react"
          eventId={event.id}
          source={event.source}
          sourceId={event.sourceId}
          externalHref={event.href}
          ctaLabel={event.ctaLabel}
        />
      </section>
    )}

    {event.description && (
      <section class="prose mt-10 max-w-none text-text-primary">
        <h2>Sobre o evento</h2>
        <p style="white-space: pre-line">{event.description}</p>
      </section>
    )}
  </article>
</PublicLayout>
```

> O campo `description` pode conter Markdown em alguns eventos do snapshot — na POC renderiza como texto (`pre-line`); renderização Markdown entra na 0.3.

- [ ] **Step 4: Criar `EventRegistrationIsland.tsx`**

Escopo POC: eventos **internos** (`source === "internal"`) com ticket types + inscrição gratuita + checkout pago por **redirect**; eventos **externos** mostram CTA para o link oficial (`externalHref`). Embedded Stripe fica para a 0.4 (ver Global Constraints).

`frontend/src/components/islands/EventRegistrationIsland.tsx`:

```tsx
import { useEffect, useState } from "react";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import { API_URL } from "../../lib/config";
import { Alert, Button, MenuItem, Select, Stack, Typography } from "@mui/material";

interface TicketType {
  id: string;
  name: string;
  kind: "free" | "paid" | "community" | "company";
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  salesStartAt?: string;
  salesEndAt?: string;
  maxPerOrder?: number;
}

interface Props {
  eventId: string;
  source: string;
  sourceId: string;
  externalHref: string;
  ctaLabel: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function RegistrationInner({ eventId, source, externalHref, ctaLabel }: Props) {
  const { isLoggedIn, ready, login, authFetch } = useAuth();
  const [ticketTypes, setTicketTypes] = useState<TicketType[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Retorno do Stripe (?status=success&session_id=...) — POC mostra inline;
  // na 0.4 redireciona para /membro?purchase=success.
  const [paymentSuccess] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("status") === "success" && q.has("session_id");
  });

  const isInternal = source === "internal";

  useEffect(() => {
    if (!isInternal) return;
    fetch(`${API_URL}/events/public/managed/${eventId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTicketTypes(data?.ticketTypes ?? []))
      .catch(() => setTicketTypes([]));
  }, [eventId, isInternal]);

  if (paymentSuccess) {
    return <Alert severity="success">Inscrição confirmada! 🎉 Você receberá os detalhes por e-mail.</Alert>;
  }

  if (!isInternal) {
    return (
      <Button
        variant="contained"
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {ctaLabel}
      </Button>
    );
  }

  if (!ready || ticketTypes === null) {
    return <span className="inline-block h-10 w-48 animate-pulse rounded-md bg-sunken" />;
  }

  if (ticketTypes.length === 0) {
    return <Typography color="text.secondary">Inscrições em breve.</Typography>;
  }

  if (!isLoggedIn) {
    return (
      <Stack spacing={1}>
        <Typography color="text.secondary">Entre com sua conta para se inscrever.</Typography>
        <Button variant="contained" onClick={() => login()} sx={{ alignSelf: "flex-start" }}>
          Entrar com GitHub
        </Button>
      </Stack>
    );
  }

  if (done) {
    return <Alert severity="success">Inscrição realizada! 🎉</Alert>;
  }

  const ticket = ticketTypes.find((t) => t.id === selected);

  const submit = async () => {
    if (!ticket) return;
    setLoading(true);
    setError(null);
    try {
      if (ticket.kind === "free") {
        const res = await authFetch(`/events/${eventId}/register`, {
          method: "POST",
          body: JSON.stringify({ ticketTypeId: ticket.id }),
        });
        if (res.status === 409) throw new Error("Você já está inscrito ou o lote esgotou.");
        if (!res.ok) throw new Error("Falha ao inscrever. Tente novamente.");
        setDone(true);
      } else {
        const res = await authFetch(`/events/${eventId}/checkout`, {
          method: "POST",
          body: JSON.stringify({ ticketTypeId: ticket.id, quantity: 1, acceptTerms: true }),
        });
        if (res.status === 409) throw new Error("Você já possui ingresso para este evento.");
        if (!res.ok) throw new Error("Falha ao iniciar o pagamento. Tente novamente.");
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("Checkout indisponível no momento.");
        window.location.href = data.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography fontWeight={700}>Inscrição</Typography>
      <Select
        value={selected}
        displayEmpty
        onChange={(e) => setSelected(e.target.value)}
        sx={{ maxWidth: 360 }}
        inputProps={{ "aria-label": "Tipo de ingresso" }}
      >
        <MenuItem value="" disabled>Selecione o ingresso</MenuItem>
        {ticketTypes.map((t) => (
          <MenuItem key={t.id} value={t.id} disabled={t.quantitySold >= t.quantityTotal}>
            {t.name} — {t.kind === "free" ? "Grátis" : formatBRL(t.priceCents)}
            {t.quantitySold >= t.quantityTotal ? " (esgotado)" : ""}
          </MenuItem>
        ))}
      </Select>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        variant="contained"
        disabled={!ticket || loading}
        onClick={submit}
        sx={{ alignSelf: "flex-start" }}
      >
        {loading ? "Processando…" : ticket?.kind === "free" ? "Confirmar inscrição" : "Ir para pagamento"}
      </Button>
    </Stack>
  );
}

export default function EventRegistrationIsland(props: Props) {
  return (
    <MuiIslandProvider>
      <RegistrationInner {...props} />
    </MuiIslandProvider>
  );
}
```

- [ ] **Step 5: Build + check + test + smoke das rotas geradas**

```bash
cd frontend && npm run build && npm run check && npm run test
ls dist/eventos/ | head
```

Expected: `dist/eventos/` contém os slugs internos e as pastas `<source>/<sourceId>/<id>`; build verde.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat(fase-0.1): rotas estáticas de eventos + ilha de inscrição (Task 7)"
```

---

### Task 8: `/auth/callback` (handoff do OAuth)

Sem esta página o login não fecha o ciclo: o backend redireciona para `/auth/callback?status=success#token=<JWT>` e quem troca o token pelo cookie httpOnly é o frontend via `POST /auth/finalize`.

**Files:**
- Create: `frontend/src/pages/auth/callback.astro`
- Create: `frontend/src/components/islands/AuthCallback.tsx`

**Interfaces:**
- Consumes: `API_URL`, `fetchMe` (Task 4), `BaseLayout` (Task 2).
- Backend: `POST ${API_URL}/auth/finalize` com body `{ token }` + `credentials: "include"` → seta o cookie de sessão.

- [ ] **Step 1: Criar a ilha `AuthCallback.tsx`**

`frontend/src/components/islands/AuthCallback.tsx`:

```tsx
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/config";
import { fetchMe } from "../../lib/auth-client";

const RETURN_KEY = "codaqui_auth_return";
const DEFAULT_RETURN = "/"; // /membro só nasce na 0.4 — na POC volta para a home

type Status = "processing" | "error";

/** Valida que o destino é um path relativo (anti open-redirect). */
function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN;
  }
  return value;
}

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("processing");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("status") === "error") {
        setStatus("error");
        return;
      }

      if (params.get("status") === "success") {
        // Handoff efêmero: JWT no fragment, trocado pelo cookie httpOnly.
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get("token");
        window.history.replaceState(null, "", window.location.pathname);
        if (!token) {
          setStatus("error");
          return;
        }
        const res = await fetch(`${API_URL}/auth/finalize`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          setStatus("error");
          return;
        }
      }

      const me = await fetchMe(API_URL);
      if (!me) {
        setStatus("error");
        return;
      }
      window.location.replace(safeReturnPath(sessionStorage.getItem(RETURN_KEY)));
    };
    run();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      {status === "processing" ? (
        <p className="text-text-secondary">Finalizando seu login…</p>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold text-text-primary">Não foi possível entrar</h1>
          <p className="mt-2 text-text-secondary">
            Ocorreu um problema na autenticação. Tente novamente.
          </p>
          <a href="/" className="mt-4 inline-block font-bold text-link hover:text-link-hover">
            Voltar para o início
          </a>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Criar `callback.astro`**

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import AuthCallback from "../../components/islands/AuthCallback";
---

<BaseLayout title="Entrando… — Codaqui">
  <AuthCallback client:only="react" />
</BaseLayout>
```

- [ ] **Step 3: Build + check**

```bash
cd frontend && npm run build && npm run check
```

Expected: verde. Smoke manual (com backend rodando em `:3001`): fluxo de login completo em `http://localhost:4321` → Entrar com GitHub → volta logado.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat(fase-0.1): página /auth/callback com handoff do OAuth (Task 8)"
```

---

### Task 9: `/admin/eventos` (app-shell + listagem unificada read-only)

Escopo POC: guarda de auth/role + tabela unificada (internos via API + externos via snapshot), read-only. CRUD, ticket types, staff e force-sync ficam para a 0.4 (ver Global Constraints).

**Files:**
- Create: `frontend/src/pages/admin/eventos.astro`
- Create: `frontend/src/components/islands/AdminEventsApp.tsx`

**Interfaces:**
- Consumes: `AppLayout` (Task 5), `useAuth` (Task 4), `EventSummary` (Task 3).
- Backend: `GET ${API_URL}/events` → `{ events: ManagedEvent[], total, page, limit }` (paginado) — roles `admin`/`event_organizer`/`event_finance`.
- `ManagedEvent` (subconjunto usado): `{ id, slug?, title, startAt, status, location }`.

- [ ] **Step 1: Criar `AdminEventsApp.tsx`**

`frontend/src/components/islands/AdminEventsApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import { API_URL } from "../../lib/config";
import type { EventSummary } from "../../lib/events";
import {
  Alert,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

interface ManagedEvent {
  id: string;
  slug?: string;
  title: string;
  startAt: string;
  status: string;
  location?: string;
}

interface Row {
  key: string;
  title: string;
  startAt: string;
  status: string;
  kind: "interno" | "externo";
}

function AdminEventsInner() {
  const { ready, isLoggedIn, isAdmin, isEventOrganizer, authFetch } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canAccess = isAdmin || isEventOrganizer;

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    if (!canAccess) return;

    const load = async () => {
      try {
        const res = await authFetch("/events?page=1&limit=50");
        if (!res.ok) throw new Error(`Falha ao carregar eventos (${res.status}).`);
        const data = (await res.json()) as
          | { events: ManagedEvent[] }
          | ManagedEvent[];
        const managed = Array.isArray(data) ? data : data.events;
        const internalRows: Row[] = managed.map((e) => ({
          key: `internal:${e.id}`,
          title: e.title,
          startAt: e.startAt,
          status: e.status,
          kind: "interno",
        }));

        const indexRes = await fetch("/events/index.json");
        const index = indexRes.ok
          ? ((await indexRes.json()) as { events: EventSummary[] })
          : { events: [] };
        const externalRows: Row[] = index.events
          .filter((e) => e.source !== "internal")
          .map((e) => ({
            key: `${e.sourceKey}:${e.id}`,
            title: e.title,
            startAt: e.startAt,
            status: e.status ?? "scheduled",
            kind: "externo" as const,
          }));

        setRows(
          [...internalRows, ...externalRows].sort((a, b) =>
            a.startAt.localeCompare(b.startAt),
          ),
        );
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    };
    load();
  }, [ready, isLoggedIn, canAccess, authFetch]);

  if (!ready || !isLoggedIn) {
    return <span className="inline-block h-10 w-64 animate-pulse rounded-md bg-sunken" />;
  }

  if (!canAccess) {
    return (
      <Alert severity="warning">
        Acesso restrito a administradores e organizadores de eventos.
      </Alert>
    );
  }

  return (
    <>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>
      )}
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Eventos
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Visão read-only da POC 0.1 — gestão completa chega na Fase 0.4.
      </Typography>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" aria-label="Lista unificada de eventos">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Origem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rows ?? []).map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.title}</TableCell>
                <TableCell>
                  {new Date(row.startAt).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.kind}
                    color={row.kind === "interno" ? "primary" : "default"}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows !== null && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>Nenhum evento encontrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default function AdminEventsApp() {
  return (
    <MuiIslandProvider>
      <AdminEventsInner />
    </MuiIslandProvider>
  );
}
```

- [ ] **Step 2: Criar `admin/eventos.astro` + garantir que o snapshot é servido em dev**

O island faz `fetch("/events/index.json")` same-origin. Em dev/preview do Astro, `frontend/public/` é servido na raiz — então o snapshot precisa estar acessível. Copiar (e documentar como passo temporário até a 0.3 definir o pipeline definitivo):

```bash
mkdir -p frontend/public/events
cp static/events/index.json frontend/public/events/index.json
```

> ⚠️ Não commitar `frontend/public/events/index.json` como cópia permanente: adicionar `frontend/public/events/` ao `.gitignore` e criar um script `frontend/package.json` `"sync:snapshots": "node scripts/copy-snapshots.mjs"` que copia de `../static/events/`. O pipeline definitivo (consumo direto via fs em build / workflow) é decidido na 0.3. Na POC, o `dev` e o `build` rodam o `sync:snapshots` como `predev`/`prebuild`:

```json
"predev": "npm run sync:snapshots",
"prebuild": "npm run sync:snapshots",
"sync:snapshots": "node scripts/copy-snapshots.mjs"
```

`frontend/scripts/copy-snapshots.mjs`:

```js
import { cpSync, mkdirSync } from "node:fs";

// Copia os snapshots gerados pelos workflows do monorepo para public/ do Astro.
// POC 0.1: apenas o índice de eventos. 0.3+ generaliza (per-event JSONs, social-stats).
mkdirSync(new URL("../public/events", import.meta.url), { recursive: true });
cpSync(
  new URL("../../../static/events/index.json", import.meta.url),
  new URL("../public/events/index.json", import.meta.url),
);
console.log("snapshots copiados: events/index.json");
```

`frontend/src/pages/admin/eventos.astro`:

```astro
---
import AppLayout from "../../layouts/AppLayout.astro";
import AdminEventsApp from "../../components/islands/AdminEventsApp";
---

<AppLayout title="Eventos">
  <AdminEventsApp client:only="react" />
</AppLayout>
```

`.gitignore` — adicionar ao bloco Astro:

```gitignore
frontend/public/events/
```

- [ ] **Step 3: Build + check + smoke**

```bash
cd frontend && npm run build && npm run check && ls dist/events/index.json
```

Expected: verde; snapshot presente no build. Smoke manual com backend em `:3001`: `/admin/eventos` redireciona deslogado para `/`; logado com role lista eventos.

- [ ] **Step 4: Commit**

```bash
git add frontend/ .gitignore
git commit -m "feat(fase-0.1): /admin/eventos read-only com app-shell e guarda de roles (Task 9)"
```

---

### Task 10: Documentação (DEVELOPMENT.md, AGENTS.md, scripts raiz)

**Files:**
- Modify: `DEVELOPMENT.md` (nova seção após `## Frontend (Docusaurus)`, antes de `## Backend (NestJS)`)
- Modify: `AGENTS.md` (correção da tabela de tokens MUI + nota sobre `frontend/`)
- Modify: `package.json` (raiz — scripts de conveniência)

- [ ] **Step 1: DEVELOPMENT.md — nova seção**

Inserir após a seção `## Frontend (Docusaurus)` (antes de `## Backend (NestJS)`):

```markdown
## Frontend (Astro) — Fase 0 em transição

> O site oficial continua sendo o Docusaurus da raiz até o cutover (Fase 0.6). O app Astro em `frontend/` é o futuro stack — ver [docs/plans/codaqui-1-0/refatoracao-frontend-astro.md](docs/plans/codaqui-1-0/refatoracao-frontend-astro.md) e [docs/plans/codaqui-1-0/design-system.md](docs/plans/codaqui-1-0/design-system.md).

### Setup

```bash
cd frontend
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev            # http://localhost:4321
```

O CORS do backend já aceita qualquer `localhost:<porta>` — nenhuma configuração extra. Login GitHub funciona ponta a ponta com o backend local rodando (`compose.yaml`, porta 3001).

### Comandos

```bash
npm run dev        # dev server (:4321) — copia snapshots antes (predev)
npm run build      # build estático em dist/ — copia snapshots antes (prebuild)
npm run preview    # serve o build localmente
npm run check      # astro check (tipos de .astro)
npm run test       # vitest (libs e contratos)
```

### Convenções do app Astro

- Tokens do Design System (`--cq-*`) em `src/styles/tokens.css` são a fonte única — Tailwind (`@theme inline` em `global.css`) e MUI (`src/lib/mui-theme.ts`) consomem deles. Nunca hardcode de hex.
- Cor de marca `#57B593` é só decoração; cor acionável é `#378369` (claro) / `#89CBB3` (escuro).
- Ilhas React: `client:load` (vivo no primeiro paint), `client:visible` (abaixo da dobra), `client:only="react"` (páginas app com auth). O padrão é zero JS.
- Autenticação: `src/lib/auth-client.ts` (puro) + `src/lib/use-auth.ts` (hook) — mesmo contrato de cookie httpOnly do Docusaurus.
```

- [ ] **Step 2: AGENTS.md — correção de paleta + nota do Astro**

Na seção "MUI Theme & Component patterns", corrigir a tabela para os valores reais do código atual (`src/theme/muiTheme.ts`):

```markdown
| Token | Value |
|-------|-------|
| `primary.main` | `#57B593` (Codaqui green — cor de marca) |
| `primary.dark` | `#4AA07A` |
| `primary.light` | `#6DC4A5` |
| `secondary.main` | `#87D2B7` (verde claro) |
| `background.default` (dark) | `#2A2130` |
| `background.paper` (dark) | `#3A2F39` |
| `shape.borderRadius` | `8` |
| `typography.fontFamily` | `var(--ifm-font-family-base, ...)` — inherits from Docusaurus |

> ⚠️ **Fase 0 em andamento:** o app Astro em `frontend/` já usa os tokens do Design System Codaqui (cor acionável `#378369` no claro) — ver `docs/plans/codaqui-1-0/design-system.md`. A tabela acima descreve o Docusaurus (site oficial até a 0.6).
```

E na seção "Directory Structure", adicionar ao bloco da árvore, após `backend/`:

```
├── frontend/                    # 🚀 App Astro 5 (Fase 0 — futuro stack; POC 0.1)
```

- [ ] **Step 3: `package.json` raiz — scripts de conveniência**

Adicionar em `scripts`:

```json
"astro:dev": "npm --prefix frontend run dev",
"astro:build": "npm --prefix frontend run build",
"astro:check": "npm --prefix frontend run check",
"astro:test": "npm --prefix frontend run test"
```

- [ ] **Step 4: Commit**

```bash
git add DEVELOPMENT.md AGENTS.md package.json
git commit -m "docs(fase-0.1): DEVELOPMENT.md com seção Astro + correção de paleta no AGENTS.md (Task 10)"
```

---

### Task 11: Verificação final dos critérios da 0.1

Critérios da spec: `build` + `typecheck` verdes; preview no Pages; Lighthouse mobile das 3 páginas melhor que o equivalente Docusaurus (registrar números no PR); contraste AA verificado; AGENTS.md corrigido.

- [ ] **Step 1: Gates automatizados**

```bash
cd frontend && npm run build && npm run check && npm run test
cd .. && npm run typecheck && npm run build   # Docusaurus intacto
```

Expected: tudo verde.

- [ ] **Step 2: Lighthouse local nas 3 páginas**

```bash
cd frontend && npm run preview &   # http://localhost:4321
npx lighthouse http://localhost:4321/ --preset=mobile --output=json --output-path=./lighthouse-home.json --chrome-flags="--headless"
npx lighthouse "http://localhost:4321/eventos/<slug-de-um-evento-interno>" --preset=mobile --output=json --output-path=./lighthouse-evento.json --chrome-flags="--headless"
npx lighthouse http://localhost:4321/admin/eventos --preset=mobile --output=json --output-path=./lighthouse-admin.json --chrome-flags="--headless"
```

Comparar com o Docusaurus (`npm run build && npm run serve` na raiz, mesmas URLs em `:3000`). Registrar os 4 números (Performance/A11y/Best Practices/SEO) de cada página no corpo do PR. A meta da spec é "melhor que o equivalente Docusaurus" — se alguma página ficar pior, investigar antes de mergear (não contornar).

- [ ] **Step 3: Smoke manual com backend local** (checklist no PR)

- [ ] Login GitHub ponta a ponta em `:4321` (entrar → volta logado → sair).
- [ ] `/` renderiza com as 5 seções e o contador de apoiadores.
- [ ] `/eventos/<slug>` de um evento interno mostra a ilha de inscrição; externo mostra CTA para o link oficial.
- [ ] `/admin/eventos`: deslogado → `/`; membro sem role → aviso; admin → tabela unificada.
- [ ] Toggle de tema persiste (recarregar mantém) e sem flash (FOUC).
- [ ] `dist/eventos/` contém todas as rotas do snapshot.

- [ ] **Step 4: Preview no Cloudflare Pages** (passo manual do mantenedor — requer `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`)

```bash
cd frontend && npx wrangler pages deploy dist --project-name=codaqui
```

Registrar a URL `<hash>.codaqui.pages.dev` no PR. (A matrix de tenants e o domínio próprio são fases 0.5/0.6.)

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(fase-0.1): verificação final — gates verdes, lighthouse registrado (Task 11)"
```

---

## Self-Review (concluído em 2026-10-20)

- **Spec coverage (0.1 da spec):** app Astro ✅ (Task 1), BaseLayout + PublicLayout ✅ (2, 5), MUI + Tailwind + tema DS ✅ (2), auth-client ✅ (4), 3 páginas representativas ✅ (6, 7, 9), `/auth/callback` necessário para o login ✅ (8), build/check/test ✅ (11), Lighthouse ✅ (11), preview Pages ✅ (11, manual), tokens DS + AGENTS.md ✅ (2, 10), contraste AA ✅ (testes da Task 2). AppLayout: spec lista na 0.4, mas `/admin/eventos` da POC precisa de um shell — incluído mínimo na Task 5.
- **Placeholders:** nenhum passo sem código/comando; os dois pontos marcados com "verificar shape real durante a execução" (`/members/donors`, tipos de `src/data/events.ts`) são instruções de reconciliação com a fonte de verdade, não TODOs.
- **Type consistency:** `AuthUser`, `EventSummary`, `createCodaquiTheme`, `API_URL`, `useAuth` retornam os mesmos nomes em todas as tasks; props da ilha de inscrição (`eventId/source/sourceId/externalHref/ctaLabel`) batem entre Task 7 página e componente.
