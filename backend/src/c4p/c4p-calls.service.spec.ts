import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { C4pCallsService } from './c4p-calls.service';
import { DEFAULT_CRITERIA } from './c4p.constants';
import { C4pCall } from './entities/c4p-call.entity';

const actor = (roles: string[] = ['admin']): JwtPayload =>
  ({
    sub: 'actor-1',
    githubId: 1,
    handle: 'actor',
    name: 'Actor',
    email: 'actor@example.com',
    avatarUrl: null,
    roles,
  }) as JwtPayload;

const makeCall = (overrides: Partial<C4pCall> = {}): C4pCall =>
  ({
    id: 'call-1',
    slug: 'devpr-conf-2026',
    name: 'C4P DevPR Conf 2026',
    description: null,
    managedEventId: null,
    communityId: null,
    status: 'draft',
    submissionOpenAt: null,
    submissionCloseAt: null,
    criteria: DEFAULT_CRITERIA,
    selectedTalkIds: null,
    publicResults: false,
    finalizedAt: null,
    createdById: 'actor-1',
    ...overrides,
  }) as C4pCall;

describe('C4pCallsService', () => {
  let repo: Record<string, jest.Mock>;
  let talksRepo: Record<string, jest.Mock>;
  let votesRepo: Record<string, jest.Mock>;
  let memberDesignationsRepo: Record<string, jest.Mock>;
  let eventsRepo: Record<string, jest.Mock>;
  let communitiesRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let service: C4pCallsService;

  beforeEach(() => {
    repo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((dto) => dto),
      save: jest.fn((call) => Promise.resolve({ ...makeCall(), ...call })),
    };
    talksRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'talk-1' }]),
      countBy: jest.fn().mockResolvedValue(0),
    };
    votesRepo = {
      existsBy: jest.fn().mockResolvedValue(false),
      count: jest.fn().mockResolvedValue(0),
    };
    memberDesignationsRepo = {
      countBy: jest.fn().mockResolvedValue(0),
    };
    eventsRepo = { findOneBy: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    communitiesRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'community-1' }),
    };
    designations = { hasDesignation: jest.fn().mockResolvedValue(false) };
    emailService = { sendTemplate: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new C4pCallsService(
      repo as never,
      talksRepo as never,
      votesRepo as never,
      memberDesignationsRepo as never,
      eventsRepo as never,
      communitiesRepo as never,
      designations as never,
      emailService as never,
      audit as never,
    );
  });

  describe('create', () => {
    it('aplica DEFAULT_CRITERIA quando criteria ausente e grava createdById', async () => {
      const call = await service.create(
        { slug: 'devpr-conf-2026', name: 'C4P DevPR Conf 2026' },
        actor(),
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'devpr-conf-2026',
          criteria: DEFAULT_CRITERIA,
          createdById: 'actor-1',
          status: 'draft',
        }),
      );
      expect(call.criteria).toEqual(DEFAULT_CRITERIA);
    });

    it('rejeita slug reservado', async () => {
      await expect(
        service.create({ slug: 'public', name: 'Nome válido' }, actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita slug fora do padrão', async () => {
      await expect(
        service.create({ slug: 'DevPR', name: 'Nome válido' }, actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita slug duplicado com 409', async () => {
      repo.findOneBy.mockResolvedValue(makeCall());
      await expect(
        service.create({ slug: 'devpr-conf-2026', name: 'Outra' }, actor()),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita janela com fim anterior ou igual ao início', async () => {
      await expect(
        service.create(
          {
            slug: 'devpr-conf-2026',
            name: 'Nome válido',
            submissionOpenAt: '2026-12-02T00:00:00Z',
            submissionCloseAt: '2026-12-01T00:00:00Z',
          },
          actor(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita managedEventId inexistente', async () => {
      eventsRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          { slug: 'devpr-conf-2026', name: 'Nome', managedEventId: 'nope' },
          actor(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['key duplicada', [
        { key: 'a', label: 'A', weight: 1 },
        { key: 'a', label: 'B', weight: 1 },
      ]],
      ['peso zero', [{ key: 'a', label: 'A', weight: 0 }]],
      ['onze critérios', Array.from({ length: 11 }, (_, i) => ({ key: `c${i}`, label: `C${i}`, weight: 1 }))],
      ['key fora do padrão', [{ key: 'A-b', label: 'A', weight: 1 }]],
      ['label curta', [{ key: 'a', label: 'ab', weight: 1 }]],
    ])('rejeita critérios com %s', async (_label, criteria) => {
      await expect(
        service.create(
          { slug: 'devpr-conf-2026', name: 'Nome', criteria },
          actor(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('grava audit c4p_call.created com after', async () => {
      await service.create(
        { slug: 'devpr-conf-2026', name: 'C4P DevPR Conf 2026' },
        actor(),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.C4P_CALL_CREATED,
          actorId: 'actor-1',
          targetId: expect.any(String),
          details: expect.objectContaining({ after: expect.any(Object) }),
        }),
      );
    });
  });

  describe('update', () => {
    it('transiciona draft → open via PATCH', async () => {
      repo.findOneBy.mockResolvedValue(makeCall());
      const updated = await service.update('call-1', { status: 'open' }, actor());
      expect(updated.status).toBe('open');
    });

    it('rejeita voltar para draft', async () => {
      repo.findOneBy.mockResolvedValue(makeCall({ status: 'open' }));
      await expect(
        service.update('call-1', { status: 'draft' }, actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita fechar via PATCH (só via finalize)', async () => {
      repo.findOneBy.mockResolvedValue(makeCall({ status: 'open' }));
      await expect(
        service.update('call-1', { status: 'closed' }, actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita editar critérios quando já existem votos', async () => {
      repo.findOneBy.mockResolvedValue(makeCall({ status: 'open' }));
      votesRepo.existsBy.mockResolvedValue(true);
      await expect(
        service.update(
          'call-1',
          { criteria: [{ key: 'a', label: 'A', weight: 1 }] },
          actor(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('lança 404 para campanha inexistente', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(
        service.update('nope', { name: 'Novo nome' }, actor()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertCanManage', () => {
    it.each([['admin'], ['event_organizer'], ['diretor']])(
      'permite %s gerenciar',
      async (role) => {
        await expect(
          service.assertCanManage(makeCall(), actor([role])),
        ).resolves.toBeUndefined();
      },
    );

    it('permite responsável da comunidade dona da campanha', async () => {
      designations.hasDesignation.mockResolvedValue(true);
      await expect(
        service.assertCanManage(
          makeCall({ communityId: 'community-1' }),
          actor(['membro']),
        ),
      ).resolves.toBeUndefined();
      expect(designations.hasDesignation).toHaveBeenCalledWith('actor-1', {
        targetType: 'community',
        targetId: 'community-1',
        designation: 'responsible',
      });
    });

    it('nega responsável de outra comunidade', async () => {
      designations.hasDesignation.mockResolvedValue(false);
      await expect(
        service.assertCanManage(
          makeCall({ communityId: 'community-1' }),
          actor(['membro']),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nega membro sem papel em campanha sem comunidade', async () => {
      await expect(
        service.assertCanManage(makeCall(), actor(['membro'])),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listManage', () => {
    it('retorna envelope paginado', async () => {
      repo.findAndCount.mockResolvedValue([[makeCall()], 1]);
      const result = await service.listManage({ page: 1, limit: 50 }, actor());
      expect(result).toEqual({
        data: [
          expect.objectContaining({
            id: 'call-1',
            talksCount: 0,
            evaluatorsActiveCount: 0,
            votesCount: 0,
          }),
        ],
        total: 1,
        page: 1,
        totalPages: 1,
        limit: 50,
      });
    });

    it('inclui contagens de propostas, avaliadores ativos e votos por campanha', async () => {
      repo.findAndCount.mockResolvedValue([[makeCall()], 1]);
      talksRepo.countBy.mockResolvedValue(3);
      memberDesignationsRepo.countBy.mockResolvedValue(2);
      votesRepo.count.mockResolvedValue(4);
      const result = await service.listManage({ page: 1, limit: 50 }, actor());
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          talksCount: 3,
          evaluatorsActiveCount: 2,
          votesCount: 4,
        }),
      );
    });
  });

  describe('finalize', () => {
    const talks = [
      { id: 't1', callId: 'call-1', title: 'A', speakerEmail: 'a@example.com', speakerName: 'A' },
      { id: 't2', callId: 'call-1', title: 'B', speakerEmail: 'b@example.com', speakerName: 'B' },
      { id: 't3', callId: 'call-1', title: 'C', speakerEmail: null, speakerName: 'C' },
    ];

    beforeEach(() => {
      repo.findOneBy.mockResolvedValue(makeCall({ status: 'open' }));
      talksRepo.find.mockResolvedValue(talks);
    });

    it('rejeita event_organizer com 403 (finalização é só admin)', async () => {
      await expect(
        service.finalize('call-1', ['t1'], actor(['event_organizer'])),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deduplica e intersecta com as propostas da campanha', async () => {
      const call = await service.finalize(
        'call-1',
        ['t1', 't1', 't2', 'inexistente'],
        actor(),
      );
      expect(call.status).toBe('closed');
      expect(call.selectedTalkIds).toEqual(['t1', 't2']);
      expect(call.finalizedAt).toBeInstanceOf(Date);
    });

    it('rejeita quando nenhuma proposta válida resta', async () => {
      await expect(
        service.finalize('call-1', ['inexistente'], actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita finalizar campanha já fechada com 409', async () => {
      repo.findOneBy.mockResolvedValue(makeCall({ status: 'closed' }));
      await expect(service.finalize('call-1', ['t1'], actor())).rejects.toThrow(
        ConflictException,
      );
    });

    it('dispara e-mails de resultado fire-and-forget só para talks com e-mail', async () => {
      await service.finalize('call-1', ['t1'], actor());
      expect(emailService.sendTemplate).toHaveBeenCalledTimes(2);
      expect(emailService.sendTemplate).toHaveBeenCalledWith(
        'c4p-talk-result',
        'a@example.com',
        expect.objectContaining({ c4pResultStatus: 'aprovada' }),
        expect.any(Object),
      );
      expect(emailService.sendTemplate).toHaveBeenCalledWith(
        'c4p-talk-result',
        'b@example.com',
        expect.objectContaining({ c4pResultStatus: 'não aprovada' }),
        expect.any(Object),
      );
    });

    it('usa URL de resultado pública somente quando publicResults', async () => {
      repo.findOneBy.mockResolvedValue(
        makeCall({ status: 'open', publicResults: true }),
      );
      process.env.FRONTEND_URL = 'https://codaqui.dev';
      await service.finalize('call-1', ['t1'], actor());
      expect(emailService.sendTemplate).toHaveBeenCalledWith(
        'c4p-talk-result',
        'a@example.com',
        expect.objectContaining({
          c4pActionUrl: 'https://codaqui.dev/c4p/devpr-conf-2026/resultado',
        }),
        expect.any(Object),
      );
      delete process.env.FRONTEND_URL;
    });

    it('grava audit c4p_call.finalized', async () => {
      await service.finalize('call-1', ['t1'], actor());
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.C4P_CALL_FINALIZED }),
      );
    });
  });

  describe('reopen', () => {
    it('rejeita não admin com 403', async () => {
      await expect(
        service.reopen('call-1', actor(['diretor'])),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reabre limpando seleção e finalização, com audit', async () => {
      repo.findOneBy.mockResolvedValue(
        makeCall({
          status: 'closed',
          selectedTalkIds: ['t1'],
          finalizedAt: new Date(),
        }),
      );
      const call = await service.reopen('call-1', actor());
      expect(call.status).toBe('open');
      expect(call.selectedTalkIds).toBeNull();
      expect(call.finalizedAt).toBeNull();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.C4P_CALL_REOPENED }),
      );
    });
  });
});
