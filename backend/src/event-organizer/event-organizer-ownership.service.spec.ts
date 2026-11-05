import { EventOrganizerOwnershipService } from './event-organizer-ownership.service';

describe('EventOrganizerOwnershipService', () => {
  it('groups canonical organizer designations in the legacy response shape', async () => {
    const qb = {
      distinct: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { memberId: 'member-1', githubHandle: 'octo', scope: 'meetup:devparana:*' },
        { memberId: 'member-1', githubHandle: 'octo', scope: 'meetup:devparana:123' },
      ]),
    };
    const designationsRepo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new EventOrganizerOwnershipService(
      {} as any,
      { findOne: jest.fn() } as any,
      { log: jest.fn() } as any,
      designationsRepo as any,
      {} as any,
    );

    await expect(service.getOrganizers()).resolves.toEqual({
      version: 1,
      ownerships: [{
        memberId: 'member-1',
        githubHandle: 'octo',
        scope: ['meetup:devparana:*', 'meetup:devparana:123'],
      }],
    });
  });

  describe('reconcile', () => {
    const actor = { sub: 'admin-1', roles: ['admin'] } as any;

    const createService = (query: jest.Mock) => {
      const manager: any = { query };
      manager.transaction = jest.fn((callback: (em: unknown) => unknown) => callback(manager));
      const service = new EventOrganizerOwnershipService(
        {} as any,
        { findOne: jest.fn() } as any,
        { log: jest.fn() } as any,
        {} as any,
        manager,
      );
      return { service, manager };
    };

    it('ends only legacy member+scope targetKeys when their activation appears', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([{ id: 'ended-target-key' }])
        .mockResolvedValueOnce([{ id: 'inserted-activation' }])
        .mockResolvedValueOnce([{ count: 0 }]);
      const { service } = createService(query);

      await expect(service.reconcile(actor)).resolves.toEqual({
        inserted: 1,
        alreadyPresent: 0,
        orphanedActivations: 0,
      });
      const updateSql = query.mock.calls[1][0] as string;
      expect(updateSql).toContain('FROM "event_organizer_ownerships" AS "o"');
      expect(updateSql).toContain('"o"."memberId" = "d"."memberId"');
      expect(updateSql).toContain('"scopeValue" = "d"."targetKey"');
      expect(updateSql).toContain('JOIN "external_event_activations" AS "a"');
    });

    it('preserves canonical-only targetKeys and reports activation divergence', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 1 }]);
      const { service } = createService(query);

      await expect(service.reconcile(actor)).resolves.toEqual({
        inserted: 0,
        alreadyPresent: 0,
        orphanedActivations: 1,
      });
      const orphanSql = query.mock.calls[3][0] as string;
      expect(orphanSql).toContain('NOT EXISTS');
      expect(orphanSql).toContain('"a"."eventKey" = ANY("o"."scope")');
    });

    it('is idempotent and counts every existing legacy scope as already present', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);
      const { service } = createService(query);

      await expect(service.reconcile(actor)).resolves.toEqual({
        inserted: 0,
        alreadyPresent: 2,
        orphanedActivations: 0,
      });
    });
  });
});
