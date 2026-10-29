import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { loadTenantConfig } from "../../lib/community";
import {
  communityPostDescription,
  publishedCommunityPosts,
  sortCommunityPosts,
} from "../../lib/community-blog";
import { communityBlogRssOptions } from "../../lib/community-feed";
import { getTenant } from "../../lib/tenant";

// Feed RSS do blog da comunidade — paridade com feedOptions { type: "all" } do
// plugin-content-blog (rss.xml). Rotas limpas no build tenant (/blog/rss.xml).
export const GET: APIRoute = async (context) => {
  const tenant = getTenant() ?? "tisocial";
  const config = await loadTenantConfig(tenant);
  const posts = sortCommunityPosts(
    publishedCommunityPosts(await getCollection("communityBlog")),
  );
  return rss(
    communityBlogRssOptions({
      site: context.site,
      basePath: "/blog",
      shortName: config.shortName,
      name: config.name,
      posts: posts.map((post) => ({
        slug: post.data.slug,
        title: post.data.title,
        date: post.data.date,
        tags: post.data.tags,
        description: communityPostDescription(post),
      })),
    }),
  );
};
