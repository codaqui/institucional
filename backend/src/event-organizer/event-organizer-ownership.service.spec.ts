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
});
