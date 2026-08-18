/**
 * Tipos compartilhados entre os sites das comunidades parceiras.
 *
 * Centralizamos aqui as interfaces de configuração para evitar duplicação
 * entre `comunidades/<slug>/community.config.ts`.
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
  /**
   * Imagem usada nos cards sociais (Open Graph / Twitter) quando a página da
   * comunidade é compartilhada. Preferir JPG/PNG de ~1200x630px.
   * Se omitida, fallback para `logoUrl`.
   */
  socialImage?: string;
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
  /**
   * Configuração visual opcional do hero com imagem de silhueta/background.
   * Se presente, a home renderiza o `CommunityHero` replicável em vez do hero
   * padrão de cor sólida.
   */
  heroVisual?: {
    imageSrc: string;
    imageAlt: string;
    imagePosition?: "left" | "right";
    blendColor?: string;
  };
  /** Cards de destaque na home da comunidade (impacto / números). */
  impact?: {
    title: string;
    subtitle?: string;
    stats: { value: string; label: string }[];
  };
  /**
   * SourceKeys de eventos que pertencem à comunidade (ex: ["meetup:devparana"]).
   * Usado pela home para filtrar e exibir os próximos eventos da comunidade.
   */
  eventSources?: string[];
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
