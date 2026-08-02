import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventOrganizerService } from './event-organizer.service';
import type { JwtPayload } from '../auth/jwt.strategy';

const ORGANIZERS_DOC = {
  version: 1,
  ownerships: [
    {
      memberId: 'member-1',
      githubHandle: 'octo',
      scope: ['meetup:devparana:*'],
    },
    {
      memberId: 'member-3',
      githubHandle: 'other',
      scope: ['discord:codaqui:999'],
    },
  ],
};

const user = (overrides: Partial<JwtPayload>): JwtPayload =>
  ({
    sub: 'member-x',
    githubId: '1',
    handle: 'someone',
    name: 'Some One',
    email: 's@s.dev',
    avatarUrl: '',
    roles: ['membro'],
    ...overrides,
  }) as JwtPayload;

const organizerUser = user({
  sub: 'member-1',
  handle: 'octo',
  roles: ['membro', 'event_organizer'],
});
const scopedUser = user({
  sub: 'member-3',
  handle: 'other',
  roles: ['event_organizer'],
});
const plainUser = user({ sub: 'member-2', handle: 'newbie' });
const adminUser = user({ sub: 'admin-1', handle: 'boss', roles: ['admin'] });

describe('EventOrganizerService', () => {
  let service: EventOrganizerService;
  let ownershipService: Record<string, jest.Mock>;
  let membersService: Record<string, jest.Mock>;

  beforeEach(() => {
    ownershipService = {
      getOrganizers: jest.fn().mockResolvedValue(ORGANIZERS_DOC),
      getOwnedScopes: jest.fn(async (u: JwtPayload) => {
        const handle = u.handle?.toLowerCase();
        return ORGANIZERS_DOC.ownerships
          .filter(
            (o) => o.memberId === u.sub || o.githubHandle.toLowerCase() === handle,
          )
          .flatMap((o) => o.scope);
      }),
      canManage: jest.fn(async (u: JwtPayload, sourceKey: string, eventId: string) => {
        try {
          await service.assertCanManage(u, sourceKey, eventId);
          return { canManage: true };
        } catch {
          return { canManage: false };
        }
      }),
    };
    membersService = { findOne: jest.fn() };

    service = new EventOrganizerService(membersService as any, ownershipService as any);
  });

  // ── Organizers facade ─────────────────────────────────────────────────────

  describe('getOrganizers', () => {
    it('delegates to EventOrganizerOwnershipService', async () => {
      const result = await service.getOrganizers();
      expect(result).toEqual(ORGANIZERS_DOC);
      expect(ownershipService.getOrganizers).toHaveBeenCalled();
    });
  });

  describe('getOwnedScopes', () => {
    it('delegates to EventOrganizerOwnershipService', async () => {
      const result = await service.getOwnedScopes(organizerUser);
      expect(result).toEqual(['meetup:devparana:*']);
      expect(ownershipService.getOwnedScopes).toHaveBeenCalledWith(organizerUser);
    });
  });

  // ── Permission / scope matching ───────────────────────────────────────────

  describe('assertCanManage (scope matching)', () => {
    it('allows wildcard scope (meetup:devparana:*) for any event of the source', async () => {
      await expect(
        service.assertCanManage(organizerUser, 'meetup:devparana', '123'),
      ).resolves.toBeUndefined();
    });

    it('allows exact event scope (discord:codaqui:999)', async () => {
      await expect(
        service.assertCanManage(scopedUser, 'discord:codaqui', '999'),
      ).resolves.toBeUndefined();
    });

    it('rejects exact-scope owner managing a different event', async () => {
      await expect(
        service.assertCanManage(scopedUser, 'discord:codaqui', '123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects organizer managing another source', async () => {
      await expect(
        service.assertCanManage(organizerUser, 'sympla:elasnocodigo', '123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects member without event_organizer role', async () => {
      await expect(
        service.assertCanManage(plainUser, 'meetup:devparana', '123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin bypasses ownership checks', async () => {
      await expect(
        service.assertCanManage(adminUser, 'sympla:elasnocodigo', '123'),
      ).resolves.toBeUndefined();
    });

    it('matches ownership by githubHandle when memberId differs', async () => {
      const byHandle = user({
        sub: 'outro-uuid',
        handle: 'octo',
        roles: ['event_organizer'],
      });
      await expect(
        service.assertCanManage(byHandle, 'meetup:devparana', '123'),
      ).resolves.toBeUndefined();
    });
  });

  // ── canManage (probe booleano para UI) ─────────────────────────────────────

  describe('canManage', () => {
    it('returns true for admin', async () => {
      await expect(
        service.canManage(adminUser, 'sympla:elasnocodigo', '123'),
      ).resolves.toEqual({ canManage: true });
    });

    it('returns true for organizer with matching scope', async () => {
      await expect(
        service.canManage(organizerUser, 'meetup:devparana', '123'),
      ).resolves.toEqual({ canManage: true });
      await expect(
        service.canManage(scopedUser, 'discord:codaqui', '999'),
      ).resolves.toEqual({ canManage: true });
    });

    it('returns false for member without event_organizer role', async () => {
      await expect(
        service.canManage(plainUser, 'meetup:devparana', '123'),
      ).resolves.toEqual({ canManage: false });
    });

    it('returns false for organizer without matching scope', async () => {
      await expect(
        service.canManage(organizerUser, 'sympla:elasnocodigo', '123'),
      ).resolves.toEqual({ canManage: false });
    });
  });

  // ── extendData validation ─────────────────────────────────────────────────

  describe('assertValidExtendData validation', () => {
    const call = (extendData: any) =>
      EventOrganizerService.assertValidExtendData(extendData);

    it('rejects forbidden field (startAt) with 400', () => {
      expect(() => call({ startAt: '2026-01-01' })).toThrow(
        BadRequestException,
      );
      expect(() => call({ startAt: '2026-01-01' })).toThrow(
        'Campo proibido: extendData.startAt',
      );
    });

    it.each(['id', 'endAt', 'href', 'source', 'sourceId', 'status'])(
      'rejects forbidden field extendData.%s',
      (field) => {
        expect(() => call({ [field]: 'x' })).toThrow(BadRequestException);
      },
    );

    it('rejects summary over 500 chars', () => {
      expect(() => call({ summary: 'a'.repeat(501) })).toThrow(
        'excede 500 caracteres',
      );
    });

    it('rejects tags over 10 items and non-string tags', () => {
      expect(() =>
        call({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
      ).toThrow('excede 10 itens');
      expect(() => call({ tags: ['ok', 1] })).toThrow('array de strings');
    });

    it('rejects speakers over 10 items', () => {
      expect(() =>
        call({
          speakers: Array.from({ length: 11 }, (_, i) => ({ name: `s${i}` })),
        }),
      ).toThrow('excede 10 itens');
    });

    it('rejects non-boolean featured', () => {
      expect(() => call({ featured: 'yes' })).toThrow(BadRequestException);
    });

    it('rejects invalid workloadMinutes values', () => {
      expect(() => call({ workloadMinutes: -1 })).toThrow(BadRequestException);
      expect(() => call({ workloadMinutes: 3000 })).toThrow(
        BadRequestException,
      );
      expect(() => call({ workloadMinutes: '60' })).toThrow(
        BadRequestException,
      );
    });
  });
});
