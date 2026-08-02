/**
 * Elas no Código — configuração da comunidade dentro do site Codaqui.
 *
 * Este arquivo centraliza branding, slug Stripe e itens de menu.
 * É importado pelas páginas em `comunidades/elasnocodigo/src/pages/`.
 */

export interface NavMenuItem {
  label: string;
  to?: string;
  items?: { label: string; to: string }[];
}

export interface CommunitySiteConfig {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  logoUrlDark?: string;
  theme: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
    /** Background color for the community footer */
    footerBg: string;
  };
  basePath: string;
  externalLinks: { label: string; href: string }[];
  navMenu: NavMenuItem[];
  features: {
    donations: boolean;
    transparency: boolean;
    events: boolean;
    blog: boolean;
    docs: boolean;
  };
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: { label: string; to: string };
    ctaSecondary?: { label: string; href: string };
  };
  /** Cards de destaque na home da comunidade (impacto / números). */
  impact?: {
    title: string;
    subtitle?: string;
    stats: { value: string; label: string }[];
  };
  /** Texto da seção "Explore a comunidade" na home. */
  exploreSection?: {
    title: string;
    subtitle: string;
  };
  /** Texto da seção final de canais oficiais. */
  channelsSection?: {
    title: string;
    subtitle: string;
  };
}

const config: CommunitySiteConfig = {
  slug: "elasnocodigo",
  name: "Elas no Código",
  shortName: "Elas no Código",
  tagline: "Apoiamos e incentivamos mulheres na tecnologia.",
  description:
    "Acreditamos que a diversidade é fundamental e, por isso, buscamos promover a inclusão de mulheres no mercado de tecnologia.",
  logoUrl: "/img/elasnocodigo.svg",
  logoUrlDark: "/img/elasnocodigo-white.svg",
  theme: {
    primary: "#9c27b0",
    primaryDark: "#2b0945",
    primaryLight: "#ce93d8",
    accent: "#ffc107",
    footerBg: "#2b0945",
  },
  basePath: "/comunidades/elasnocodigo",
  externalLinks: [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/elas-no-codigo" },
    { label: "Instagram", href: "https://www.instagram.com/elasnocodigo/" },
    { label: "Facebook", href: "https://www.facebook.com/people/Elas-no-c%C3%B3digo/61573927546100/" },
  ],
  navMenu: [
    { label: "Início", to: "/comunidades/elasnocodigo" },
    {
      label: "Sobre",
      items: [
        { label: "Ações", to: "/comunidades/elasnocodigo" },
        { label: "Equipe", to: "/comunidades/elasnocodigo/equipe" },
        { label: "Docs", to: "/comunidades/elasnocodigo/docs" },
      ],
    },
    { label: "Apoiar", to: "/comunidades/elasnocodigo/apoiar" },
    { label: "Transparência", to: "/comunidades/elasnocodigo/transparencia" },
  ],
  features: {
    donations: true,
    transparency: true,
    events: false,
    blog: false,
    docs: true,
  },
  hero: {
    title: "Elas no Código",
    subtitle:
      "Apoiamos e incentivamos mulheres na tecnologia.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/elasnocodigo/apoiar" },
    ctaSecondary: { label: "Conecte-se no LinkedIn", href: "https://www.linkedin.com/company/elas-no-codigo" },
  },
  impact: {
    title: "Nosso impacto",
    subtitle: "Ações e iniciativas para a inclusão de mulheres na tecnologia.",
    stats: [
      { value: "3+", label: "Encontros e lives realizados" },
      { value: "Em breve", label: "Podcast no agregador de streamings" },
      { value: "Gratuito", label: "Acesso aos cursos e encontros" },
    ],
  },
  exploreSection: {
    title: "Explore a comunidade",
    subtitle: "Tudo que a Elas no Código oferece dentro do portal Codaqui.",
  },
  channelsSection: {
    title: "Quer saber mais?",
    subtitle: "Acesse os canais oficiais da Elas no Código.",
  },
};

export default config;
