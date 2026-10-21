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
