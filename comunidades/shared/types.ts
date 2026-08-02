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
  /** Cards de destaque na home da comunidade (impacto / números). */
  impact?: {
    title: string;
    subtitle?: string;
    stats: { value: string; label: string }[];
  };
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
