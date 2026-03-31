import type { SocialProfile } from "./social-stats";

export interface SocialChannel {
  key: string;
  name: string;
  emoji: string;
  description: string;
  href: string;
  cta: string;
}

export const DISCORD_URL = "https://discord.com/invite/xuTtxqCPpz";
export const DISCORD_WIDGET_URL = "https://discord.com/api/guilds/829882821559451659/widget.json";
export const WHATSAPP_URL = "https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up";
export const EMAIL = "contato@codaqui.dev";
export const GITHUB_ORG = "https://github.com/codaqui";

/**
 * Perfis sociais da Codaqui — fonte de verdade para o sync de estatísticas.
 * Contagens baseLine são valores manuais usados como fallback.
 */
export const codaquiSocialProfiles: SocialProfile[] = [
  {
    platform: "discord",
    handle: "@codaqui",
    url: DISCORD_URL,
    countLabel: "membros",
    baselineCount: 692,
  },
  {
    platform: "whatsapp",
    handle: "Grupo Codaqui",
    url: WHATSAPP_URL,
    countLabel: "participantes",
    baselineCount: 0,
  },
  {
    platform: "youtube",
    handle: "@codaqui",
    url: "https://www.youtube.com/@codaqui",
    countLabel: "inscritos",
    baselineCount: 0,
  },
  {
    platform: "instagram",
    handle: "@codaqui.dev",
    url: "https://www.instagram.com/codaqui.dev/",
    countLabel: "seguidores",
    baselineCount: 0,
  },
  {
    platform: "github",
    handle: "codaqui",
    url: GITHUB_ORG,
    countLabel: "seguidores",
    baselineCount: 0,
  },
];

export const socialChannels: SocialChannel[] = [
  {
    key: "email",
    name: "E-mail",
    emoji: "📧",
    description: "Nos envie uma mensagem diretamente.",
    href: `mailto:${EMAIL}`,
    cta: EMAIL,
  },
  {
    key: "instagram",
    name: "Instagram",
    emoji: "📸",
    description: "Acompanhe nossa rotina e novidades.",
    href: "https://www.instagram.com/codaqui.dev/",
    cta: "@codaqui.dev",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    emoji: "💼",
    description: "Conecte-se com nossa equipe.",
    href: "https://www.linkedin.com/company/codaqui/",
    cta: "Codaqui",
  },
  {
    key: "twitter",
    name: "Twitter / X",
    emoji: "🐦",
    description: "Fique por dentro das atualizações.",
    href: "https://twitter.com/codaquidev",
    cta: "@codaquidev",
  },
  {
    key: "discord",
    name: "Discord",
    emoji: "💬",
    description: "Converse com participantes e mentores ao vivo.",
    href: DISCORD_URL,
    cta: "Entrar no servidor",
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    emoji: "📱",
    description: "Receba avisos e novidades do projeto.",
    href: WHATSAPP_URL,
    cta: "Entrar no grupo",
  },
];
