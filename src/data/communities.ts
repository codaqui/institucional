import type { SocialProfile } from "./social-stats";

export type { SocialProfile };

export interface CommunityLink {
  type: "website" | "instagram" | "whatsapp" | "github" | "youtube";
  label: string;
  url: string;
}

export interface Community {
  id: string;
  name: string;
  emoji: string;
  logo: string;
  description: string;
  location?: string;
  founded?: number;
  links: CommunityLink[];
  /** Perfis sociais da comunidade — usados pela página de Insights */
  socialProfiles?: SocialProfile[];
  tags: string[];
}

export const communities: Community[] = [
  {
    id: "devparana",
    name: "DevParaná",
    emoji: "👥",
    logo: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
    description:
      "Comunidade sem fins lucrativos que conecta pessoas desenvolvedoras de software em todo o estado do Paraná. Fundada em 2015 e sediada em Maringá, promove meetups, workshops, hackathons e DevPR Conf.",
    location: "Maringá, PR",
    founded: 2015,
    links: [
      { type: "website", label: "devpr.org", url: "https://devpr.org/" },
      { type: "github", label: "GitHub", url: "https://github.com/DeveloperParana" },
    ],
    socialProfiles: [
      {
        platform: "meetup",
        handle: "developerparana",
        url: "https://www.meetup.com/pt-BR/developerparana/",
        countLabel: "membros",
        baselineCount: 2100,
      },
      {
        platform: "youtube",
        handle: "@devparana",
        url: "https://www.youtube.com/devparana",
        countLabel: "inscritos",
        baselineCount: 0,
      },
      {
        platform: "instagram",
        handle: "@devparana",
        url: "https://www.instagram.com/devparana",
        countLabel: "seguidores",
        baselineCount: 0,
      },
    ],
    tags: ["developers", "paraná", "meetups", "conferências"],
  },
  {
    id: "elasnocodigo",
    name: "Elas no Código",
    emoji: "♀️",
    logo: "/img/elasnocodigo.svg",
    description:
      "Iniciativa que tem como objetivo inserir mulheres no setor da tecnologia e apoiar as que já estão, empoderando-as e oferecendo mais oportunidades de conhecimento e desenvolvimento profissional.",
    links: [
      { type: "instagram", label: "@elasnocodigo", url: "https://www.instagram.com/elasnocodigo/" },
    ],
    socialProfiles: [
      {
        platform: "instagram",
        handle: "@elasnocodigo",
        url: "https://www.instagram.com/elasnocodigo/",
        countLabel: "seguidores",
        baselineCount: 0,
      },
    ],
    tags: ["mulheres", "inclusão", "empoderamento", "tech"],
  },
  {
    id: "campostechpg",
    name: "CamposTech",
    emoji: "💻",
    logo: "/img/campostech.svg",
    description:
      "Espaço colaborativo dedicado à inovação, tecnologia e empreendedorismo em Ponta Grossa. Fomenta conexões entre participantes, profissionais, organizações e entusiastas.",
    location: "Ponta Grossa, PR",
    links: [
      { type: "website", label: "campostechpg.com.br", url: "https://campostechpg.com.br/" },
      { type: "instagram", label: "@campostechpg", url: "https://www.instagram.com/campostechpg" },
      { type: "youtube", label: "CamposTech no YouTube", url: "https://www.youtube.com/channel/UC4DBdSVpA-72UqHubk0AN0w/videos" },
    ],
    socialProfiles: [
      {
        platform: "website",
        handle: "campostechpg.com.br",
        url: "https://campostechpg.com.br/",
        countLabel: "site",
        baselineCount: 0,
      },
      {
        platform: "instagram",
        handle: "@campostechpg",
        url: "https://www.instagram.com/campostechpg",
        countLabel: "seguidores",
        baselineCount: 0,
      },
      {
        platform: "youtube",
        handle: "CamposTech",
        url: "https://www.youtube.com/channel/UC4DBdSVpA-72UqHubk0AN0w/videos",
        countLabel: "inscritos",
        baselineCount: 0,
      },
    ],
    tags: ["inovação", "empreendedorismo", "networking"],
  },
  {
    id: "tisocial",
    name: "TI Social",
    emoji: "🤝",
    logo: "/img/tisocial.png",
    description:
      "Projeto que une tecnologia e responsabilidade social, promovendo o acesso à educação digital para comunidades carentes da região de Maringá.",
    location: "Maringá, PR",
    links: [
      { type: "instagram", label: "@tisocialmaringa", url: "https://www.instagram.com/tisocialmaringa" },
    ],
    socialProfiles: [
      {
        platform: "instagram",
        handle: "@tisocialmaringa",
        url: "https://www.instagram.com/tisocialmaringa",
        countLabel: "seguidores",
        baselineCount: 0,
      },
    ],
    tags: ["inclusão digital", "educação", "social"],
  },
  {
    id: "cloudnativemaringa",
    name: "Cloud Native Maringá",
    emoji: "☁️",
    logo: "https://avatars.githubusercontent.com/u/13455738?v=4",
    description:
      "Grupo de Meetup oficial da Cloud Native Computing Foundation (CNCF) em Maringá. Fomenta o aprendizado de tecnologias cloud-native, organiza grupos de estudo para certificações (KCNA, CKA, CKAD) e promove encontros entre estudantes e profissionais de SRE, DevOps e arquitetura de software.",
    location: "Maringá, PR",
    links: [
      { type: "website", label: "community.cncf.io", url: "https://community.cncf.io/cloud-native-maringa/" },
      { type: "whatsapp", label: "WhatsApp", url: "https://chat.whatsapp.com/DJeegYRE1SC1zQuW64Hmzn" },
    ],
    socialProfiles: [
      {
        platform: "cncf",
        handle: "cloud-native-maringa",
        url: "https://community.cncf.io/cloud-native-maringa/",
        countLabel: "membros",
        baselineCount: 3,
      },
    ],
    tags: ["cloud-native", "devops", "sre", "certificações"],
  },
];
