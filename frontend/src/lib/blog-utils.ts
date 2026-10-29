import { BLOG_AUTHORS, type BlogAuthor } from "../data/blog-authors";
import { slugifyTag } from "./slugify-tag";

export const POSTS_PER_PAGE = 9;

interface PostLike {
  id: string;
  data: { slug?: string; date?: Date };
}

export function postUrl(post: { data: { slug: string } }): string {
  return `/blog/${post.data.slug}`;
}

// O glob loader usa o `slug` do frontmatter como id (formato YYYY/MM/DD/...);
// o formato YYYY-MM-DD cobre ids derivados do nome do arquivo.
const POST_ID_DATE_RE = /^(\d{4})[/-](\d{2})[/-](\d{2})/;

export function postDate(post: { id: string; data: { date?: Date } }): Date {
  if (post.data.date) return post.data.date;
  const match = POST_ID_DATE_RE.exec(post.id);
  if (!match) throw new Error(`Post sem data e id fora do padrão: ${post.id}`);
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00-03:00`);
}

/**
 * Exibe a data de publicação do post. Sempre em UTC: datas de frontmatter
 * chegam como meia-noite UTC (`z.coerce.date`) e o fallback do `postDate`
 * usa meio-dia em UTC-3 — em ambos os casos o dia do calendário pretendido
 * só sobrevive à formatação se o timeZone for fixo (não o do runner/build).
 */
const postDateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatPostDate(date: Date): string {
  return postDateFmt.format(date);
}

export function resolveAuthors(authors: (string | BlogAuthor)[]): BlogAuthor[] {
  return authors.map((a) => (typeof a === "string" ? (BLOG_AUTHORS[a] ?? { name: a }) : a));
}

export function plainText(markdown: string): string {
  // Quantificadores lazy (Sonar S8786): as classes de conteúdo excluem os
  // delimitadores (`]`, `)`, `>`), então lazy e greedy têm o mesmo primeiro
  // match — sem o backtracking super-linear de corpos grandes sem match.
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*?\]\([^)]*?\)/g, " ")
    .replace(/\[([^\]]*?)\]\([^)]*?\)/g, "$1")
    .replace(/<[^>]+?>/g, " ")
    .replace(/[#*_>`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingTimeMinutes(body: string): number {
  const words = plainText(body).split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 300));
}

export function plainExcerpt(body: string, maxLen = 160): string {
  // As cópias .mdx geradas pelo copy-content.mjs (plano B) usam o marcador
  // na forma de comentário MDX `{/* truncate */}`; os .md seguem com `<!-- truncate -->`.
  const beforeTruncate = body.split(/<!--\s*truncate\s*-->|\{\/\*\s*truncate\s*\*\/\}/)[0];
  const text = plainText(beforeTruncate);
  if (text.length <= maxLen) return text;
  // Corte em palavra inteira: equivalente a `/\s+\S*$/`, mas linear — após o
  // plainText todo whitespace foi colapsado em espaços simples, então o último
  // espaço é o único `\s` possível no trecho cortado.
  const sliced = text.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  const trimmed = lastSpace === -1 ? sliced : sliced.slice(0, lastSpace);
  return `${trimmed}…`;
}

export function contentAssetUrl(raw: string): string {
  if (raw.startsWith("./assets/")) return raw.replace("./assets/", "/trilhas-assets/github/assets/");
  return raw.replace(/^\.?\/?img\//, "/blog-assets/img/");
}

export function sortPostsDesc<T extends PostLike>(posts: T[]): T[] {
  return [...posts].sort((a, b) => postDate(b).getTime() - postDate(a).getTime());
}

export interface TagGroup<T> {
  label: string;
  posts: T[];
}

export function collectByTag<T extends { data: { tags: string[] } }>(posts: T[]): Map<string, TagGroup<T>> {
  const byTag = new Map<string, TagGroup<T>>();
  for (const post of posts) {
    for (const label of post.data.tags) {
      const slug = slugifyTag(label);
      const entry = byTag.get(slug) ?? { label, posts: [] };
      entry.posts.push(post);
      byTag.set(slug, entry);
    }
  }
  return byTag;
}

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
