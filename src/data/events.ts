export type EventSourceType = "discord" | "meetup" | "bevy" | "internal" | "external";
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
  creatorName?: string;
  creatorId?: string;
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

export interface EventSourceIndexFile {
  generatedAt?: string;
  source: EventSourceSummary;
  events: EventSummary[];
}

export interface EventDetailFile {
  generatedAt?: string;
  source: EventSourceConfig;
  event: EventItem;
}

export const EVENTS_MANIFEST_URL = "/events/index.json";

export function getEventSourceKey(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function getEventSourceIndexPath(source: string, sourceId: string): string {
  return `/events/${source}/${sourceId}/index.json`;
}

export function getEventItemPath(source: string, sourceId: string, eventId: string): string {
  return `/events/${source}/${sourceId}/${eventId}.json`;
}
