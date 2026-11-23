export interface NavigationLink {
  label: string;
  href: string;
}

export interface NavigationGroup {
  title: string;
  links: NavigationLink[];
}

export type SiteNavigationItem =
  | ({ kind: "link" } & NavigationLink)
  | { kind: "group"; label: string; links: NavigationLink[] };

export const SITE_NAVIGATION: SiteNavigationItem[] = [
  { kind: "link", label: "Comunidades", href: "/comunidades" },
  { kind: "link", label: "Atividades", href: "/eventos" },
  {
    kind: "group",
    label: "Aprender",
    links: [
      { label: "Visão geral", href: "/participe/estudar" },
      { label: "Trilhas", href: "/trilhas" },
      { label: "Mentoria", href: "/participe/mentoria" },
    ],
  },
  {
    kind: "group",
    label: "Explorar",
    links: [
      { label: "Projetos", href: "/projetos" },
      { label: "Blog", href: "/blog" },
    ],
  },
  { kind: "link", label: "Transparência", href: "/transparencia" },
  { kind: "link", label: "Apoiar", href: "/participe/apoiar" },
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
      { label: "Empresas apoiadoras", href: "/empresas" },
    ],
  },
  {
    title: "Conteúdo e contato",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Guia de Regex", href: "/regex" },
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

export function isNavigationItemCurrent(
  pathname: string,
  item: SiteNavigationItem,
): boolean {
  return item.kind === "link"
    ? isNavigationCurrent(pathname, item.href)
    : item.links.some((link) => isNavigationCurrent(pathname, link.href));
}
