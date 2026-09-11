/**
 * CamposTech — configuração da comunidade dentro do site Codaqui.
 *
 * Este arquivo centraliza branding, slug Stripe e itens de menu.
 * É importado pelas páginas em `comunidades/campostechpg/src/pages/`.
 */

import type { CommunitySiteConfig } from "../shared/types";

const config: CommunitySiteConfig = {
  slug: "campostechpg",
  name: "CamposTech",
  shortName: "CamposTech",
  tagline: "Comunidade de Tecnologia dos Campos Gerais.",
  description:
    "Espaço colaborativo dedicado à inovação, tecnologia e empreendedorismo em Ponta Grossa e nos Campos Gerais. Desde 2018, conecta pessoas, empresas, universidades e entidades públicas para o desenvolvimento de carreiras, projetos e negócios.",
  logoUrl: "/img/campostech.svg",
  logoUrlDark: "/img/campostech.svg",
  socialImage: "/img/og-campostech.jpg",
  theme: {
    primary: "#185E89",
    primaryDark: "#162542",
    primaryLight: "#2E4068",
    accent: "#ffcd3e",
    footerBg: "#162542",
  },
  basePath: "/comunidades/campostechpg",
  externalLinks: [
    { label: "Site oficial", href: "https://campostechpg.com.br/" },
    { label: "Grupos (Linktree)", href: "https://linktr.ee/campostechpg" },
    { label: "Instagram", href: "https://www.instagram.com/campostechpg" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/campostechpg" },
    { label: "Facebook", href: "https://www.facebook.com/CamposTechPG/" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC4DBdSVpA-72UqHubk0AN0w/videos" },
    { label: "Sympla", href: "https://www.sympla.com.br/produtor/camposvalley" },
  ],
  navMenu: [
    { label: "Início", to: "/comunidades/campostechpg" },
    {
      label: "Sobre",
      items: [
        { label: "Quem Somos", to: "/comunidades/campostechpg/docs" },
        { label: "Mentores", to: "/comunidades/campostechpg/mentores" },
      ],
    },
    { label: "Apoiar", to: "/comunidades/campostechpg/apoiar" },
    { label: "Transparência", to: "/comunidades/campostechpg/transparencia" },
  ],
  features: {
    donations: true,
    transparency: true,
    events: true,
    blog: false,
    docs: true,
  },
  hero: {
    title: "CamposTech",
    subtitle:
      "Comunidade de Tecnologia dos Campos Gerais. Desde 2018 conectando pessoas, empresas, universidades e entidades públicas para o desenvolvimento de carreiras, projetos e negócios.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/campostechpg/apoiar" },
    ctaSecondary: { label: "Acessar grupos", href: "https://linktr.ee/campostechpg" },
  },
  impact: {
    title: "Nosso impacto",
    subtitle: "Impulsionando a tecnologia na região dos Campos Gerais.",
    stats: [
      { value: "2018", label: "Comunidade ativa desde" },
      { value: "12", label: "Mentores voluntários" },
      { value: "3", label: "Pilares: networking, conhecimento e divulgação" },
    ],
  },
  eventSources: ["sympla:campostech"],
  exploreSection: {
    title: "Explore a comunidade",
    subtitle: "Tudo que a CamposTech oferece dentro do portal Codaqui.",
  },
  channelsSection: {
    title: "Quer saber mais?",
    subtitle: "Acesse os canais oficiais da CamposTech.",
  },
};

export default config;
