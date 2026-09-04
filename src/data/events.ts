export type EventSourceType = "discord" | "meetup" | "ocgroups" | "internal" | "external";
export type EventStatus = "scheduled" | "active" | "completed" | "canceled";
export type EventEntityType = "stage_instance" | "voice" | "external";

export interface EventRecurrenceRule {
  start?: string;
  end?: string;
  frequency?: number;
  interval?: number;
  byWeekday?: number[];
  byMonth?: number[];
  byMonthDay?: number[];
  count?: number;
}

export interface EventSourceConfig {
  source: string;
  sourceId: string;
  type: EventSourceType;
  label: string;
  emoji: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  widgetUrl?: string;
  refreshStrategy?: string;
  generatedAt?: string;
}

export interface EventOrganizer {
  name: string;
  id?: string;
  photoUrl?: string;
}

export interface EventItem {
  id: string;
  title: string;
  summary: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  platform: string;
  host: string;
  location: string;
  href: string;
  tags: string[];
  ctaLabel: string;
  featured?: boolean;
  status?: EventStatus;
  entityType?: EventEntityType;
  userCount?: number;
  /** @deprecated Use `organizers` instead. Kept for backward compatibility with existing snapshots. */
  creatorName?: string;
  /** @deprecated Use `organizers` instead. Kept for backward compatibility with existing snapshots. */
  creatorId?: string;
  organizers?: EventOrganizer[];
  channelId?: string;
  recurrenceLabel?: string;
  recurrenceRule?: EventRecurrenceRule;
  imageUrl?: string;
}

export interface EventSummary extends EventItem {
  source: string;
  sourceId: string;
  sourceKey: string;
  itemPath: string;
  /** Indica que o sync aplicou override de metadados (tabela event_overrides do backend) a este evento. */
  hasOverride?: boolean;
}

export interface EventSourceSummary extends EventSourceConfig {
  sourceKey: string;
  indexPath: string;
  itemCount: number;
}

export interface EventIndexFile {
  generatedAt?: string;
  sources: EventSourceSummary[];
  events: EventSummary[];
}

export interface EventDetailFile {
  generatedAt?: string;
  source: EventSourceConfig;
  event: EventItem;
}

export const EVENTS_MANIFEST_URL = "/events/index.json";

