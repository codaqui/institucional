/**
 * TI Social — configuração da comunidade dentro do site Codaqui.
 *
 * Este arquivo centraliza branding, slug Stripe e itens de menu.
 * É importado pelas páginas em `src/pages/comunidades/tisocial/`.
 */

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
  navMenu: { label: string; to: string }[];
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
  slug: "tisocial",
  name: "T.I. Social Maringá",
  shortName: "T.I. Social",
  tagline: "Tecnologia que transforma realidades.",
  description:
    "Projeto que une tecnologia e responsabilidade social, promovendo educação digital, "
    + "campanhas de solidariedade e ações comunitárias na região de Maringá.",
  logoUrl: "/img/tisocial.png",
  logoUrlDark: "/img/tisocial-white.png",
  theme: {
    primary: "#0ea5e9",
    primaryDark: "#0284c7",
    primaryLight: "#38bdf8",
    accent: "#f97316",
    footerBg: "#0c4a6e",
  },
  basePath: "/comunidades/tisocial",
  externalLinks: [
    { label: "Instagram", href: "https://www.instagram.com/tisocialmaringa" },
  ],
  navMenu: [
    { label: "Início",        to: "/comunidades/tisocial" },
    { label: "Blog",          to: "/comunidades/tisocial/blog" },
    { label: "Docs",          to: "/comunidades/tisocial/docs" },
    { label: "Apoiar",        to: "/comunidades/tisocial/apoiar" },
    { label: "Transparência", to: "/comunidades/tisocial/transparencia" },
  ],
  features: {
    donations: true,
    transparency: true,
    events: false,
    blog: true,
    docs: true,
  },
  hero: {
    title: "T.I. Social Maringá",
    subtitle:
      "Unindo tecnologia e responsabilidade social para transformar a comunidade. "
      + "Páscoa Solidária, AUMIGO, mentoria e educação digital — tudo num só lugar.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/tisocial/apoiar" },
    ctaSecondary: { label: "Ver no Instagram", href: "https://www.instagram.com/tisocialmaringa" },
  },
  impact: {
    title: "Impacto recente",
    subtitle: "Resultado consolidado da AUMIGO e Páscoa Solidária 2025.",
    stats: [
      { value: "R$ 2.859,45", label: "Arrecadados na AUMIGO" },
      { value: "417,5 kg",     label: "Ração distribuída" },
      { value: "+350",         label: "Animais beneficiados" },
      { value: "464",          label: "Caixas de bombons (Páscoa)" },
    ],
  },
  exploreSection: {
    title: "Explore a comunidade",
    subtitle: "Tudo que a T.I. Social oferece dentro do portal Codaqui.",
  },
  channelsSection: {
    title: "Quer saber mais?",
    subtitle: "Acesse os canais oficiais da T.I. Social Maringá.",
  },
};

export default config;
