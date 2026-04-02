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

export interface SocialStatEntry extends SocialProfile {
  /** ID da entidade dona do perfil: "codaqui", "devparana", etc. */
  entityId: string;
  /** Contagem atual (buscada via sync ou baseline) */
  count: number;
  /** Número total de canais do servidor (apenas para plataforma "discord") */
  channelCount?: number | null;
  /** ISO 8601 timestamp da última busca bem-sucedida */
  fetchedAt?: string;
  /** true quando count veio do baselineCount, não de uma API */
  isFallback: boolean;
}

export interface SocialStatsSnapshot {
  generatedAt: string;
  /** Total de eventos agregados (soma de todas as fontes em static/events) */
  totalEvents: number;
  profiles: SocialStatEntry[];
}

export const SOCIAL_STATS_URL = "/social-stats/index.json";
