import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { loadTenantConfig } from "../../../../lib/community";
import {
  communityPostDescription,
  publishedCommunityPosts,
  sortCommunityPosts,
} from "../../../../lib/community-blog";
import { communityBlogJsonFeed } from "../../../../lib/community-feed";
import { getTenant } from "../../../../lib/tenant";

// JSON Feed do blog da T.I. Social no portal codaqui
// (/comunidades/tisocial/blog/feed.json).
export const GET: APIRoute = async ({ site }) => {
  const tenant = getTenant() ?? "tisocial";
  const config = await loadTenantConfig(tenant);
  const posts = sortCommunityPosts(
    publishedCommunityPosts(await getCollection("communityBlog")),
  );
  return communityBlogJsonFeed({
    site,
    basePath: "/comunidades/tisocial/blog",
    shortName: config.shortName,
    name: config.name,
    posts: posts.map((post) => ({
      slug: post.data.slug,
      title: post.data.title,
      date: post.data.date,
      tags: post.data.tags,
      description: communityPostDescription(post),
    })),
  });
};
