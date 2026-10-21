# Fase 0.2 — Conteúdo (Blog + Trilhas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrar blog (26 posts) e trilhas (27 páginas) para content collections do Astro com paridade 100% de URLs, Giscus funcionando e temas claro/escuro.

**Architecture:** Content layer do Astro (`src/content.config.ts`, glob loader) alimentado por cópia build-time das fontes canônicas `blog/` e `trilhas/` (que seguem servindo o Docusaurus até a 0.6). Assets relativos (`./img/`, `./assets/`) viram arquivos estáticos em `public/` com rewrite via remark plugin. Layouts `.astro` puros (zero JS) + ilha Giscus `client:visible`.

**Tech Stack:** Astro 7.4 (content layer), `@astrojs/mdx`, `@astrojs/rss`, `@giscus/react`, Vitest, Tailwind v4 (tokens `--cq-*`).

**Spec:** `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (seção "Fases de transição", linha 0.2) + inventário validado em 2026-10-21 (abaixo).

## Inventário validado (fonte de verdade deste plano)

- **Blog:** 26 posts em `blog/` (24 `.md` + 2 `.mdx`). **Todos** têm `slug: YYYY/MM/DD/nome` → URL `/blog/YYYY/MM/DD/nome`. Tags em `/blog/category/<slug>` (no build atual: `build/blog/category/<slug>.html`, slug lowercase sem acento — ex.: `historia.html`, `c-4-p.html`, `ipv-4.html`, `truncamentodedados.html`). Listagem `/blog` com 9 posts/página (`/blog/page/N`). Sidebar "Posts recentes" (10). Feeds: `/blog/rss.xml`, `/blog/atom.xml`, `/blog/feed.json`. Reading time exibido ("N min de leitura").
- **Authors:** `blog/authors.yml` com 9 autores-chave; posts usam chave (`authors: [endersonmenezes]`) **ou** inline (`authors: [{name, title, url, image_url}]`).
- **Imagens do blog:** 10 pastas em `blog/img/` (nomes inconsistentes: underscores e hífens), referenciadas como `./img/<pasta>/<arq>` ou `img/<pasta>/<arq>`; 3 posts com `image:` no frontmatter (caminho relativo).
- **2 posts MDX com MUI:** `blog/2026-03-26-aumigo-prestacao-de-contas.mdx` e `blog/2026-07-17-cloud-native-maringa-3-agile-brazil-c4p.mdx` importam Grid/Card/Typography/Stack/Button/ícones de `@mui/material` e `@mui/icons-material`.
- **Trilhas:** `trilhas/index.md` (slug custom `intro` → `/trilhas/intro`), `trilhas/python/` (index + page-1..16), `trilhas/github/` (index + page-1..8 + `assets/` com 2 PNG + 2 WEBM). Frontmatter mínimo: só `sidebar_position`. Título vem do H1 do corpo. `<video src="./assets/x.webm" controls>` HTML inline na trilha github. URLs: `/trilhas/intro`, `/trilhas/python/`, `/trilhas/python/page-N`, idem github.
- **Sidebar manual** em `sidebars.ts` (labels completos — portados verbatim na Task 8).
- **Giscus** (`docusaurus.config.ts` themeConfig.giscus): repo `codaqui/institucional`, repoId `R_kgDOG9s0Ng`, category `Blog`, categoryId `DIC_kwDOG9s0Ns4CRk25`, mapping `og:title`, strict `0`, reactionsEnabled `1`, emitMetadata `1`, inputPosition `bottom`, theme `preferred_color_scheme`, lang `pt`. ⚠️ mapping `og:title` exige que o `<meta property="og:title">` dos posts no Astro seja **idêntico** ao atual (título puro do post, sem sufixo do site), senão as threads de discussão se perdem.
- **POC existente:** `frontend/` com `BaseLayout`/`PublicLayout`/`AppLayout`, tokens `--cq-*`, ilhas MUI, `astro.config.mjs` com `site` + react + tailwind. **Não há** `@astrojs/mdx`, `@astrojs/rss`, content collections, nem giscus nas deps.

## Global Constraints

- Trabalho na branch `develop`, direto na raiz do repo (sem worktree).
- **Não modificar** `blog/`, `trilhas/`, `sidebars.ts` nem nada do Docusaurus — as fontes canônicas seguem servindo o site atual até a Fase 0.6. O Astro consome **cópias** geradas em build-time (`frontend/scripts/copy-content.mjs`).
- Commits em pt-BR, conventional commits, um commit por task (ou mais, se a task pedir).
- Zero JS por padrão nas páginas de conteúdo; única ilha: Giscus com `client:visible`.
- Nunca hardcode de hex — tokens `--cq-*` / classes Tailwind do tema (`text-text-primary`, `bg-surface`, `text-link`, etc.).
- Node ≥ 24; comandos rodam de `frontend/` salvo indicação contrária.
- TDD nas libs (`frontend/src/lib/`): teste falhando → implementação → verde → commit.
- Todo `<img>` com `alt`; hierarquia de headings sem pular níveis.
- Linguagem inclusiva: "participantes", "programa", "Associação".
- Paridade de URLs é o gate: `node scripts/diff-urls.mjs` (Task 11) deve sair com **0 URLs faltando** para `/blog` e `/trilhas`.

---

## Task 1: Pipeline de conteúdo (copy-content.mjs) + dados de autores

**Files:**
- Create: `frontend/scripts/copy-content.mjs`
- Create: `frontend/src/data/blog-authors.ts`
- Modify: `frontend/package.json` (scripts `predev`/`prebuild` encadeiam o novo script)

**Interfaces:**
- Produces: `frontend/src/content/blog/**` (só `.md`/`.mdx`), `frontend/src/content/trilhas/**` (só `.md`), `frontend/public/blog-assets/img/**`, `frontend/public/trilhas-assets/<trilha>/assets/**`, e o módulo `BLOG_AUTHORS: Record<string, BlogAuthor>`.

- [x] **Step 1: Escrever `frontend/src/data/blog-authors.ts`** (port verbatim de `blog/authors.yml`)

```ts
export interface BlogAuthor {
  name: string;
  title?: string;
  url?: string;
  image_url?: string;
}

// Portado de blog/authors.yml (fonte canônica segue no Docusaurus até a Fase 0.6).
// Manter em sync manualmente quando authors.yml mudar — documentado no DEVELOPMENT.md.
export const BLOG_AUTHORS: Record<string, BlogAuthor> = {
  endersonmenezes: { name: "Enderson Menezes", title: "Founder", url: "https://github.com/endersonmenezes", image_url: "https://avatars.githubusercontent.com/u/11020807?v=4" },
  thaifurforo: { name: "Thainara Furforo", title: "Volunteer", url: "https://github.com/thaifurforo", image_url: "https://avatars.githubusercontent.com/u/92865769?v=4" },
  anaelisalace: { name: "Ana Elisa", title: "Volunteer", url: "https://github.com/anaelisalace", image_url: "https://avatars.githubusercontent.com/u/92278335?v=4" },
  artumosgoc: { name: "Elias Miranda", title: "Student", url: "https://github.com/artumosgoc", image_url: "https://avatars.githubusercontent.com/u/63540372" },
  amandatambara: { name: "Amanda Tambara", title: "Volunteer", url: "https://amandatambara.com", image_url: "https://amandatambara.com/wp-content/uploads/2023/04/cropped-cropped-foto-amanda-tambara-22.png" },
  anacarolyne: { name: "Ana Carolyne", title: "Volunteer", url: "https://github.com/anacarolyne", image_url: "https://avatars.githubusercontent.com/u/111382055?v=4" },
  renanceratto: { name: "Renan Ceratto", title: "Volunteer", url: "https://github.com/renanceratto", image_url: "https://github.com/renanceratto.png" },
  cumbuca: { name: "Cumbuca.dev", title: "Community", url: "https://cumbuca.dev", image_url: "https://avatars.githubusercontent.com/u/146448842?v=4" },
  antoniamaia: { name: "antoniamaia", title: "Community", url: "https://cumbuca.dev", image_url: "https://avatars.githubusercontent.com/u/109252406?v=4" },
};
```

- [x] **Step 2: Escrever `frontend/scripts/copy-content.mjs`**

```js
// Copia as fontes canônicas de conteúdo (blog/ e trilhas/ na raiz, usadas pelo
// Docusaurus até a Fase 0.6) para dentro do app Astro, separando corpo (content
// collections) de assets (public/). Roda em predev/prebuild, idempotente.
import { cpSync, rmSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const FRONTEND = join(ROOT, "frontend");

const onlyMarkdown = (src) => {
  if (src.includes(`${sep}img${sep}`) || src.includes(`${sep}assets${sep}`)) return false;
  if (src.endsWith("authors.yml")) return false;
  return true; // diretórios e demais arquivos passam; .md/.mdx são filtrados pelo glob loader
};

const copies = [
  { from: join(ROOT, "blog"), to: join(FRONTEND, "src", "content", "blog"), filter: onlyMarkdown },
  { from: join(ROOT, "trilhas"), to: join(FRONTEND, "src", "content", "trilhas"), filter: onlyMarkdown },
  { from: join(ROOT, "blog", "img"), to: join(FRONTEND, "public", "blog-assets", "img") },
  { from: join(ROOT, "trilhas", "github", "assets"), to: join(FRONTEND, "public", "trilhas-assets", "github", "assets") },
];

for (const { from, to, filter } of copies) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, ...(filter ? { filter } : {}) });
}
console.log(`copy-content: ${copies.length} origens copiadas`);
```

- [x] **Step 3: Encadear no `frontend/package.json`**

Localizar a linha existente de sync de snapshots (`"predev"`/`"prebuild"` que chamam `node scripts/copy-snapshots.mjs`) e alterar para:

```json
"sync:content": "node scripts/copy-snapshots.mjs && node scripts/copy-content.mjs",
"predev": "npm run sync:content",
"prebuild": "npm run sync:content",
```

(Se os nomes atuais diferirem, preservar o que existe e apenas adicionar `&& node scripts/copy-content.mjs` ao hook já encadeado.)

- [x] **Step 4: Verificar**

Run: `cd frontend && node scripts/copy-content.mjs && ls src/content/blog | head -3 && ls src/content/trilhas && ls public/blog-assets/img && ls public/trilhas-assets/github/assets`
Expected: 26 arquivos `.md/.mdx` em `src/content/blog` (sem pasta `img`, sem `authors.yml`); `index.md`, `python/`, `github/` em `src/content/trilhas` (github **sem** `assets/`); 10 pastas em `public/blog-assets/img`; 4 arquivos (2 PNG + 2 WEBM) em `public/trilhas-assets/github/assets`. Rodar 2× → mesmo resultado (idempotente).

- [x] **Step 5: `.gitignore`**

Adicionar a `frontend/.gitignore` (conteúdo é gerado, não se versiona):

```
src/content/blog/
src/content/trilhas/
public/blog-assets/
public/trilhas-assets/
```

- [x] **Step 6: Commit**

```bash
git add frontend/scripts/copy-content.mjs frontend/src/data/blog-authors.ts frontend/package.json frontend/.gitignore
git commit -m "feat(fase-0.2): pipeline copy-content (blog/trilhas → collections + assets) e autores portados"
```

---

## Task 2: Content collections (blog + trilhas) e MDX

**Files:**
- Create: `frontend/src/content.config.ts`
- Modify: `frontend/astro.config.mjs`
- Modify: `frontend/package.json` (deps)

**Interfaces:**
- Produces: collections `blog` (data: `{ slug, title, date?, authors, tags, image?, enableComments? }`, id = nome do arquivo sem extensão, ex.: `2024-07-22-devparana-e-codaqui-unidos-pela-comunidade`) e `trilhas` (data: `{ sidebar_position, title?, slug? }`, id = caminho relativo sem extensão, ex.: `python/page-3`).

- [x] **Step 1: Instalar deps**

Run: `cd frontend && npm install @astrojs/mdx && npm install -D unist-util-visit`

- [x] **Step 2: Escrever `frontend/src/content.config.ts`**

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const inlineAuthor = z.object({
  name: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  image_url: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    // Ausente em alguns posts: o Docusaurus infere pela data do nome do arquivo.
    // `postDate()` em src/lib/blog-utils.ts faz o mesmo fallback.
    date: z.coerce.date().optional(),
    authors: z.array(z.union([z.string(), inlineAuthor])).default([]),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    enableComments: z.boolean().optional(),
  }),
});

const trilhas = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/trilhas" }),
  schema: z.object({
    sidebar_position: z.number(),
    title: z.string().optional(),
    slug: z.string().optional(),
  }),
});

export const collections = { blog, trilhas };
```

- [x] **Step 3: Registrar MDX em `frontend/astro.config.mjs`**

Alterar o array `integrations` existente:

```js
import mdx from "@astrojs/mdx";
// ...
integrations: [react(), mdx()],
```

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build`
Expected: build verde; nenhuma rota nova ainda (collections sem páginas não geram rotas). Se quebrar nos 2 `.mdx` (MUI/Emotion no SSR), **não** investigar a fundo aqui — a Task 7 trata; anotar o erro e seguir.

- [x] **Step 5: Commit**

```bash
git add frontend/src/content.config.ts frontend/astro.config.mjs frontend/package.json frontend/package-lock.json
git commit -m "feat(fase-0.2): content collections blog/trilhas + integração MDX"
```

---

## Task 3: `src/lib/blog-utils.ts` (TDD)

**Files:**
- Create: `frontend/src/lib/blog-utils.ts`
- Test: `frontend/src/lib/blog-utils.test.ts`

**Interfaces:**
- Consumes: `BLOG_AUTHORS`, `BlogAuthor` de `../data/blog-authors`.
- Produces (assinaturas usadas pelas Tasks 6, 7, 9, 10):
  - `postUrl(post: { data: { slug: string } }): string` → `/blog/<slug>`
  - `postDate(post: { id: string; data: { date?: Date } }): Date` — frontmatter `date` ou prefixo `YYYY-MM-DD` do id (meio-dia `-03:00` para estabilidade de fuso)
  - `resolveAuthors(authors: (string | BlogAuthor)[]): BlogAuthor[]`
  - `readingTimeMinutes(body: string): number` — `Math.max(1, Math.ceil(plainText.split(/\s+/).length / 300))`
  - `plainExcerpt(body: string, maxLen = 160): string` — corta em `<!-- truncate -->` se houver; senão primeiros `maxLen` chars do texto plano, terminando em palavra inteira + `…`
  - `contentAssetUrl(raw: string): string` — `./img/x.png`/`img/x.png` → `/blog-assets/img/x.png`; `./assets/x.png` → `/trilhas-assets/github/assets/x.png` (única trilha com assets hoje)
  - `sortPostsDesc<T>(posts: T[]): T[]` com `T extends { id: string; data: { date?: Date } }` — por `postDate` desc

- [x] **Step 1: Escrever o teste falhando** (`frontend/src/lib/blog-utils.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { postUrl, postDate, resolveAuthors, readingTimeMinutes, plainExcerpt, contentAssetUrl, sortPostsDesc } from "./blog-utils";

describe("postUrl", () => {
  it("monta URL a partir do slug legado", () => {
    expect(postUrl({ data: { slug: "2024/07/22/meu-post" } })).toBe("/blog/2024/07/22/meu-post");
  });
});

describe("postDate", () => {
  it("usa a data do frontmatter quando presente", () => {
    const d = new Date("2026-03-30T00:00:00Z");
    expect(postDate({ id: "2020-01-01-x", data: { date: d } })).toBe(d);
  });
  it("cai na data do nome do arquivo quando ausente", () => {
    const d = postDate({ id: "2024-07-22-meu-post", data: {} });
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(22);
  });
  it("lança erro para id fora do padrão sem data", () => {
    expect(() => postDate({ id: "sem-data", data: {} })).toThrow(/sem data/i);
  });
});

describe("resolveAuthors", () => {
  it("resolve chave do authors.yml", () => {
    const [a] = resolveAuthors(["endersonmenezes"]);
    expect(a.name).toBe("Enderson Menezes");
    expect(a.url).toBe("https://github.com/endersonmenezes");
  });
  it("mantém autor inline", () => {
    const [a] = resolveAuthors([{ name: "Fulana", url: "https://x.dev" }]);
    expect(a.name).toBe("Fulana");
  });
  it("chave desconhecida vira autor só com nome", () => {
    expect(resolveAuthors(["desconhecido"])[0]).toEqual({ name: "desconhecido" });
  });
});

describe("readingTimeMinutes", () => {
  it("300 palavras por minuto, mínimo 1", () => {
    expect(readingTimeMinutes("")).toBe(1);
    expect(readingTimeMinutes(Array(300).fill("palavra").join(" "))).toBe(1);
    expect(readingTimeMinutes(Array(301).fill("palavra").join(" "))).toBe(2);
  });
});

describe("plainExcerpt", () => {
  it("corta no marcador truncate", () => {
    expect(plainExcerpt("Resumo aqui.\n\n<!-- truncate -->\n\nResto do post")).toBe("Resumo aqui.");
  });
  it("remove marcação markdown do texto", () => {
    expect(plainExcerpt("# Título\n\nTexto com **negrito** e [link](https://x.dev).", 200)).toBe(
      "Título Texto com negrito e link."
    );
  });
  it("trunca em palavra inteira com reticências", () => {
    const longo = Array(50).fill("palavra").join(" ");
    const out = plainExcerpt(longo, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });
});

describe("contentAssetUrl", () => {
  it("rewrites de blog", () => {
    expect(contentAssetUrl("./img/2022_10_14_hello_world/x.png")).toBe("/blog-assets/img/2022_10_14_hello_world/x.png");
    expect(contentAssetUrl("img/pasta/y.gif")).toBe("/blog-assets/img/pasta/y.gif");
  });
  it("rewrite de trilhas", () => {
    expect(contentAssetUrl("./assets/demo.webm")).toBe("/trilhas-assets/github/assets/demo.webm");
  });
});

describe("sortPostsDesc", () => {
  it("ordena por data efetiva desc", () => {
    const posts = [
      { id: "2022-01-01-a", data: {} },
      { id: "2024-01-01-b", data: {} },
      { id: "2023-01-01-c", data: {} },
    ];
    expect(sortPostsDesc(posts).map((p) => p.id)).toEqual(["2024-01-01-b", "2023-01-01-c", "2022-01-01-a"]);
  });
});
```

- [x] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/blog-utils.test.ts`
Expected: FAIL (módulo não existe).

- [x] **Step 3: Implementar `frontend/src/lib/blog-utils.ts`**

```ts
import { BLOG_AUTHORS, type BlogAuthor } from "../data/blog-authors";

interface PostLike {
  id: string;
  data: { slug?: string; date?: Date };
}

export function postUrl(post: { data: { slug: string } }): string {
  return `/blog/${post.data.slug}`;
}

export function postDate(post: { id: string; data: { date?: Date } }): Date {
  if (post.data.date) return post.data.date;
  const match = post.id.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Post sem data e id fora do padrão: ${post.id}`);
  return new Date(`${match[1]}T12:00:00-03:00`);
}

export function resolveAuthors(authors: (string | BlogAuthor)[]): BlogAuthor[] {
  return authors.map((a) => (typeof a === "string" ? (BLOG_AUTHORS[a] ?? { name: a }) : a));
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingTimeMinutes(body: string): number {
  const words = plainText(body).split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 300));
}

export function plainExcerpt(body: string, maxLen = 160): string {
  const beforeTruncate = body.split("<!-- truncate -->")[0];
  const text = plainText(beforeTruncate);
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
}

export function contentAssetUrl(raw: string): string {
  if (raw.startsWith("./assets/")) return raw.replace("./assets/", "/trilhas-assets/github/assets/");
  return raw.replace(/^\.?\/?img\//, "/blog-assets/img/");
}

export function sortPostsDesc<T extends PostLike>(posts: T[]): T[] {
  return [...posts].sort((a, b) => postDate(b).getTime() - postDate(a).getTime());
}
```

- [x] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/blog-utils.test.ts`
Expected: PASS (todos os describes).

- [x] **Step 5: Commit**

```bash
git add frontend/src/lib/blog-utils.ts frontend/src/lib/blog-utils.test.ts
git commit -m "feat(fase-0.2): blog-utils (url/data/autores/excerpt/reading-time) com testes"
```

---

## Task 4: `slugifyTag` — paridade com os slugs de categoria do Docusaurus (TDD data-driven)

**Files:**
- Create: `frontend/src/lib/slugify-tag.ts`
- Test: `frontend/src/lib/slugify-tag.test.ts`

**Contexto:** o build atual tem `/blog/category/<slug>.html` com slugs como `historia` (de "história"), `c-4-p`, `ipv-4`, `truncamentodedados`, `diversidade-e-inclusao`, `mulheres-na-tech`, `open-source`, `prestacao-de-contas`, `financiamento-coletivo`. O algoritmo exato do Docusaurus não é documentado o suficiente — ancoramos nos pares reais observados em `build/blog/category/`.

**Interfaces:**
- Produces: `slugifyTag(tag: string): string` — usada nas Tasks 6, 7, 9 (links de tag e rotas `/blog/category/[tag]`).

- [x] **Step 1: Listar os slugs reais do build atual**

Run: `ls build/blog/category/ | sed 's/\.html$//'` (na raiz do repo)
Guardar a saída — é o oráculo do teste.

- [x] **Step 2: Escrever o teste falhando** com os pares reais (tag do frontmatter → slug do build). Confirmar cada tag olhando os frontmatters em `blog/` (`grep -h "^tags:" blog/*.md blog/*.mdx`). Exemplo de estrutura (ajustar os pares ao que o grep mostrar de fato):

```ts
import { describe, expect, it } from "vitest";
import { slugifyTag } from "./slugify-tag";

// Pares observados: tag no frontmatter → slug em build/blog/category/<slug>.html
const PAIRS: [string, string][] = [
  ["história", "historia"],
  ["diversidade e inclusão", "diversidade-e-inclusao"],
  ["prestação de contas", "prestacao-de-contas"],
  ["financiamento coletivo", "financiamento-coletivo"],
  ["Open Source", "open-source"],
  ["mulheres na tech", "mulheres-na-tech"],
  ["DevParaná", "devparana"],
  ["Institucional", "institucional"],
  ["comunidade", "comunidade"],
  ["ipv-4", "ipv-4"],
];

describe("slugifyTag", () => {
  it.each(PAIRS)("%s → %s", (tag, slug) => {
    expect(slugifyTag(tag)).toBe(slug);
  });
});
```

- [x] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/slugify-tag.test.ts`
Expected: FAIL (módulo não existe).

- [x] **Step 4: Implementar `frontend/src/lib/slugify-tag.ts`**

```ts
export function slugifyTag(tag: string): string {
  return tag
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [x] **Step 5: Rodar o teste**

Run: `cd frontend && npx vitest run src/lib/slugify-tag.test.ts`
Expected: PASS nos 10 pares. **Se algum par falhar** (ex.: um slug com separação letra→dígito como `ipv-4` vindo de tag `ipv4`), ajustar a implementação adicionando `.replace(/([a-z])([0-9])/g, "$1-$2")` antes do replace geral e repetir até 10/10.

- [x] **Step 6: Commit**

```bash
git add frontend/src/lib/slugify-tag.ts frontend/src/lib/slugify-tag.test.ts
git commit -m "feat(fase-0.2): slugifyTag com paridade aos slugs de categoria do Docusaurus"
```

---

## Task 5: remark plugin de assets (`remark-content-assets.mjs`)

**Files:**
- Create: `frontend/scripts/remark-content-assets.mjs`
- Test: `frontend/scripts/remark-content-assets.test.mjs` (vitest roda `.mjs`? configurar include — ver Step 2)
- Modify: `frontend/astro.config.mjs` (registrar o plugin)

**Contexto:** o corpo dos posts referencia `./img/<pasta>/<arq>` (ou `img/...`), a trilha github usa `<video src="./assets/x.webm">` e `![...](./assets/x.png)`. Os assets foram copiados para `public/` na Task 1; este plugin reescreve as URLs relativas no mdast antes do render.

**Interfaces:**
- Produces: `remarkContentAssets()` — plugin remark registrado globalmente; regras: `./img/…`/`img/…` → `/blog-assets/img/…`; `./assets/…` → `/trilhas-assets/<trilha>/assets/…`, onde `<trilha>` vem do caminho do arquivo (`src/content/trilhas/<trilha>/…`).

- [x] **Step 1: Escrever o teste falhando** (`frontend/src/lib/remark-content-assets.test.ts` — colocar o plugin em `src/lib/` para o vitest pegar sem mexer em config; o `astro.config.mjs` importa de lá)

```ts
import { describe, expect, it } from "vitest";
import { remarkContentAssets } from "./remark-content-assets";

// mdast mínimo feito à mão — sem depender de parser nos testes
function run(tree: unknown, filePath: string) {
  const file = { path: filePath, history: [filePath] };
  remarkContentAssets()(tree as never, file as never);
  return tree;
}

describe("remarkContentAssets", () => {
  it("reescreve imagem de post do blog", () => {
    const tree = { type: "root", children: [{ type: "image", url: "./img/2022_10_14_hello_world/x.png" }] };
    run(tree, "/repo/frontend/src/content/blog/2022-10-14-hello-world.md");
    expect((tree as never as { children: { url: string }[] }).children[0].url).toBe(
      "/blog-assets/img/2022_10_14_hello_world/x.png"
    );
  });

  it("reescreve img/ sem ./ no blog", () => {
    const tree = { type: "root", children: [{ type: "image", url: "img/pasta/y.gif" }] };
    run(tree, "/repo/frontend/src/content/blog/post.md");
    expect((tree as never as { children: { url: string }[] }).children[0].url).toBe("/blog-assets/img/pasta/y.gif");
  });

  it("reescreve video html da trilha github", () => {
    const tree = {
      type: "root",
      children: [{ type: "html", value: '<video src="./assets/demo.webm" controls></video>' }],
    };
    run(tree, "/repo/frontend/src/content/trilhas/github/page-3.md");
    expect((tree as never as { children: { value: string }[] }).children[0].value).toBe(
      '<video src="/trilhas-assets/github/assets/demo.webm" controls></video>'
    );
  });

  it("não toca em URLs absolutas/externas", () => {
    const tree = {
      type: "root",
      children: [
        { type: "image", url: "https://github.com/user-attachments/x.png" },
        { type: "html", value: '<img src="/img/logo.png" alt="x" />' },
      ],
    };
    run(tree, "/repo/frontend/src/content/blog/post.md");
    expect(JSON.stringify(tree)).toContain("user-attachments");
    expect(JSON.stringify(tree)).toContain('src="/img/logo.png"');
  });
});
```

- [x] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/remark-content-assets.test.ts`
Expected: FAIL (módulo não existe).

- [x] **Step 3: Implementar `frontend/src/lib/remark-content-assets.ts`**

```ts
import { visit } from "unist-util-visit";
import type { Root, Image, Html } from "mdast";
import type { VFile } from "vfile";

function filePathOf(file: VFile): string {
  return file.path || file.history[0] || "";
}

export function remarkContentAssets() {
  return (tree: Root, file: VFile) => {
    const path = filePathOf(file).replace(/\\/g, "/");
    const trilha = path.match(/content\/trilhas\/([^/]+)\//)?.[1];
    const isBlog = path.includes("content/blog/");

    const rewrite = (url: string): string => {
      if (isBlog) return url.replace(/^\.?\/?img\//, "/blog-assets/img/");
      if (trilha) return url.replace(/^\.\/assets\//, `/trilhas-assets/${trilha}/assets/`);
      return url;
    };

    visit(tree, "image", (node: Image) => {
      node.url = rewrite(node.url);
    });
    visit(tree, "html", (node: Html) => {
      if (trilha) {
        node.value = node.value.replace(
          /(src=["'])\.\/assets\//g,
          `$1/trilhas-assets/${trilha}/assets/`
        );
      }
      if (isBlog) {
        node.value = node.value.replace(/(src=["'])\.?\/?img\//g, "$1/blog-assets/img/");
      }
    });
  };
}
```

Instalar tipos leves para o check: `npm install -D @types/mdast @types/unist unist-util-visit` (vfile já vem com astro; se o check reclamar, `npm install -D vfile`).

- [x] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/remark-content-assets.test.ts`
Expected: PASS 4/4.

- [x] **Step 5: Registrar em `frontend/astro.config.mjs`**

```js
import { remarkContentAssets } from "./src/lib/remark-content-assets";
// ...
export default defineConfig({
  // ...site/integrations/vite existentes
  markdown: { remarkPlugins: [remarkContentAssets] },
});
```

( `@astrojs/mdx` herda `markdown` por padrão — `extendMarkdownConfig` default true.)

- [x] **Step 6: Verificar no build**

Run: `cd frontend && npm run build && grep -rl "blog-assets" dist/blog | head -2 && grep -o 'src="/trilhas-assets/github/assets/[^"]*"' dist/trilhas/github/page-*/index.html | head -2`
Expected: imagens reescritas em posts que as usam; pelo menos um `<video>`/`<img>` reescrito nas páginas da trilha github (as rotas de trilha só existem após a Task 8 — se ainda não existirem, repetir este grep ao fim da Task 8).

- [x] **Step 7: Commit**

```bash
git add frontend/src/lib/remark-content-assets.ts frontend/src/lib/remark-content-assets.test.ts frontend/astro.config.mjs frontend/package.json frontend/package-lock.json
git commit -m "feat(fase-0.2): remark plugin de assets (blog-assets/trilhas-assets) com testes"
```

---

## Task 6: Ilha Giscus + config

**Files:**
- Create: `frontend/src/data/giscus.ts`
- Create: `frontend/src/components/islands/GiscusIsland.tsx`
- Modify: `frontend/package.json` (dep `@giscus/react`)

**Interfaces:**
- Produces: `<GiscusIsland client:visible />` — usada pelo `BlogPostLayout` (Task 7). Config em `GISCUS_CONFIG` (sem `theme` — o tema é dinâmico via `data-theme`).

- [x] **Step 1: Instalar dep**

Run: `cd frontend && npm install @giscus/react`

- [x] **Step 2: Escrever `frontend/src/data/giscus.ts`** (valores verbatim de `docusaurus.config.ts` → themeConfig.giscus)

```ts
// Portado de docusaurus.config.ts themeConfig.giscus — mapping "og:title" exige
// og:title idêntico ao Docusaurus nos posts (verificado na Task 11, diff de meta).
export const GISCUS_CONFIG = {
  repo: "codaqui/institucional",
  repoId: "R_kgDOG9s0Ng",
  category: "Blog",
  categoryId: "DIC_kwDOG9s0Ns4CRk25",
  mapping: "og:title",
  strict: "0",
  reactionsEnabled: "1",
  emitMetadata: "1",
  inputPosition: "bottom",
  lang: "pt",
} as const;
```

- [x] **Step 3: Escrever `frontend/src/components/islands/GiscusIsland.tsx`**

```tsx
import { useEffect, useState } from "react";
import Giscus from "@giscus/react";
import { GISCUS_CONFIG } from "../../data/giscus";

