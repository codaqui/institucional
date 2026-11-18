export interface NavigationLink {
  label: string;
  href: string;
}

export interface NavigationGroup {
  title: string;
  links: NavigationLink[];
}

export const SITE_NAVIGATION: NavigationLink[] = [
  { label: "Comunidades", href: "/comunidades" },
  { label: "Atividades", href: "/eventos" },
  { label: "Transparência", href: "/transparencia" },
  { label: "Aprender", href: "/participe/estudar" },
  { label: "Apoiar", href: "/participe/apoiar" },
];

export const INTEGRATE_COMMUNITY_LINK: NavigationLink = {
  label: "Integrar minha comunidade",
  href: "/sobre/ong",
};

export const FOOTER_NAVIGATION: NavigationGroup[] = [
  {
    title: "Comunidades",
    links: [
      { label: "Todas as comunidades", href: "/comunidades" },
      { label: "Agenda unificada", href: "/eventos" },
      { label: "C4P", href: "/c4p" },
      INTEGRATE_COMMUNITY_LINK,
    ],
  },
  {
    title: "Associação e transparência",
    links: [
      { label: "Sobre a Associação", href: "/sobre/ong" },
      { label: "Prestação de contas", href: "/transparencia" },
      { label: "Insights", href: "/sobre/insights" },
      { label: "Assembleias e atas", href: "/assembleias" },
      { label: "Dados abertos", href: "/desenvolvedores/api" },
    ],
  },
  {
    title: "Participar",
    links: [
      { label: "Aprender", href: "/participe/estudar" },
      { label: "Trilhas", href: "/trilhas" },
      { label: "Mentoria", href: "/participe/mentoria" },
      { label: "Apoiar", href: "/participe/apoiar" },
      { label: "Projetos", href: "/projetos" },
      { label: "Patrocinar", href: "/patrocinadores" },
    ],
  },
  {
    title: "Conteúdo e contato",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Equipe", href: "/sobre/equipe" },
      { label: "Membros", href: "/membros" },
      { label: "Contato", href: "/contato" },
      { label: "Verificar certificado", href: "/certificado/verificar" },
      { label: "Privacidade", href: "/sobre/privacidade" },
      { label: "Código no GitHub", href: "https://github.com/codaqui/institucional" },
    ],
  },
];

function normalizePath(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function isNavigationCurrent(pathname: string, href: string): boolean {
  if (!href.startsWith("/")) return false;
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}
