export interface SocialChannel {
  key: string;
  name: string;
  emoji: string;
  description: string;
  href: string;
  cta: string;
}

export const DISCORD_URL = "https://discord.com/invite/xuTtxqCPpz";
export const WHATSAPP_URL = "https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up";
export const EMAIL = "contato@codaqui.dev";
export const GITHUB_ORG = "https://github.com/codaqui";

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
