/**
 * TI Social — configuração da comunidade dentro do site Codaqui.
 *
 * Este arquivo centraliza branding, slug Stripe e itens de menu.
 * É importado pelas páginas em `src/pages/comunidades/tisocial/`.
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

import campaigns from "./src/data/campaigns.json";

// Cálculos dinâmicos baseados no campaigns.json
const totalActions = campaigns.length;
const totalImpact = campaigns.reduce(
  (acc, c) => acc + (c.peopleImpacted || 0) + (c.animalsImpacted || 0),
  0
);
const totalRaised = campaigns.reduce((acc, c) => acc + (c.raised || 0), 0);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

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
    primary: "#8DC044",
    primaryDark: "#424143",
    primaryLight: "#a6d16a",
    accent: "#424143",
    footerBg: "#424143",
  },
  basePath: "/comunidades/tisocial",
  externalLinks: [
    { label: "Instagram", href: "https://www.instagram.com/tisocialmaringa" },
  ],
  navMenu: [
    { label: "Início",        to: "/comunidades/tisocial" },
    {
      label: "Sobre",
      items: [
        { label: "Docs",   to: "/comunidades/tisocial/docs" },
        { label: "Equipe", to: "/comunidades/tisocial/equipe" },
      ],
    },
    { label: "Campanhas",     to: "/comunidades/tisocial/blog" },
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
      "Transformando comunidades através da tecnologia.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/tisocial/apoiar" },
    ctaSecondary: { label: "Ver no Instagram", href: "https://www.instagram.com/tisocialmaringa" },
  },
  impact: {
    title: "Impacto da comunidade",
    subtitle: "Consolidado histórico das campanhas realizadas pela T.I. Social.",
    stats: [
      { value: formatNumber(totalActions), label: "Ações realizadas" },
      { value: formatNumber(totalImpact),  label: "Pessoas e animais impactados" },
      { value: formatCurrency(totalRaised), label: "Total arrecadado" },
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
