// Feeds do blog das comunidades parceiras (rss.xml / atom.xml / feed.json) —
// paridade com o feedOptions `{ type: "all" }` do plugin-content-blog no
// Docusaurus. As funções recebem dados plain (sem astro:content) para
// poderem ser testadas; os endpoints fazem o getCollection e delegam aqui.

export interface CommunityFeedPost {
  slug: string;
  title: string;
  date: Date;
  tags: string[];
  description: string;
}

export interface CommunityFeedInput {
  /** Origem absoluta do site (Astro.site). */
  site: URL | undefined;
  /** Base das rotas de blog ("/blog" ou "/comunidades/<slug>/blog"). */
  basePath: string;
  shortName: string;
  name: string;
  posts: CommunityFeedPost[];
}

/** Opções do @astrojs/rss (o endpoint chama `rss(options)`). */
export function communityBlogRssOptions(input: CommunityFeedInput) {
  return {
    title: `${input.shortName} — Blog`,
    description: `Posts da comunidade ${input.name}`,
    site: new URL(input.basePath, input.site ?? new URL("https://codaqui.dev")),
    trailingSlash: false,
    items: input.posts.map((post) => ({
      title: post.title,
      pubDate: post.date,
      description: post.description,
      link: `${input.basePath}/${post.slug}`,
      categories: post.tags,
    })),
    customData: `<language>pt-BR</language><copyright>© ${new Date().getFullYear()} ${input.name}</copyright>`,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Atom 1.0 — mesmo shape do atom.xml do blog principal. */
export function communityBlogAtom(input: CommunityFeedInput): Response {
  const base = (input.site ?? new URL("https://codaqui.dev")).origin;
  const updated = input.posts[0]?.date.toISOString() ?? new Date().toISOString();
  const entries = input.posts
    .map((post) => {
      const url = `${base}${input.basePath}/${post.slug}`;
      const published = post.date.toISOString();
      return `<entry><title>${esc(post.title)}</title><link href="${url}"/><id>${url}</id><published>${published}</published><updated>${published}</updated><summary>${esc(post.description)}</summary></entry>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR"><title>${esc(`${input.shortName} — Blog`)}</title><link href="${base}${input.basePath}/atom.xml" rel="self"/><link href="${base}${input.basePath}"/><id>${base}${input.basePath}</id><updated>${updated}</updated>${entries}</feed>`;
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
}

/** JSON Feed — mesmo shape do feed.json do blog principal. */
export function communityBlogJsonFeed(input: CommunityFeedInput): Response {
  const base = (input.site ?? new URL("https://codaqui.dev")).origin;
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${input.shortName} — Blog`,
    home_page_url: `${base}${input.basePath}`,
    feed_url: `${base}${input.basePath}/feed.json`,
    language: "pt-BR",
    items: input.posts.map((post) => ({
      id: `${base}${input.basePath}/${post.slug}`,
      url: `${base}${input.basePath}/${post.slug}`,
      title: post.title,
      summary: post.description,
      date_published: post.date.toISOString(),
      tags: post.tags,
    })),
  };
  return new Response(JSON.stringify(feed), { headers: { "Content-Type": "application/feed+json; charset=utf-8" } });
}
