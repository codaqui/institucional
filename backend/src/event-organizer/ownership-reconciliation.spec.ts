import { dedupeScopes, scopeToDesignation } from './ownership-reconciliation';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';

describe('scopeToDesignation', () => {
  it('maps a wildcard to targetKey', () => {
    expect(scopeToDesignation('meetup:devparana:*', null)).toEqual({
      targetType: 'event',
      targetId: null,
      targetKey: 'meetup:devparana:*',
      designation: 'organizer',
    });
  });

  it('maps an existing activation to targetId', () => {
    const activation = { id: 'activation-1' } as ExternalEventActivation;
    expect(scopeToDesignation('meetup:devparana:123', activation)).toEqual({
      targetType: 'event',
      targetId: 'activation-1',
      targetKey: null,
      designation: 'organizer',
    });
  });

  it('deduplicates repeated scopes before dual-write', () => {
    expect(dedupeScopes(['a:b:c', 'a:b:c', 'a:b:*'])).toEqual(['a:b:c', 'a:b:*']);
  });
});