export default function GiscusIsland() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Giscus
      repo={GISCUS_CONFIG.repo}
      repoId={GISCUS_CONFIG.repoId}
      category={GISCUS_CONFIG.category}
      categoryId={GISCUS_CONFIG.categoryId}
      mapping="og:title"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="1"
      inputPosition="bottom"
      theme={theme}
      lang="pt"
      loading="lazy"
    />
  );
}
```

- [x] **Step 4: Verificar**

Run: `cd frontend && npx astro check`
Expected: 0 erros novos.

- [x] **Step 5: Commit**

```bash
git add frontend/src/data/giscus.ts frontend/src/components/islands/GiscusIsland.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(fase-0.2): ilha Giscus com tema sincronizado via data-theme"
```

---

## Task 7: Página de post — `BlogPostLayout` + `/blog/[...slug]`

**Files:**
- Create: `frontend/src/layouts/BlogPostLayout.astro`
- Create: `frontend/src/pages/blog/[...slug].astro`
- Modify: `frontend/src/styles/global.css` (estilos de corpo markdown `.prose-cq`)
- Modify: `frontend/src/layouts/BaseLayout.astro` (prop `ogTitle` opcional — verificar nome real da prop existente antes de editar)

**Interfaces:**
- Consumes: collections (`getCollection("blog")`, `render`), `postUrl/postDate/resolveAuthors/readingTimeMinutes/plainExcerpt/contentAssetUrl/sortPostsDesc` (Task 3), `slugifyTag` (Task 4), `GiscusIsland` (Task 6), `PublicLayout`.
- Produces: rotas `/blog/YYYY/MM/DD/<slug>` para os 26 posts; og:title = **título puro** do post; Giscus ao fim; sidebar "Posts recentes" (10) em `lg`.

- [x] **Step 1: Confirmar o formato exato do og:title atual**

Run (na raiz): `grep -o 'property="og:title" content="[^"]*"' "build/blog/2024/07/22/devparana-e-codaqui-unidos-pela-comunidade/index.html" | head -1`
Anotar o valor. Se for o título puro do post (sem " | Codaqui"), usar `ogTitle={post.data.title}`; se tiver sufixo, replicar exatamente. **Este valor é o contrato do Giscus.**

- [x] **Step 2: Estilos de corpo markdown em `frontend/src/styles/global.css`** (adicionar ao final; nomes de cor via tokens do tema Tailwind — sem hex)

```css
/* Corpo de conteúdo markdown (blog/trilhas) — zero JS, tokens --cq-* via utilities */
.prose-cq { @apply text-text-primary leading-relaxed; }
.prose-cq h2 { @apply mt-10 mb-4 text-2xl font-bold; }
.prose-cq h3 { @apply mt-8 mb-3 text-xl font-bold; }
.prose-cq h4 { @apply mt-6 mb-2 text-lg font-bold; }
.prose-cq p { @apply my-4; }
.prose-cq a { @apply text-link underline hover:text-link-hover; }
.prose-cq ul { @apply my-4 list-disc ps-6; }
.prose-cq ol { @apply my-4 list-decimal ps-6; }
.prose-cq li { @apply my-1; }
.prose-cq blockquote { @apply my-4 border-s-4 border-border ps-4 text-text-secondary; }
.prose-cq code { @apply rounded bg-sunken px-1 py-0.5 text-sm; }
.prose-cq pre { @apply my-4 overflow-x-auto rounded-lg bg-sunken p-4 text-sm; }
.prose-cq pre code { @apply bg-transparent p-0; }
.prose-cq img { @apply my-4 rounded-lg; }
.prose-cq video { @apply my-4 w-full rounded-lg; }
.prose-cq table { @apply my-4 w-full border-collapse text-sm; }
.prose-cq th, .prose-cq td { @apply border border-border px-3 py-2 text-start; }
.prose-cq hr { @apply my-8 border-border; }
```

(Ajustar os nomes de utility aos tokens realmente definidos em `tokens.css`/`global.css` da POC — ex.: se o token de fundo afundado for outro nome, usar o existente. Proibido inventar hex.)

- [x] **Step 3: Escrever `frontend/src/layouts/BlogPostLayout.astro`**

```astro
---
import PublicLayout from "./PublicLayout.astro";
import GiscusIsland from "../components/islands/GiscusIsland";
import type { BlogAuthor } from "../data/blog-authors";

