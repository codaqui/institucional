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
  socialImage: "/img/og-devparana.jpg",
  theme: {
    primary: "#1ba250",
    primaryDark: "#147a3b",
    primaryLight: "#2dd47a",
    accent: "#0f8a4a",
    footerBg: "#0A0A0A",
  },
  basePath: "/comunidades/devparana",
  externalLinks: [
    { label: "Site oficial", href: "https://devparana.org" },
    { label: "DevPR Conf", href: "https://devpr.org/" },
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
        { label: "RFCs", to: "/comunidades/devparana/rfcs" },
      ],
    },
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
  eventSources: ["meetup:devparana"],
  hero: {
    title: "DevParaná",
    subtitle: "Conectando pessoas desenvolvedoras de software em todo o estado do Paraná.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/devparana/apoiar" },
  },
  heroVisual: {
    imageSrc: "/img/devparana-hero.jpg",
    imageAlt: "Pinheiro do Paraná",
    imagePosition: "right",
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
