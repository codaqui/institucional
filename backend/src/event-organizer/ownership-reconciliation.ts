import type { ExternalEventActivation } from '../events/entities/external-event-activation.entity';

export function dedupeScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes)];
}

export interface OrganizerDesignationTarget {
  targetType: 'event';
  targetId: string | null;
  targetKey: string | null;
  designation: 'organizer';
}

export function scopeToDesignation(
  scope: string,
  activation: Pick<ExternalEventActivation, 'id'> | null,
): OrganizerDesignationTarget {
  return {
    targetType: 'event',
    targetId: activation?.id ?? null,
    targetKey: activation ? null : scope,
    designation: 'organizer',
  };
}
