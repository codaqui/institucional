import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { postUrl, postDate, plainExcerpt, sortPostsDesc } from "../../lib/blog-utils";

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

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
