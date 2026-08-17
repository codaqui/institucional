/**
 * DevParaná — configuração da comunidade dentro do site Codaqui.
 *
 * Este arquivo centraliza branding, slug Stripe e itens de menu.
 * É importado pelas páginas em `comunidades/devparana/src/pages/`.
 */

import type { CommunitySiteConfig } from "../shared/types";

const config: CommunitySiteConfig = {
  slug: "devparana",
  name: "DevParaná",
  shortName: "DevParaná",
  tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
  description:
    "Comunidade sem fins lucrativos que conecta pessoas desenvolvedoras de software em todo o estado do Paraná. "
    + "Promove meetups, workshops, hackathons e o evento itinerante DevParaná na Estrada.",
  logoUrl: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
  logoUrlDark: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
  theme: {
    primary: "#2563EB",
    primaryDark: "#1E3A8A",
    primaryLight: "#60A5FA",
    accent: "#F59E0B",
    footerBg: "#1E3A8A",
  },
  basePath: "/comunidades/devparana",
  externalLinks: [
    { label: "Site oficial", href: "https://devpr.org/" },
    { label: "Meetup", href: "https://www.meetup.com/pt-BR/developerparana/" },
    { label: "YouTube", href: "https://www.youtube.com/devparana" },
    { label: "Instagram", href: "https://www.instagram.com/devparana" },
    { label: "GitHub", href: "https://github.com/DeveloperParana" },
  ],
  navMenu: [
    { label: "Início", to: "/comunidades/devparana" },
    {
      label: "Sobre",
      items: [
        { label: "Docs", to: "/comunidades/devparana/docs" },
        { label: "Equipe", to: "/comunidades/devparana/equipe" },
        { label: "Embaixadores", to: "/comunidades/devparana/embaixadores" },
      ],
    },
    { label: "Na Estrada", to: "/comunidades/devparana/na-estrada" },
    { label: "Apoiar", to: "/comunidades/devparana/apoiar" },
    { label: "Transparência", to: "/comunidades/devparana/transparencia" },
  ],
  features: {
    donations: true,
    transparency: true,
    events: false,
    blog: false,
    docs: true,
  },
  hero: {
    title: "DevParaná",
    subtitle: "Conectando pessoas desenvolvedoras de software em todo o estado do Paraná.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/devparana/apoiar" },
    ctaSecondary: { label: "Site oficial", href: "https://devpr.org/" },
  },
  impact: {
    title: "Impacto da comunidade",
    subtitle: "Presença do DevParaná no estado do Paraná.",
    stats: [
      { value: "6", label: "Regiões do Paraná" },
      { value: "20+", label: "Cidades alcançadas" },
      { value: "Desde 2015", label: "Conectando pessoas dev" },
    ],
  },
  exploreSection: {
    title: "Explore a comunidade",
    subtitle: "Tudo que o DevParaná oferece dentro do portal Codaqui.",
  },
  channelsSection: {
    title: "Quer saber mais?",
    subtitle: "Acesse os canais oficiais do DevParaná.",
  },
};

export default config;
