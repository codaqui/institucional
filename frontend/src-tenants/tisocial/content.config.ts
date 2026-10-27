import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Mesma definição de `frontend/src/content.config.ts` (padrão blog/trilhas:
// a collection é duplicada nos dois configs). O base resolve contra a project
// root do Astro (frontend/) e segue o symlink `content/` → `../../src/content`
// — que por sua vez aponta `community-blog/tisocial` para o conteúdo canônico
// READ-ONLY em `comunidades/tisocial/blog`.
const communityBlog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src-tenants/tisocial/content/community-blog/tisocial" }),
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

const communityDocs = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src-tenants/tisocial/content/community-docs/tisocial" }),
  schema: z.object({
    sidebar_position: z.number().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
  }),
});

export const collections = { communityBlog, communityDocs };
