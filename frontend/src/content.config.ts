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
