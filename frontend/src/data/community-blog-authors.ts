// Autores dos blogs das comunidades parceiras — mapa simples espelhando o
// `authors.yml` de cada comunidade (fonte canônica em `comunidades/<slug>/`,
// READ-ONLY). As páginas de blog resolvem as chaves string do frontmatter
// (`authors: [tisocial]`) por aqui, como o Docusaurus faz com o authors.yml.
//
// Hoje só a T.I. Social tem blog (Fase 0.5); ao adicionar um blog novo,
// inclua o import do authors.yml da comunidade neste mapa.

export interface CommunityBlogAuthor {
  name: string;
  title?: string;
  url?: string;
  image_url?: string;
}

export const COMMUNITY_BLOG_AUTHORS: Record<string, CommunityBlogAuthor> = {
  tisocial: {
    name: "TI Social",
    title: "Equipe de Impacto",
    url: "https://www.instagram.com/tisocialmaringa",
    image_url: "/img/tisocial.png",
  },
};

export function resolveCommunityBlogAuthor(handle: string): CommunityBlogAuthor {
  return COMMUNITY_BLOG_AUTHORS[handle] ?? { name: handle };
}
