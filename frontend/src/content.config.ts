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

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

// Blog das comunidades parceiras (Fase 0.5). O diretório por tenant é um
// symlink para `comunidades/<slug>/blog` (conteúdo canônico, READ-ONLY — mesmo
// padrão do Docusaurus até a 0.6). Paridade com o plugin-content-blog:
// posts com `slug` legado no frontmatter, autores como chaves string
// (resolvidas via src/data/community-blog-authors.ts, espelhando authors.yml).
const communityBlog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/community-blog/tisocial" }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    date: z.coerce.date(),
    authors: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().optional(),
    image: z.string().optional(),
  }),
});

// Docs das comunidades parceiras — hoje só o index.md da T.I. Social.
const communityDocs = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/community-docs/tisocial" }),
  schema: z.object({
    sidebar_position: z.number().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
  }),
});

export const collections = { blog, trilhas, pages, communityBlog, communityDocs };
