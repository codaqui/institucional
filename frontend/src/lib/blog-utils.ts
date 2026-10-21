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