interface RecentPost { url: string; title: string; }

interface Props {
  title: string;
  ogTitle: string;
  description: string;
  date: Date;
  readingMinutes: number;
  authors: BlogAuthor[];
  tags: { label: string; url: string }[];
  ogImage?: string;
  recentPosts: RecentPost[];
  enableComments: boolean;
}

const { title, ogTitle, description, date, readingMinutes, authors, tags, ogImage, recentPosts, enableComments } = Astro.props;

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
---

<PublicLayout title={`${title} | Codaqui`} ogTitle={ogTitle} description={description} ogImage={ogImage}>
  <div class="mx-auto flex max-w-6xl gap-10 px-4 py-10">
    <article class="min-w-0 max-w-3xl flex-1">
      <h1 class="text-3xl font-extrabold text-text-primary md:text-4xl">{title}</h1>
      <p class="mt-2 text-sm text-text-secondary">
        {dateFmt.format(date)} · {readingMinutes} min de leitura
      </p>
      {authors.length > 0 && (
        <ul class="mt-4 flex flex-wrap gap-4">
          {authors.map((author) => (
            <li class="flex items-center gap-2">
              {author.image_url && (
                <img src={author.image_url} alt={author.name} width="40" height="40" class="h-10 w-10 rounded-full" loading="lazy" />
              )}
              <span class="text-sm">
                {author.url ? (
                  <a href={author.url} target="_blank" rel="noopener noreferrer" class="font-bold text-link hover:text-link-hover">{author.name}</a>
                ) : (
                  <span class="font-bold">{author.name}</span>
                )}
                {author.title && <span class="block text-text-secondary">{author.title}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {tags.length > 0 && (
        <ul class="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li>
              <a href={tag.url} class="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-sunken">{tag.label}</a>
            </li>
          ))}
        </ul>
      )}
      <div class="prose-cq mt-8">
        <slot />
      </div>
      {enableComments && (
        <section class="mt-12 border-t border-border pt-8">
          <h2 class="mb-4 text-xl font-bold text-text-primary">Participe da conversa</h2>
          <GiscusIsland client:visible />
        </section>
      )}
    </article>
    <aside class="hidden w-64 shrink-0 lg:block">
      <h2 class="text-sm font-bold uppercase tracking-wide text-text-secondary">Posts recentes</h2>
      <ul class="mt-3 flex flex-col gap-2">
        {recentPosts.map((recent) => (
          <li><a href={recent.url} class="text-sm text-link hover:text-link-hover">{recent.title}</a></li>
        ))}
      </ul>
    </aside>
  </div>
</PublicLayout>
```

⚠️ Se `PublicLayout`/`BaseLayout` ainda não têm as props `ogTitle`/`ogImage` com esses nomes, ler os layouts antes e adaptar — o contrato obrigatório é: `<meta property="og:title">` = valor exato anotado no Step 1; `<meta property="og:image">` presente quando `ogImage` definida.

- [x] **Step 4: Escrever `frontend/src/pages/blog/[...slug].astro`**

```astro
---
import { getCollection, render } from "astro:content";
import BlogPostLayout from "../../layouts/BlogPostLayout.astro";
import { postUrl, postDate, resolveAuthors, readingTimeMinutes, plainExcerpt, contentAssetUrl, sortPostsDesc } from "../../lib/blog-utils";
import { slugifyTag } from "../../lib/slugify-tag";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  const sorted = sortPostsDesc(posts);
  const recent = sorted.slice(0, 10).map((p) => ({ url: postUrl(p), title: p.data.title }));
  return posts.map((post) => ({
    params: { slug: post.data.slug },
    props: { post, recent },
  }));
}

const { post, recent } = Astro.props;
const { Content } = await render(post);
const date = postDate(post);
const authors = resolveAuthors(post.data.authors);
const tags = post.data.tags.map((label) => ({ label, url: `/blog/category/${slugifyTag(label)}` }));
const ogImage = post.data.image ? new URL(contentAssetUrl(post.data.image), Astro.site).toString() : undefined;
---

<BlogPostLayout
  title={post.data.title}
  ogTitle={post.data.title}
  description={plainExcerpt(post.body ?? "")}
  date={date}
  readingMinutes={readingTimeMinutes(post.body ?? "")}
  authors={authors}
  tags={tags}
  ogImage={ogImage}
  recentPosts={recent}
  enableComments={post.data.enableComments !== false}
>
  <Content />
</BlogPostLayout>
```

(Se `render(post)` não expuser `post.body` no tipo, usar `post.body ?? ""` com cast pontual — o raw body existe na content layer como `body`.)

- [x] **Step 5: Verificar build + as 26 rotas**

Run: `cd frontend && npm run build`
Expected: build verde; `find dist/blog -name index.html | wc -l` ≥ 26; os 2 posts `.mdx` renderizam (abrir `dist/blog/2026/03/26/aumigo-prestacao-de-contas/index.html` e conferir presença de conteúdo dos cards).

**Plano B (só se os `.mdx` com MUI quebrarem o build):** os dois posts `.mdx` importam `@mui/material`. Se o SSR estático falhar, adicionar ao `copy-content.mjs` um passo que, **somente na cópia**, troca as linhas `import ... from "@mui/..."` por nada e os componentes `<Grid ...>`/`<Card>`/`<Typography ...>`/`<Stack ...>`/`<Button ...>` por `<div class="...">` equivalentes via patch explícito por arquivo (mapeamento literal, não parser) — e registrar a limitação no plano de implementação. Nunca editar os originais em `blog/`.

- [x] **Step 6: Smoke de paridade do og:title**

Run: `grep -o 'property="og:title" content="[^"]*"' "frontend/dist/blog/2024/07/22/devparana-e-codaqui-unidos-pela-comunidade/index.html" | head -1`
Expected: **idêntico** ao anotado no Step 1.

- [x] **Step 7: Commit**

```bash
git add frontend/src/layouts/BlogPostLayout.astro frontend/src/pages/blog/ frontend/src/styles/global.css frontend/src/layouts/BaseLayout.astro
git commit -m "feat(fase-0.2): páginas de post /blog/* com layout, autores, tags, reading time e Giscus"
```

---

## Task 8: Trilhas — nav data + `TrilhaLayout` + `/trilhas/[...slug]`

**Files:**
- Create: `frontend/src/data/trilhas-nav.ts`
- Create: `frontend/src/layouts/TrilhaLayout.astro`
- Create: `frontend/src/pages/trilhas/[...slug].astro`

**Interfaces:**
- Consumes: collection `trilhas`, `PublicLayout`, estilos `.prose-cq` (Task 7).
- Produces: rotas `/trilhas/intro`, `/trilhas/python/`, `/trilhas/python/page-1..16`, `/trilhas/github/`, `/trilhas/github/page-1..8`; `TRILHAS_NAV` usado pelo layout (sidebar + prev/next).

- [x] **Step 1: Escrever `frontend/src/data/trilhas-nav.ts`** (labels verbatim de `sidebars.ts`)

```ts
// Portado de sidebars.ts (Docusaurus) — fonte canônica até a Fase 0.6.
export interface TrilhaNavItem { slug: string; label: string; }
export interface TrilhaNav { id: string; title: string; items: TrilhaNavItem[]; }

export const TRILHAS_NAV: TrilhaNav[] = [
  {
    id: "python",
    title: "Python 101",
    items: [
      { slug: "python", label: "Apresentação" },
      { slug: "python/page-1", label: "Aula 1: Variáveis e Tipos de Dados" },
      { slug: "python/page-2", label: "Aula 2: Estruturas Lógicas e Condicionais" },
      { slug: "python/page-3", label: "Aula 3: Estruturas de Repetição" },
      { slug: "python/page-4", label: "Aula 4: Coleções" },
      { slug: "python/page-5", label: "Aula 5: Funções" },
      { slug: "python/page-6", label: "Aula 6: Comprehensions" },
      { slug: "python/page-7", label: "Aula 7: Expressões Lambdas e Funções Integradas" },
      { slug: "python/page-8", label: "Aula 8: Debugando e Tratando Erros" },
      { slug: "python/page-9", label: "Aula 9: Trabalhando com Módulos" },
      { slug: "python/page-10", label: "Aula 10: Manipulação de Arquivos" },
      { slug: "python/page-11", label: "Aula 11: Iteradores e Geradores" },
      { slug: "python/page-12", label: "Aula 12: Decoradores" },
      { slug: "python/page-13", label: "Aula 13: Programação Orientada a Objetos" },
      { slug: "python/page-14", label: "Aula 14: Herança e Polimorfismo" },
      { slug: "python/page-15", label: "Aula 15: Testes em Python" },
      { slug: "python/page-16", label: "Aula 16: Atualizações e Recursos Recentes" },
    ],
  },
  {
    id: "github",
    title: "GitHub 101",
    items: [
      { slug: "github", label: "Apresentação" },
      { slug: "github/page-1", label: "Aula 1: Introdução ao Git" },
      { slug: "github/page-2", label: "Aula 2: Entendendo o Fluxo do GitHub" },
      { slug: "github/page-3", label: "Aula 3: Termos do GitHub" },
      { slug: "github/page-4", label: "Aula 4: Tarefas para Realizar" },
      { slug: "github/page-5", label: "Aula 5: Tarefa 1" },
      { slug: "github/page-6", label: "Aula 6: Em Construção" },
      { slug: "github/page-7", label: "Aula 7: Em Construção" },
      { slug: "github/page-8", label: "Aula 5: Recursos e Referências" },
    ],
  },
];
```

- [x] **Step 2: Escrever `frontend/src/layouts/TrilhaLayout.astro`**

```astro
---
import PublicLayout from "./PublicLayout.astro";
import { TRILHAS_NAV, type TrilhaNav } from "../data/trilhas-nav";

interface TocItem { depth: number; slug: string; text: string; }

interface Props {
  title: string;
  description: string;
  currentSlug: string;          // ex.: "python/page-3" (id da collection)
  editPath: string;             // ex.: "python/page-3.md"
  headings: TocItem[];
}

const { title, description, currentSlug, editPath, headings } = Astro.props;
const nav: TrilhaNav | undefined = TRILHAS_NAV.find((n) => n.items.some((i) => i.slug === currentSlug));
const items = nav?.items ?? [];
const index = items.findIndex((i) => i.slug === currentSlug);
const prev = index > 0 ? items[index - 1] : undefined;
const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
---

<PublicLayout title={`${title} | Codaqui`} ogTitle={title} description={description}>
  <div class="mx-auto flex max-w-6xl gap-10 px-4 py-10">
    {nav && (
      <aside class="hidden w-64 shrink-0 lg:block">
        <h2 class="text-sm font-bold uppercase tracking-wide text-text-secondary">{nav.title}</h2>
        <ul class="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <li>
              <a
                href={`/trilhas/${item.slug}`}
                aria-current={item.slug === currentSlug ? "page" : undefined}
                class:list={[
                  "block rounded-md px-3 py-1.5 text-sm",
                  item.slug === currentSlug
                    ? "bg-sunken font-bold text-text-primary"
                    : "text-text-secondary hover:bg-sunken hover:text-text-primary",
                ]}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    )}
    <article class="min-w-0 max-w-3xl flex-1">
      <div class="prose-cq">
        <slot />
      </div>
      <p class="mt-8 text-sm">
        <a
          href={`https://github.com/codaqui/institucional/edit/develop/trilhas/${editPath}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-link hover:text-link-hover"
        >
          ✏️ Editar esta página no GitHub
        </a>
      </p>
      {(prev || next) && (
        <nav class="mt-8 flex justify-between gap-4 border-t border-border pt-6" aria-label="Navegação da trilha">
          {prev ? (
            <a href={`/trilhas/${prev.slug}`} class="text-sm font-bold text-link hover:text-link-hover">← {prev.label}</a>
          ) : <span />}
          {next ? (
            <a href={`/trilhas/${next.slug}`} class="text-end text-sm font-bold text-link hover:text-link-hover">{next.label} →</a>
          ) : <span />}
        </nav>
      )}
    </article>
    {toc.length > 0 && (
      <aside class="hidden w-56 shrink-0 xl:block">
        <h2 class="text-sm font-bold uppercase tracking-wide text-text-secondary">Nesta página</h2>
        <ul class="mt-3 flex flex-col gap-1">
          {toc.map((h) => (
            <li class:list={[h.depth === 3 && "ps-3"]}>
              <a href={`#${h.slug}`} class="text-sm text-text-secondary hover:text-link">{h.text}</a>
            </li>
          ))}
        </ul>
      </aside>
    )}
  </div>
