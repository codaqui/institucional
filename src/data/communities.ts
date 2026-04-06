export interface CommunityLink {
  type: "website" | "instagram" | "whatsapp" | "github";
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
    tags: ["mulheres", "inclusão", "empoderamento", "tech"],
  },
  {
    id: "campostechpg",
    name: "CamposTech",
    emoji: "💻",
    logo: "/img/campostech.svg",
    description:
      "Espaço colaborativo dedicado à inovação, tecnologia e empreendedorismo em Ponta Grossa. Fomenta conexões entre estudantes, profissionais, empresas e entusiastas.",
    location: "Ponta Grossa, PR",
    links: [
      { type: "website", label: "campostechpg.com.br", url: "https://campostechpg.com.br/" },
    ],
    tags: ["inovação", "empreendedorismo", "networking"],
  },
  {
    id: "tisocial",
    name: "TI Social",
    emoji: "🤝",
    logo: "/img/tisocial-white.png",
    description:
      "Projeto que une tecnologia e responsabilidade social, promovendo o acesso à educação digital para comunidades carentes da região de Maringá.",
    location: "Maringá, PR",
    links: [
      { type: "website", label: "tisocial.org.br", url: "https://tisocial.org.br" },
      { type: "instagram", label: "@tisocialmaringa", url: "https://www.instagram.com/tisocialmaringa" }
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
    tags: ["cloud-native", "devops", "sre", "certificações"],
  },
];
