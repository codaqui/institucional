// Helpers do blog das comunidades parceiras (Fase 0.5) — espelham
// src/lib/blog-utils.ts, mas parametrizados por `basePath` porque o mesmo
// conteúdo emite duas árvores de rotas: rotas limpas no build tenant
// (`/blog*`) e rotas do portal no build codaqui (`/comunidades/<slug>/blog*`).
import type { CommunityBlogAuthor } from "../data/community-blog-authors";
import { resolveCommunityBlogAuthor } from "../data/community-blog-authors";
import { plainText, readingTimeMinutes, sortPostsDesc, collectByTag, type TagGroup } from "./blog-utils";
import { slugifyTag } from "./slugify-tag";

// Paridade com o plugin-content-blog do Docusaurus (postsPerPage: 9 em
// docusaurus.config.ts).
export const COMMUNITY_POSTS_PER_PAGE = 9;
export const COMMUNITY_SIDEBAR_COUNT = 10;

export interface CommunityBlogPostLike {
  id: string;
  body?: string;
  data: {
    slug: string;
    title: string;
    date: Date;
    authors: string[];
    tags: string[];
    draft?: boolean;
    image?: string;
  };
}

/** Posts publicados (draft é excluído, como o build de produção do Docusaurus). */
export function publishedCommunityPosts<T extends CommunityBlogPostLike>(posts: T[]): T[] {
  return posts.filter((post) => post.data.draft !== true);
}

export function sortCommunityPosts<T extends CommunityBlogPostLike>(posts: T[]): T[] {
  return sortPostsDesc(posts);
}

export function communityPostUrl(post: CommunityBlogPostLike, basePath: string): string {
  return `${basePath}/${post.data.slug}`;
}

export function communityTagUrl(label: string, basePath: string): string {
  return `${basePath}/tags/${slugifyTag(label)}`;
}

export function communityPostReadingMinutes(post: CommunityBlogPostLike): number {
  return readingTimeMinutes(post.body ?? "");
}

/**
 * Descrição do post: primeiro parágrafo do corpo (texto antes do primeiro
 * heading), como o Docusaurus deriva a description quando o frontmatter não
 * a define. Usada em og:description e nos feeds.
 */
export function communityPostDescription(post: CommunityBlogPostLike): string {
  const beforeFirstHeading = (post.body ?? "").split(/\n#{1,6}\s/)[0];
  return plainText(beforeFirstHeading);
}

export function resolveCommunityBlogAuthors(handles: string[]): CommunityBlogAuthor[] {
  return handles.map((handle) => resolveCommunityBlogAuthor(handle));
}

export interface YearGroup<T> {
  year: number;
  posts: T[];
}

/** Posts agrupados por ano (desc) — sidebar "Posts recentes" e arquivo. */
export function groupCommunityPostsByYear<T extends CommunityBlogPostLike>(sortedPosts: T[]): YearGroup<T>[] {
  const groups = new Map<number, T[]>();
  for (const post of sortedPosts) {
    const year = post.data.date.getFullYear();
    const list = groups.get(year) ?? [];
    list.push(post);
    groups.set(year, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, posts]) => ({ year, posts }));
}

export function collectCommunityPostsByTag<T extends CommunityBlogPostLike>(
  posts: T[],
): Map<string, TagGroup<T>> {
  return collectByTag(posts);
}

/** Entradas { url, title } dos N posts mais recentes (sidebar). */
export function recentCommunityPosts<T extends CommunityBlogPostLike>(
  sortedPosts: T[],
  basePath: string,
  count = COMMUNITY_SIDEBAR_COUNT,
): { url: string; title: string }[] {
  return sortedPosts
    .slice(0, count)
    .map((post) => ({ url: communityPostUrl(post, basePath), title: post.data.title }));
}
