import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { postUrl, postDate, plainExcerpt, sortPostsDesc } from "../../lib/blog-utils";

export const GET: APIRoute = async (context) => {
  const posts = sortPostsDesc(await getCollection("blog"));
  return rss({
    title: "Blog da Codaqui",
    description: "Tutoriais, projetos e novidades da comunidade Codaqui",
    // Base /blog para o <link> do canal bater com o feed Docusaurus
    // (https://codaqui.dev/blog); links relativos continuam resolvendo na raiz.
    site: new URL("/blog", context.site ?? "https://codaqui.dev"),
    // Paridade com o feed Docusaurus: links/guid sem barra final.
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: postDate(post),
      description: plainExcerpt(post.body ?? ""),
      link: postUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>pt-BR</language><copyright>© ${new Date().getFullYear()} Associação Codaqui</copyright>`,
  });
};
