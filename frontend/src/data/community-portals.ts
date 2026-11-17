export interface CommunityPortalBranding {
  slug: string;
  tagline: string;
  logoUrlDark: string;
}

export const communityPortalBranding: CommunityPortalBranding[] = [
  {
    slug: "tisocial",
    tagline: "Tecnologia que transforma realidades.",
    logoUrlDark: "/img/tisocial-white.png",
  },
  {
    slug: "elasnocodigo",
    tagline: "Apoiamos e incentivamos mulheres na tecnologia.",
    logoUrlDark: "/img/elasnocodigo-white.svg",
  },
  {
    slug: "devparana",
    tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
    logoUrlDark: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
  },
  {
    slug: "campostechpg",
    tagline: "Comunidade de Tecnologia dos Campos Gerais.",
    logoUrlDark: "/img/campostech.svg",
  },
];
