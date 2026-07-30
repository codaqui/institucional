import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventOrganizerService } from './event-organizer.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
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
  let githubDb: Record<string, jest.Mock>;
  let membersService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  beforeEach(() => {
    githubDb = {
      readFile: jest.fn(async (path: string) =>
        path === 'static/events/organizers.json'
          ? JSON.stringify(ORGANIZERS_DOC)
          : null,
      ),
      createPRWithFile: jest
        .fn()
        .mockResolvedValue({ prNumber: 42, prUrl: 'https://pr/42' }),
      createPRWithFiles: jest
        .fn()
        .mockResolvedValue({ prNumber: 42, prUrl: 'https://pr/42' }),
      createPRDeleteFile: jest
        .fn()
        .mockResolvedValue({ prNumber: 43, prUrl: 'https://pr/43' }),
      findOpenPRByBranchPrefix: jest.fn().mockResolvedValue(null),
      getFileHistory: jest.fn().mockResolvedValue([]),
    };
    membersService = {
      findOne: jest.fn(),
      getGithubAccessToken: jest.fn().mockResolvedValue('gho_user-token'),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    service = new EventOrganizerService(
      githubDb as any,
      membersService as any,
      auditService as any,
    );
  });

  // ── Permission / scope matching ──────────────────────────────────────────

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

  // ── canManage (probe booleano para UI) ────────────────────────────────────

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

    it('returns false for invalid sourceKey/eventId (never throws)', async () => {
      await expect(
        service.canManage(adminUser, 'meetup:devparana:extra', '123'),
      ).resolves.toEqual({ canManage: false });
      await expect(
        service.canManage(adminUser, 'meetup:devparana', 'bad/id'),
      ).resolves.toEqual({ canManage: false });
    });
  });

  // ── extendData validation ────────────────────────────────────────────────

  describe('upsertOverride validation', () => {
    const call = (extendData: any) =>
      service.upsertOverride(
        'meetup:devparana',
        '123',
        { extendData },
        organizerUser,
      );

    it('rejects forbidden field (startAt) with 400 before calling GitHub', async () => {
      await expect(call({ startAt: '2026-01-01' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(call({ startAt: '2026-01-01' })).rejects.toThrow(
        'Campo proibido: extendData.startAt',
      );
      expect(githubDb.createPRWithFile).not.toHaveBeenCalled();
    });

    it.each(['id', 'endAt', 'href', 'source', 'sourceId', 'status'])(
      'rejects forbidden field extendData.%s',
      async (field) => {
        await expect(call({ [field]: 'x' })).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('rejects summary over 500 chars', async () => {
      await expect(call({ summary: 'a'.repeat(501) })).rejects.toThrow(
        'excede 500 caracteres',
      );
    });

    it('rejects tags over 10 items and non-string tags', async () => {
      await expect(
        call({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
      ).rejects.toThrow('excede 10 itens');
      await expect(call({ tags: ['ok', 1] })).rejects.toThrow(
        'array de strings',
      );
    });

    it('rejects speakers over 10 items', async () => {
      await expect(
        call({
          speakers: Array.from({ length: 11 }, (_, i) => ({ name: `s${i}` })),
        }),
      ).rejects.toThrow('excede 10 itens');
    });

    it('rejects non-boolean featured', async () => {
      await expect(call({ featured: 'yes' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid sourceKey and eventId formats', async () => {
      await expect(
        service.upsertOverride(
          'meetup:devparana:extra',
          '123',
          { extendData: {} },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.upsertOverride(
          'meetup:devparana',
          'bad/id',
          { extendData: {} },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── upsertOverride happy path ────────────────────────────────────────────

  describe('upsertOverride', () => {
    it('opens ONE PR with the override payload AND the manifest, and audits it', async () => {
      const result = await service.upsertOverride(
        'meetup:devparana',
        '123',
        { extendData: { summary: 'Resumo' }, reason: 'corrigir resumo' },
        organizerUser,
      );

      expect(result).toEqual({ prNumber: 42, prUrl: 'https://pr/42' });

      const call = githubDb.createPRWithFiles.mock.calls[0][0];
      expect(call.branch).toMatch(/^event-override\/meetup-devparana-123-\d+$/);
      expect(call.labels).toEqual(['event-override']);
      expect(call.userToken).toBe('gho_user-token');
      expect(call.commitMessage).toBe(
        'event: override 123 by @octo — corrigir resumo',
      );

      // 2 arquivos NO MESMO PR: o .override.json + o manifesto público
      expect(call.files).toHaveLength(2);
      const [overrideFile, manifestFile] = call.files;
      expect(overrideFile.path).toBe(
        'static/events/meetup/devparana/123.override.json',
      );
      expect(manifestFile.path).toBe('static/events/overrides-index.json');

      const written = JSON.parse(overrideFile.content);
      expect(written).toMatchObject({
        eventId: '123',
        sourceKey: 'meetup:devparana',
        extendData: { summary: 'Resumo' },
        ownerId: 'member-1',
        ownerHandle: 'octo',
        reason: 'corrigir resumo',
      });
      expect(typeof written.updatedAt).toBe('string');

      const manifest = JSON.parse(manifestFile.content);
      expect(manifest.version).toBe(1);
      expect(manifest.overrides['meetup:devparana:123']).toMatchObject({
        extendData: { summary: 'Resumo' },
        ownerHandle: 'octo',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_OVERRIDE_UPSERTED,
          actorId: 'member-1',
        }),
      );
    });

    it('preserva entradas existentes do manifesto ao upsertar', async () => {
      githubDb.readFile.mockImplementation(async (path: string) => {
        if (path === 'static/events/organizers.json')
          return JSON.stringify(ORGANIZERS_DOC);
        if (path === 'static/events/overrides-index.json')
          return JSON.stringify({
            version: 1,
            updatedAt: '2026-07-01T00:00:00.000Z',
            overrides: {
              'discord:codaqui:999': {
                extendData: { title: 'Outro' },
                ownerHandle: 'other',
                updatedAt: '2026-07-01T00:00:00.000Z',
              },
            },
          });
        return null;
      });

      await service.upsertOverride(
        'meetup:devparana',
        '123',
        { extendData: { summary: 'Novo' } },
        organizerUser,
      );

      const manifest = JSON.parse(
        githubDb.createPRWithFiles.mock.calls[0][0].files[1].content,
      );
      expect(Object.keys(manifest.overrides).sort()).toEqual([
        'discord:codaqui:999',
        'meetup:devparana:123',
      ]);
    });

    it('rejects non-owner without admin and does not call GitHub', async () => {
      await expect(
        service.upsertOverride(
          'meetup:devparana',
          '123',
          { extendData: {} },
          plainUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(githubDb.createPRWithFile).not.toHaveBeenCalled();
    });

    it('400 orientando re-login quando o membro não tem token do GitHub', async () => {
      membersService.getGithubAccessToken.mockResolvedValue(null);

      await expect(
        service.upsertOverride(
          'meetup:devparana',
          '123',
          { extendData: {} },
          organizerUser,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.upsertOverride(
          'meetup:devparana',
          '123',
          { extendData: {} },
          organizerUser,
        ),
      ).rejects.toThrow('login novamente');
      expect(githubDb.createPRWithFile).not.toHaveBeenCalled();
    });
  });

  // ── deleteOverride ───────────────────────────────────────────────────────

  describe('deleteOverride', () => {
    it('404s when the override does not exist', async () => {
      await expect(
        service.deleteOverride('meetup:devparana', '123', organizerUser),
      ).rejects.toThrow(NotFoundException);
      expect(githubDb.createPRWithFiles).not.toHaveBeenCalled();
    });

    it('opens ONE PR deleting the override AND its manifest entry', async () => {
      githubDb.readFile.mockImplementation(async (path: string) => {
        if (path === 'static/events/organizers.json')
          return JSON.stringify(ORGANIZERS_DOC);
        if (path === 'static/events/overrides-index.json')
          return JSON.stringify({
            version: 1,
            overrides: {
              'meetup:devparana:123': {
                extendData: { summary: 'X' },
                ownerHandle: 'octo',
                updatedAt: '2026-07-01T00:00:00.000Z',
              },
              'discord:codaqui:999': {
                extendData: {},
                ownerHandle: 'other',
                updatedAt: '2026-07-01T00:00:00.000Z',
              },
            },
          });
        return '{"eventId":"123"}';
      });

      const result = await service.deleteOverride(
        'meetup:devparana',
        '123',
        organizerUser,
      );

      expect(result).toEqual({ prNumber: 42, prUrl: 'https://pr/42' });
      const call = githubDb.createPRWithFiles.mock.calls[0][0];
      expect(call.files).toHaveLength(2);
      // delete do .override.json
      expect(call.files[0]).toEqual({
        path: 'static/events/meetup/devparana/123.override.json',
        content: null,
      });
      // manifesto sem a chave removida (demais preservadas)
      const manifest = JSON.parse(call.files[1].content);
      expect(manifest.overrides['meetup:devparana:123']).toBeUndefined();
      expect(manifest.overrides['discord:codaqui:999']).toBeDefined();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_OVERRIDE_DELETED,
        }),
      );
    });
  });

  // ── getOverride (público) ────────────────────────────────────────────────

  describe('getOverride', () => {
    it('404s when there is no override', async () => {
      await expect(
        service.getOverride('meetup:devparana', '123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns parsed override and caches it for 5 min', async () => {
      githubDb.readFile.mockResolvedValue('{"eventId":"123"}');

      const first = await service.getOverride('meetup:devparana', '123');
      const second = await service.getOverride('meetup:devparana', '123');

      expect(first).toEqual({ eventId: '123' });
      expect(second).toEqual({ eventId: '123' });
      expect(githubDb.readFile).toHaveBeenCalledTimes(1);
    });
  });

  // ── getOverridePR ────────────────────────────────────────────────────────

  describe('getOverridePR', () => {
    it('404s when no PR is open', async () => {
      await expect(
        service.getOverridePR('meetup:devparana', '123', organizerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the open PR via branch-prefix lookup', async () => {
      githubDb.findOpenPRByBranchPrefix.mockResolvedValue({
        number: 7,
        state: 'open',
        mergedAt: null,
        prUrl: 'u7',
      });

      const pr = await service.getOverridePR(
        'meetup:devparana',
        '123',
        organizerUser,
      );

      expect(pr).toMatchObject({ number: 7 });
      expect(githubDb.findOpenPRByBranchPrefix).toHaveBeenCalledWith(
        'event-override/meetup-devparana-123-',
        'gho_user-token',
      );
    });
  });

  // ── getOverrideHistory ───────────────────────────────────────────────────

  describe('getOverrideHistory', () => {
    it('delega ao githubDb com o path do override e o token do membro', async () => {
      const entries = [
        {
          sha: 'abc',
          message: 'event: override 123 by @octo — fix',
          authorHandle: 'octo',
          authorAvatarUrl: 'https://avatars/octo',
          date: '2026-07-29T10:00:00Z',
          url: 'https://github.com/codaqui/institucional/commit/abc',
        },
      ];
      githubDb.getFileHistory.mockResolvedValue(entries);

      const result = await service.getOverrideHistory(
        'meetup:devparana',
        '123',
        organizerUser,
      );

      expect(result).toEqual(entries);
      expect(githubDb.getFileHistory).toHaveBeenCalledWith(
        'static/events/meetup/devparana/123.override.json',
        'gho_user-token',
      );
      expect(membersService.getGithubAccessToken).toHaveBeenCalledWith(
        organizerUser.sub,
      );
    });

    it('sem token do membro → chama sem token (repo público); sem commits → []', async () => {
      membersService.getGithubAccessToken.mockResolvedValue(null);
      githubDb.getFileHistory.mockResolvedValue([]);

      const result = await service.getOverrideHistory(
        'meetup:devparana',
        '123',
        organizerUser,
      );

      expect(result).toEqual([]);
      expect(githubDb.getFileHistory).toHaveBeenCalledWith(
        'static/events/meetup/devparana/123.override.json',
        null,
      );
    });

    it('sourceKey inválido → 400', async () => {
      await expect(
        service.getOverrideHistory('meetup', '123', organizerUser),
      ).rejects.toThrow(BadRequestException);
      expect(githubDb.getFileHistory).not.toHaveBeenCalled();
    });
  });

  // ── Organizers CRUD ──────────────────────────────────────────────────────

  describe('addOwnership', () => {
    it('404s when member does not exist', async () => {
      membersService.findOne.mockResolvedValue(null);
      await expect(
        service.addOwnership(
          { memberId: 'member-9', githubHandle: 'ghost', scope: ['a:b:*'] },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('400s when githubHandle diverges from the member record', async () => {
      membersService.findOne.mockResolvedValue({
        id: 'member-1',
        githubHandle: 'octo',
      });
      await expect(
        service.addOwnership(
          { memberId: 'member-1', githubHandle: 'not-octo', scope: ['a:b:*'] },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('upserts ownership and opens a PR flagged as manual-merge', async () => {
      membersService.findOne.mockResolvedValue({
        id: 'member-1',
        githubHandle: 'octo',
      });

      const result = await service.addOwnership(
        {
          memberId: 'member-1',
          githubHandle: 'octo',
          scope: ['meetup:devparana:*', 'discord:codaqui:555'],
        },
        adminUser,
      );

      expect(result).toEqual({
        prNumber: 42,
        prUrl: 'https://pr/42',
        requiresManualMerge: false,
      });

      const call = githubDb.createPRWithFile.mock.calls[0][0];
      expect(call.path).toBe('static/events/organizers.json');
      expect(call.branch).toMatch(/^organizers\/member-1-\d+$/);

      const written = JSON.parse(call.content);
      // upsert: substitui a entrada do member-1, preserva a do member-3
      expect(written.ownerships).toHaveLength(2);
      expect(
        written.ownerships.find((o: any) => o.memberId === 'member-1').scope,
      ).toEqual(['meetup:devparana:*', 'discord:codaqui:555']);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_ORGANIZER_GRANTED,
          targetId: 'member-1',
        }),
      );
    });
  });

  describe('removeOwnership', () => {
    it('404s when there is no ownership for the member', async () => {
      await expect(
        service.removeOwnership('member-9', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('removes ownership and opens a PR', async () => {
      const result = await service.removeOwnership('member-1', adminUser);

      expect(result.requiresManualMerge).toBe(false);
      const written = JSON.parse(
        githubDb.createPRWithFile.mock.calls[0][0].content,
      );
      expect(
        written.ownerships.some((o: any) => o.memberId === 'member-1'),
      ).toBe(false);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_ORGANIZER_REVOKED,
        }),
      );
    });
  });
});
