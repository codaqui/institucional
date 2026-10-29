// Subconjunto de comunidades/index.ts (COMMUNITIES_CONFIG do Docusaurus) com
// apenas os campos usados pela seção "Portais das comunidades" de /sobre/ong.
// Os portais /comunidades/<slug> chegam na Fase 0.5 — até lá os links desta
// seção apontam para rotas ainda não servidas pelo build Astro.

export interface CommunityPortal {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  logoUrlDark: string;
  basePath: string;
}

export const communityPortals: CommunityPortal[] = [
  {
    slug: "tisocial",
    name: "T.I. Social Maringá",
    tagline: "Tecnologia que transforma realidades.",
    description:
      "Projeto que une tecnologia e responsabilidade social, promovendo educação digital, campanhas de solidariedade e ações comunitárias na região de Maringá.",
    logoUrl: "/img/tisocial.png",
    logoUrlDark: "/img/tisocial-white.png",
    basePath: "/comunidades/tisocial",
  },
  {
    slug: "elasnocodigo",
    name: "Elas no Código",
    tagline: "Apoiamos e incentivamos mulheres na tecnologia.",
    description:
      "Acreditamos que a diversidade é fundamental e, por isso, buscamos promover a inclusão de mulheres no mercado de tecnologia.",
    logoUrl: "/img/elasnocodigo.svg",
    logoUrlDark: "/img/elasnocodigo-white.svg",
    basePath: "/comunidades/elasnocodigo",
  },
  {
    slug: "devparana",
    name: "DevParaná",
    tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
    description:
      "Comunidade sem fins lucrativos que conecta pessoas desenvolvedoras de software em todo o estado do Paraná. Promove meetups, workshops, hackathons e o evento itinerante DevParaná na Estrada.",
    logoUrl: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
    logoUrlDark: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
    basePath: "/comunidades/devparana",
  },
  {
    slug: "campostechpg",
    name: "CamposTech",
    tagline: "Comunidade de Tecnologia dos Campos Gerais.",
    description:
      "Espaço colaborativo dedicado à inovação, tecnologia e empreendedorismo em Ponta Grossa e nos Campos Gerais. Desde 2018, conecta pessoas, empresas, universidades e entidades públicas para o desenvolvimento de carreiras, projetos e negócios.",
    logoUrl: "/img/campostech.svg",
    logoUrlDark: "/img/campostech.svg",
    basePath: "/comunidades/campostechpg",
  },
];