</PublicLayout>
```

- [x] **Step 3: Escrever `frontend/src/pages/trilhas/[...slug].astro`**

```astro
---
import { getCollection, render } from "astro:content";
import TrilhaLayout from "../../layouts/TrilhaLayout.astro";
import { plainExcerpt } from "../../lib/blog-utils";

export async function getStaticPaths() {
  const pages = await getCollection("trilhas");
  return pages.map((page) => ({
    // id "index" → slug custom do frontmatter ("intro"); "python/index" → "python"; demais: id direto
    params: { slug: page.id === "index" ? page.data.slug : page.id.replace(/\/index$/, "") },
    props: { page },
  }));
}

const { page } = Astro.props;
const { Content, headings } = await render(page);
const firstH1 = headings.find((h) => h.depth === 1);
const title = page.data.title ?? firstH1?.text ?? "Trilhas";
// O H1 já vem no corpo markdown; o layout não repete título.
const contentHeadings = headings.filter((h) => h.depth > 1);
---

<TrilhaLayout
  title={title}
  description={plainExcerpt(page.body ?? "")}
  currentSlug={page.id.replace(/\/index$/, "")}
  editPath={`${page.id}.md`}
  headings={contentHeadings}
>
  <Content />
</TrilhaLayout>
```

⚠️ `currentSlug` para `trilhas/index.md` (id `index`) fica `"index"` — a intro não tem sidebar/prev-next (correto: `nav` undefined). Conferir que `/trilhas/intro` sai no build.

- [x] **Step 4: Verificar**

Run: `cd frontend && npm run build && find dist/trilhas -name index.html | wc -l`
Expected: build verde; **28** páginas (intro + python index+16 + github index+8 = 1+17+9+1=28? não: intro(1) + python(17) + github(9) = 27; se sair 27, ok — validar contra `find build/trilhas -name "*.html"` na Task 11).

- [x] **Step 5: Smoke de assets da trilha**

Run: `grep -ro 'src="/trilhas-assets/github/assets/[^"]*"' frontend/dist/trilhas/github/ | head -2`
Expected: pelo menos 1 ocorrência (video/imagem reescrito pela Task 5).

- [x] **Step 6: Commit**

```bash
git add frontend/src/data/trilhas-nav.ts frontend/src/layouts/TrilhaLayout.astro frontend/src/pages/trilhas/
git commit -m "feat(fase-0.2): trilhas python/github com sidebar, TOC, prev/next e editUrl"
```

---

## Task 9: Listagem do blog — `/blog`, `/blog/page/N`, `/blog/category/*`

**Files:**
- Create: `frontend/src/components/astro/BlogPostCard.astro`
- Create: `frontend/src/components/astro/BlogSidebar.astro`
- Create: `frontend/src/pages/blog/index.astro`
- Create: `frontend/src/pages/blog/page/[page].astro`
- Create: `frontend/src/pages/blog/category/[tag]/index.astro`
- Create: `frontend/src/pages/blog/category/[tag]/page/[page].astro`

**Interfaces:**
- Consumes: `sortPostsDesc/postUrl/postDate/plainExcerpt/readingTimeMinutes` (Task 3), `slugifyTag` (Task 4).
- Produces: `/blog` (página 1, 9 posts), `/blog/page/2..N`, `/blog/category/<slug>` e `/blog/category/<slug>/page/2..M` (9 posts/página — `postsPerPage: 9` do Docusaurus); sidebar "Posts recentes" (10) reutilizada via `BlogSidebar.astro`.

- [x] **Step 1: Escrever `frontend/src/components/astro/BlogPostCard.astro`**

```astro
---
interface Props {
  url: string;
  title: string;
  date: Date;
  excerpt: string;
  readingMinutes: number;
  tags: { label: string; url: string }[];
}

const { url, title, date, excerpt, readingMinutes, tags } = Astro.props;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
---

<article class="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md">
  <h2 class="text-xl font-bold">
    <a href={url} class="text-text-primary hover:text-link">{title}</a>
  </h2>
  <p class="mt-1 text-sm text-text-secondary">{dateFmt.format(date)} · {readingMinutes} min de leitura</p>
  <p class="mt-3 text-text-secondary">{excerpt}</p>
  {tags.length > 0 && (
    <ul class="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li>
          <a href={tag.url} class="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-sunken">{tag.label}</a>
        </li>
      ))}
    </ul>
  )}
</article>
```

- [x] **Step 2: Escrever `frontend/src/components/astro/BlogSidebar.astro`**

```astro
---
interface Props {
  recentPosts: { url: string; title: string }[];
}

const { recentPosts } = Astro.props;
---

<aside class="hidden w-64 shrink-0 lg:block">
  <h2 class="text-sm font-bold uppercase tracking-wide text-text-secondary">Posts recentes</h2>
  <ul class="mt-3 flex flex-col gap-2">
    {recentPosts.map((post) => (
      <li><a href={post.url} class="text-sm text-link hover:text-link-hover">{post.title}</a></li>
    ))}
  </ul>
</aside>
```

Refatorar `BlogPostLayout.astro` (Task 7) para usar `<BlogSidebar recentPosts={recentPosts} />` no lugar do `<aside>` inline — mesma marcação, sem mudança visual.

- [x] **Step 3: Helper compartilhado de props de card** — adicionar a `frontend/src/lib/blog-utils.ts` (com teste novo em `blog-utils.test.ts`):

```ts
export function postCardProps(post: {
  id: string;
  body?: string;
  data: { slug: string; title: string; date?: Date; tags: string[] };
}) {
  return {
    url: postUrl(post as { data: { slug: string } }),
    title: post.data.title,
    date: postDate(post),
    excerpt: plainExcerpt(post.body ?? ""),
    readingMinutes: readingTimeMinutes(post.body ?? ""),
    tags: post.data.tags.map((label) => ({ label, url: `/blog/category/${slugifyTag(label)}` })),
  };
}
```

Teste (adicionar ao describe existente, rodar antes da implementação — TDD):

```ts
it("postCardProps monta props do card", () => {
  const card = postCardProps({
    id: "2024-07-22-x",
    body: "Resumo.\n\n<!-- truncate -->\n\nResto",
    data: { slug: "2024/07/22/x", title: "Título", tags: ["história"] },
  });
  expect(card.url).toBe("/blog/2024/07/22/x");
  expect(card.excerpt).toBe("Resumo.");
  expect(card.tags[0].url).toBe("/blog/category/historia");
});
```

- [x] **Step 4: Escrever `frontend/src/pages/blog/index.astro`**

```astro
---
import { getCollection } from "astro:content";
import PublicLayout from "../../layouts/PublicLayout.astro";
import BlogPostCard from "../../components/astro/BlogPostCard.astro";
import BlogSidebar from "../../components/astro/BlogSidebar.astro";
import { sortPostsDesc, postUrl, postCardProps } from "../../lib/blog-utils";

export const POSTS_PER_PAGE = 9;

const sorted = sortPostsDesc(await getCollection("blog"));
const pagePosts = sorted.slice(0, POSTS_PER_PAGE);
const totalPages = Math.ceil(sorted.length / POSTS_PER_PAGE);
const recent = sorted.slice(0, 10).map((p) => ({ url: postUrl(p), title: p.data.title }));
---

<PublicLayout title="Blog | Codaqui" ogTitle="Blog" description="Tutoriais técnicos, novidades institucionais e projetos da comunidade Codaqui — Uma comunidade de comunidades de tecnologia.">
  <div class="mx-auto flex max-w-6xl gap-10 px-4 py-10">
    <div class="min-w-0 flex-1">
      <h1 class="mb-6 text-3xl font-extrabold text-text-primary">Blog</h1>
      <div class="flex flex-col gap-4">
        {pagePosts.map((post) => <BlogPostCard {...postCardProps(post)} />)}
      </div>
      {totalPages > 1 && (
        <nav class="mt-8 flex justify-end" aria-label="Paginação do blog">
          <a href="/blog/page/2" class="text-sm font-bold text-link hover:text-link-hover">Posts anteriores →</a>
        </nav>
      )}
    </div>
    <BlogSidebar recentPosts={recent} />
  </div>
</PublicLayout>
```

⚠️ `export const POSTS_PER_PAGE` em arquivo de página não é importável por outras rotas de forma confiável — declarar `POSTS_PER_PAGE = 9` em `src/lib/blog-utils.ts` (com as demais constantes) e importar nas 4 rotas. Ajustar o snippet acima ao fazer.

- [x] **Step 5: Escrever `frontend/src/pages/blog/page/[page].astro`**

```astro
---
import { getCollection } from "astro:content";
import PublicLayout from "../../../layouts/PublicLayout.astro";
import BlogPostCard from "../../../components/astro/BlogPostCard.astro";
import BlogSidebar from "../../../components/astro/BlogSidebar.astro";
import { POSTS_PER_PAGE, sortPostsDesc, postUrl, postCardProps } from "../../../lib/blog-utils";

export async function getStaticPaths() {
  const sorted = sortPostsDesc(await getCollection("blog"));
  const totalPages = Math.ceil(sorted.length / POSTS_PER_PAGE);
  return Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map((page) => ({
    params: { page: String(page) },
    props: {
      page,
      totalPages,
      posts: sorted.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
      recent: sorted.slice(0, 10).map((p) => ({ url: postUrl(p), title: p.data.title })),
    },
  }));
}

const { page, totalPages, posts, recent } = Astro.props;
---

<PublicLayout title={`Blog — página ${page} | Codaqui`} ogTitle="Blog" description="Tutoriais técnicos, novidades institucionais e projetos da comunidade Codaqui.">
  <div class="mx-auto flex max-w-6xl gap-10 px-4 py-10">
    <div class="min-w-0 flex-1">
      <h1 class="mb-6 text-3xl font-extrabold text-text-primary">Blog</h1>
      <div class="flex flex-col gap-4">
        {posts.map((post) => <BlogPostCard {...postCardProps(post)} />)}
      </div>
      <nav class="mt-8 flex justify-between" aria-label="Paginação do blog">
        <a href={page === 2 ? "/blog" : `/blog/page/${page - 1}`} class="text-sm font-bold text-link hover:text-link-hover">← Posts recentes</a>
        {page < totalPages && (
          <a href={`/blog/page/${page + 1}`} class="text-sm font-bold text-link hover:text-link-hover">Posts anteriores →</a>
        )}
      </nav>
    </div>
    <BlogSidebar recentPosts={recent} />
  </div>
</PublicLayout>
```

- [x] **Step 6: Escrever as rotas de categoria** — `frontend/src/pages/blog/category/[tag]/index.astro`:

```astro
---
import { getCollection } from "astro:content";
import PublicLayout from "../../../../layouts/PublicLayout.astro";
import BlogPostCard from "../../../../components/astro/BlogPostCard.astro";
import { POSTS_PER_PAGE, sortPostsDesc, postCardProps, slugifyTag } from "../../../../lib/blog-utils";

export async function getStaticPaths() {
  const sorted = sortPostsDesc(await getCollection("blog"));
  const byTag = new Map<string, { label: string; posts: typeof sorted }>();
  for (const post of sorted) {
    for (const label of post.data.tags) {
      const slug = slugifyTag(label);
      const entry = byTag.get(slug) ?? { label, posts: [] };
      entry.posts.push(post);
      byTag.set(slug, entry);
    }
  }
  return [...byTag.entries()].map(([slug, { label, posts }]) => ({
    params: { tag: slug },
    props: { label, posts, totalPages: Math.ceil(posts.length / POSTS_PER_PAGE) },
  }));
}

const { label, posts, totalPages } = Astro.props;
const { tag } = Astro.params;
---

<PublicLayout title={`${label} | Codaqui`} ogTitle={label} description={`Posts do blog da Codaqui com a tag ${label}.`}>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="mb-6 text-3xl font-extrabold text-text-primary">{label}</h1>
    <div class="flex flex-col gap-4">
      {posts.slice(0, POSTS_PER_PAGE).map((post) => <BlogPostCard {...postCardProps(post)} />)}
    </div>
    {totalPages > 1 && (
      <nav class="mt-8 flex justify-end" aria-label="Paginação da tag">
        <a href={`/blog/category/${tag}/page/2`} class="text-sm font-bold text-link hover:text-link-hover">Posts anteriores →</a>
      </nav>
    )}
  </div>
</PublicLayout>
```

E `frontend/src/pages/blog/category/[tag]/page/[page].astro` — código completo:

```astro
---
import { getCollection } from "astro:content";
import PublicLayout from "../../../../../layouts/PublicLayout.astro";
import BlogPostCard from "../../../../../components/astro/BlogPostCard.astro";
import { POSTS_PER_PAGE, sortPostsDesc, postCardProps, slugifyTag } from "../../../../../lib/blog-utils";

export async function getStaticPaths() {
  const sorted = sortPostsDesc(await getCollection("blog"));
  const byTag = new Map<string, { label: string; posts: typeof sorted }>();
  for (const post of sorted) {
    for (const label of post.data.tags) {
      const slug = slugifyTag(label);
      const entry = byTag.get(slug) ?? { label, posts: [] };
      entry.posts.push(post);
      byTag.set(slug, entry);
    }
  }
  return [...byTag.entries()].flatMap(([slug, { label, posts }]) => {
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2).map((page) => ({
      params: { tag: slug, page: String(page) },
      props: {
        label,
        page,
        totalPages,
        posts: posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
      },
    }));
  });
}

const { label, page, totalPages, posts } = Astro.props;
const { tag } = Astro.params;
---

<PublicLayout title={`${label} — página ${page} | Codaqui`} ogTitle={label} description={`Posts do blog da Codaqui com a tag ${label}.`}>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="mb-6 text-3xl font-extrabold text-text-primary">{label}</h1>
    <div class="flex flex-col gap-4">
      {posts.map((post) => <BlogPostCard {...postCardProps(post)} />)}
    </div>
    <nav class="mt-8 flex justify-between" aria-label="Paginação da tag">
      <a href={page === 2 ? `/blog/category/${tag}` : `/blog/category/${tag}/page/${page - 1}`} class="text-sm font-bold text-link hover:text-link-hover">← Posts recentes</a>
      {page < totalPages && (
        <a href={`/blog/category/${tag}/page/${page + 1}`} class="text-sm font-bold text-link hover:text-link-hover">Posts anteriores →</a>
      )}
    </nav>
  </div>
</PublicLayout>
```

- [x] **Step 7: Verificar**

Run: `cd frontend && npm run build && ls dist/blog && ls dist/blog/category | head -5 && ls dist/blog/page`
Expected: `dist/blog/index.html`, `dist/blog/page/2/` e `page/3/` (26 posts ÷ 9 = 3 páginas), ~60 diretórios em `category/`.

- [x] **Step 8: Commit**

```bash
git add frontend/src/components/astro/BlogPostCard.astro frontend/src/components/astro/BlogSidebar.astro frontend/src/pages/blog/ frontend/src/lib/blog-utils.ts frontend/src/lib/blog-utils.test.ts frontend/src/layouts/BlogPostLayout.astro
git commit -m "feat(fase-0.2): listagem do blog com paginação, sidebar e páginas de categoria"
```

---

## Task 10: Feeds — `/blog/rss.xml`, `/blog/atom.xml`, `/blog/feed.json`

**Files:**
- Create: `frontend/src/pages/blog/rss.xml.ts`
- Create: `frontend/src/pages/blog/atom.xml.ts`
- Create: `frontend/src/pages/blog/feed.json.ts`
- Modify: `frontend/package.json` (dep `@astrojs/rss`)

**Interfaces:**
- Consumes: `sortPostsDesc/postUrl/postDate/plainExcerpt` (Task 3), `Astro.site` (https://codaqui.dev).
- Produces: os 3 endpoints estáticos; conteúdo: todos os 26 posts, título "Blog da Codaqui", language `pt-BR`, copyright `© <ano atual> Associação Codaqui`.

- [x] **Step 1: Instalar dep**

Run: `cd frontend && npm install @astrojs/rss`

- [x] **Step 2: Escrever `frontend/src/pages/blog/rss.xml.ts`**

```ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { postUrl, postDate, plainExcerpt, sortPostsDesc } from "../../lib/blog-utils";

export const GET: APIRoute = async (context) => {
  const posts = sortPostsDesc(await getCollection("blog"));
  return rss({
    title: "Blog da Codaqui",
    description: "Tutoriais técnicos, novidades institucionais e projetos da comunidade Codaqui — Uma comunidade de comunidades de tecnologia.",
    site: context.site ?? "https://codaqui.dev",
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: postDate(post),
      description: plainExcerpt(post.body ?? ""),
      link: postUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>pt-BR</language><copyright>© ${new Date().getFullYear()} Associação Codaqui</copyright>`,
  });
};
```

- [x] **Step 3: Escrever `frontend/src/pages/blog/atom.xml.ts`**

```ts
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { postUrl, postDate, plainExcerpt, sortPostsDesc } from "../../lib/blog-utils";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://codaqui.dev")).origin;
  const posts = sortPostsDesc(await getCollection("blog"));
  const updated = postDate(posts[0]).toISOString();
  const entries = posts
    .map((post) => {
      const url = `${base}${postUrl(post)}`;
      return `<entry><title>${esc(post.data.title)}</title><link href="${url}"/><id>${url}</id><published>${postDate(post).toISOString()}</published><updated>${postDate(post).toISOString()}</updated><summary>${esc(plainExcerpt(post.body ?? ""))}</summary></entry>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR"><title>Blog da Codaqui</title><link href="${base}/blog/atom.xml" rel="self"/><link href="${base}/blog"/><id>${base}/blog</id><updated>${updated}</updated>${entries}</feed>`;
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
};
```

- [x] **Step 4: Escrever `frontend/src/pages/blog/feed.json.ts`**

```ts
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { postUrl, postDate, plainExcerpt, sortPostsDesc } from "../../lib/blog-utils";

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://codaqui.dev")).origin;
  const posts = sortPostsDesc(await getCollection("blog"));
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Blog da Codaqui",
    home_page_url: `${base}/blog`,
    feed_url: `${base}/blog/feed.json`,
    language: "pt-BR",
    items: posts.map((post) => ({
      id: `${base}${postUrl(post)}`,
      url: `${base}${postUrl(post)}`,
      title: post.data.title,
      summary: plainExcerpt(post.body ?? ""),
      date_published: postDate(post).toISOString(),
      tags: post.data.tags,
    })),
  };
  return new Response(JSON.stringify(feed), { headers: { "Content-Type": "application/feed+json; charset=utf-8" } });
};
```

- [x] **Step 5: Verificar**

Run: `cd frontend && npm run build && head -c 300 dist/blog/rss.xml && node -e "JSON.parse(require('fs').readFileSync('dist/blog/feed.json','utf8')); console.log('feed.json válido')"`
Expected: XML do RSS com `<title>Blog da Codaqui</title>`; feed.json parseia sem erro.

- [x] **Step 6: Commit**

```bash
git add frontend/src/pages/blog/rss.xml.ts frontend/src/pages/blog/atom.xml.ts frontend/src/pages/blog/feed.json.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(fase-0.2): feeds rss/atom/json do blog"
```

---

## Task 11: Gate de paridade de URLs (`diff-urls.mjs`)

**Files:**
- Create: `frontend/scripts/diff-urls.mjs`
- Modify: `Makefile` (target `astro-verify` passa a chamar o diff)
- Modify: `DEVELOPMENT.md` (seção Astro: documentar o gate)

**Contexto:** o build Docusaurus atual existe em `build/` (raiz). O script compara as URLs de `/blog` e `/trilhas` entre `build/` (referência) e `frontend/dist/` (novo). Exclusões conhecidas: `/blog/archive*` (stubs de redirect — Fase 0.3).

- [x] **Step 1: Escrever `frontend/scripts/diff-urls.mjs`**

```js
// Gate de paridade: URLs públicas de /blog e /trilhas no build Docusaurus (build/,
// referência) vs build Astro (frontend/dist/). Sai com código 1 se faltar URL.
import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const OLD = join(ROOT, "build");
const NEW = join(ROOT, "frontend", "dist");

// Stubs de redirect fora do escopo da 0.2 (Fase 0.3 — páginas públicas).
const EXCLUDE = [/^\/blog\/archive/];

function walk(dir, pattern) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (pattern.test(entry.name)) out.push(full);
    }
  }
  return out;
}

function toUrl(file, base) {
  let url = `/${relative(base, file).replace(/\\/g, "/")}`;
  if (url.endsWith("/index.html")) url = url.slice(0, -"index.html".length); // keep trailing dir
  else url = url.replace(/\.html$/, "");
  return url.replace(/\/$/, "") || "/";
}

function urlsOf(base, section) {
  const dir = join(base, section);
  const files = [...walk(dir, /\.html$/), ...walk(dir, /^(rss\.xml|atom\.xml|feed\.json)$/)];
  return new Set(files.map((f) => toUrl(f, base)).filter((u) => !EXCLUDE.some((re) => re.test(u))));
}

let missing = 0;
for (const section of ["blog", "trilhas"]) {
  const oldUrls = urlsOf(OLD, section);
  const newUrls = urlsOf(NEW, section);
  for (const url of oldUrls) {
    if (!newUrls.has(url)) {
      console.error(`✖ FALTA no build Astro: ${url}`);
      missing++;
    }
  }
  const extra = [...newUrls].filter((u) => !oldUrls.has(u));
  if (extra.length) console.log(`ℹ URLs novas (não existiam no Docusaurus): ${extra.join(", ")}`);
  console.log(`→ /${section}: ${oldUrls.size} URLs na referência, ${missing === 0 ? "todas presentes" : "FALTANDO"}`);
}

if (missing > 0) {
  console.error(`✖ diff-urls: ${missing} URL(s) faltando`);
  process.exit(1);
}
console.log("✔ diff-urls: paridade 100% em /blog e /trilhas");
```

⚠️ O Docusaurus emite `category/<tag>.html` (arquivo) e o Astro emite `category/<tag>/index.html` — `toUrl` normaliza ambos para `/blog/category/<tag>`. Se a referência `build/` estiver desatualizada em relação ao site no ar, regenerar uma vez com `npm run build` na raiz (demora alguns minutos) antes de rodar o gate.

- [x] **Step 2: Rodar e iterar até 0 faltando**

Run: `cd frontend && npm run build && node scripts/diff-urls.mjs`
Expected: `✔ paridade 100%`. Cada URL faltando é um bug real de rota/slug — corrigir na rota correspondente (não no script). Candidatos prováveis: slug de tag divergente (Task 4), `/trilhas/intro` vs `/trilhas`, paginação de categoria, página índice de categorias (`/blog/category`, se existir no build antigo — criar `frontend/src/pages/blog/category/index.astro` listando todas as tags).

- [x] **Step 3: Integrar ao `Makefile`**

No target `astro-verify`, após o smoke existente, adicionar:

```make
	node $(ASTRO_DIR)/scripts/diff-urls.mjs
```

E ao `DEVELOPMENT.md` (seção "Frontend (Astro)"), uma linha: "`make astro-verify` inclui o gate de paridade de URLs de `/blog` e `/trilhas` contra o build Docusaurus (`build/`); regenere `build/` com `npm run build` na raiz se a referência estiver velha."

- [x] **Step 4: Commit**

```bash
git add frontend/scripts/diff-urls.mjs Makefile DEVELOPMENT.md
git commit -m "feat(fase-0.2): gate de paridade de URLs blog/trilhas (diff-urls) no astro-verify"
```

---

## Task 12: Verificação final da Fase 0.2

**Files:**
- Modify: `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (marcar progresso da 0.2, se houver checkbox/status)
- Modify: `docs/superpowers/plans/2026-10-21-fase-0-2-conteudo-blog-trilhas.md` (checkboxes das tasks)

- [x] **Step 1: Gates completos**

Run: `cd frontend && npm run build && npx astro check && npx vitest run && node scripts/diff-urls.mjs`
Expected: build verde, 0 erros de check, todos os testes passando (22 da 0.1 + novos), paridade 100%.

- [x] **Step 2: Garantir que o Docusaurus segue intacto**

Run (raiz): `npm run typecheck`
Expected: verde (nada do Docusaurus foi tocado; se `frontend/` interferir no tsconfig da raiz, ajustar o exclude).

- [x] **Step 3: Lighthouse das páginas novas**

Run: `make astro-lighthouse` estendido (ou lighthouse manual) sobre: `/blog`, um post (`/blog/2024/07/22/devparana-e-codaqui-unidos-pela-comunidade`), `/trilhas/intro`, `/trilhas/python/page-1`.
Registrar os números na mensagem do commit do Step 5.

- [x] **Step 4: Smoke manual (dev server)**

`make astro-dev` e conferir no navegador: post renderiza com autores/tags/Giscus (Giscus pode não carregar em localhost — verificar apenas que o iframe é montado); tema claro/escuro OK nos posts e trilhas; sidebar das trilhas com item ativo; prev/next funcionam; imagens do post `hello-world` carregam; vídeo da trilha github carrega.

- [x] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(fase-0.2): verificação final — paridade de URLs 100%, gates verdes, lighthouse registrado"
```

---

## Critério de pronto da 0.2 (da spec)

- [x] Diff de URLs blog/trilhas 100% (script `diff-urls.mjs` no `make astro-verify`)
- [x] Posts renderizam com Giscus e tema (claro/escuro)
- [x] MDX + inventário/mapeamento de componentes custom: os 2 `.mdx` MUI renderizam (ou plano B documentado), inventário registrado neste plano
- [x] Feeds `/blog/rss.xml`, `/blog/atom.xml`, `/blog/feed.json` no ar
- [x] `build` + `astro check` + `vitest` verdes; Docusaurus intocado (`npm run typecheck` na raiz verde)
