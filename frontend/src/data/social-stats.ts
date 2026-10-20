// Tipos portados de src/data/social-stats.ts (site Docusaurus) — apenas os
// tipos necessários para src/data/communities.ts. Constantes de sync
// (SOCIAL_STATS_URL, BASELINE_TOTAL_EVENTS) ficam fora desta fase.

export type SocialPlatform =
  | "discord"
  | "meetup"
  | "youtube"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "github"
  | "cncf"
  | "whatsapp"
  | "website";

export interface SocialProfile {
  /** Slug da plataforma */
  platform: SocialPlatform;
  /** Handle de exibição, ex.: "@codaqui" ou "developerparana" */
  handle: string;
  /** URL pública do perfil */
  url: string;
  /** Rótulo do contador, ex.: "inscritos", "seguidores", "membros" */
  countLabel: string;
  /** Valor de fallback manual — usado quando o sync não conseguir buscar */
  baselineCount?: number;
}
