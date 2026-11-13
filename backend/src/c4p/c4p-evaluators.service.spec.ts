import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pCall } from './entities/c4p-call.entity';

const actor = (sub = 'actor-1'): JwtPayload =>
  ({
    sub,
    githubId: 1,
    handle: 'actor',
    name: 'Actor',
    email: 'actor@example.com',
    avatarUrl: null,
    roles: ['admin'],
  }) as JwtPayload;

const makeCall = (): C4pCall =>
  ({ id: 'call-1', slug: 'devpr-conf-2026', name: 'C4P DevPR', status: 'open' }) as C4pCall;

const makeDesignation = (
  overrides: Partial<MemberDesignation> = {},
): MemberDesignation =>
  ({
    id: 'des-1',
    memberId: 'member-1',
    targetType: 'c4p_campaign',
    targetId: 'call-1',
    targetKey: null,
    designation: 'evaluator',
    status: 'pending',
    appointedById: 'actor-1',
    since: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  }) as MemberDesignation;

const member = {
  id: 'member-1',
  githubHandle: 'maria',
  name: 'Maria',
  email: 'maria@example.com',
  avatarUrl: null,
  isActive: true,
};

describe('C4pEvaluatorsService', () => {
  let callsService: Record<string, jest.Mock>;
  let callsRepo: Record<string, jest.Mock>;
  let designationsRepo: Record<string, jest.Mock>;
  let membersRepo: Record<string, jest.Mock>;
  let designationsService: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let service: C4pEvaluatorsService;

  beforeEach(() => {
    callsService = { getManage: jest.fn().mockResolvedValue(makeCall()) };
    callsRepo = {
      findBy: jest.fn().mockResolvedValue([makeCall()]),
    };
    designationsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    membersRepo = {
      findOne: jest.fn().mockResolvedValue(member),
    };
    designationsService = {
      grant: jest.fn().mockResolvedValue(makeDesignation()),
      confirm: jest.fn().mockResolvedValue(makeDesignation({ status: 'active' })),
      revoke: jest.fn().mockResolvedValue(makeDesignation({ status: 'removed' })),
    };
    emailService = { sendTemplate: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new C4pEvaluatorsService(
      callsService as never,
      callsRepo as never,
      designationsRepo as never,
      membersRepo as never,
      designationsService as never,
      emailService as never,
      audit as never,
    );
  });

  describe('invite', () => {
    it('cria designation pending e envia convite por e-mail', async () => {
      const result = await service.invite(
        'call-1',
        { handleOrEmail: 'maria' },
        actor(),
      );
      expect(designationsService.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'member-1',
          targetType: 'c4p_campaign',
          targetId: 'call-1',
          designation: 'evaluator',
          status: 'pending',
          appointedById: 'actor-1',
        }),
        expect.any(Object),
      );
      expect(emailService.sendTemplate).toHaveBeenCalledWith(
        'c4p-evaluator-invite',
        'maria@example.com',
        expect.objectContaining({
          attendeeName: 'Maria',
          c4pCallName: 'C4P DevPR',
          c4pActionUrl: expect.stringContaining('/c4p/avaliar'),
        }),
        expect.any(Object),
      );
      expect(result.status).toBe('pending');
    });

    it('resolve por e-mail case-insensitive', async () => {
      await service.invite('call-1', { handleOrEmail: 'Maria@Example.com' }, actor());
      expect(membersRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ email: expect.anything() }),
          ]),
        }),
      );
    });

    it('retorna 404 para membro inexistente', async () => {
      membersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.invite('call-1', { handleOrEmail: 'nope' }, actor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna 404 para membro inativo', async () => {
      membersRepo.findOne.mockResolvedValue({ ...member, isActive: false });
      await expect(
        service.invite('call-1', { handleOrEmail: 'maria' }, actor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna 409 quando já é avaliador ativo', async () => {
      designationsRepo.findOne.mockResolvedValue(
        makeDesignation({ status: 'active' }),
      );
      await expect(
        service.invite('call-1', { handleOrEmail: 'maria' }, actor()),
      ).rejects.toThrow(ConflictException);
    });

    it('retorna a pendente existente sem novo grant nem e-mail', async () => {
      const existing = makeDesignation({ status: 'pending' });
      designationsRepo.findOne.mockResolvedValue(existing);
      const result = await service.invite(
        'call-1',
        { handleOrEmail: 'maria' },
        actor(),
      );
      expect(result).toBe(existing);
      expect(designationsService.grant).not.toHaveBeenCalled();
      expect(emailService.sendTemplate).not.toHaveBeenCalled();
    });

    it('cria nova pendente quando o vínculo anterior foi removido', async () => {
      designationsRepo.findOne.mockResolvedValue(
        makeDesignation({ status: 'removed' }),
      );
      await service.invite('call-1', { handleOrEmail: 'maria' }, actor());
      expect(designationsService.grant).toHaveBeenCalled();
    });

    it('grava audit c4p_evaluator.invited', async () => {
      await service.invite('call-1', { handleOrEmail: 'maria' }, actor());
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.C4P_EVALUATOR_INVITED }),
      );
    });
  });

  describe('accept', () => {
    it('confirma a própria designation pendente', async () => {
      designationsRepo.findOneBy.mockResolvedValue(
        makeDesignation({ memberId: 'actor-1', status: 'pending' }),
      );
      await service.accept('des-1', actor('actor-1'));
      expect(designationsService.confirm).toHaveBeenCalledWith('des-1', {
        actorId: 'actor-1',
        actorHandle: 'actor',
      });
    });

    it('retorna 404 para designation de outro membro', async () => {
      designationsRepo.findOneBy.mockResolvedValue(
        makeDesignation({ memberId: 'outro', status: 'pending' }),
      );
      await expect(
        service.accept('des-1', actor('actor-1')),
      ).rejects.toThrow(NotFoundException);
      expect(designationsService.confirm).not.toHaveBeenCalled();
    });

    it('retorna 409 quando não está pendente', async () => {
      designationsRepo.findOneBy.mockResolvedValue(
        makeDesignation({ memberId: 'actor-1', status: 'active' }),
      );
      await expect(
        service.accept('des-1', actor('actor-1')),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('revoga o avaliador e grava audit', async () => {
      designationsRepo.findOneBy.mockResolvedValue(makeDesignation());
      await service.remove('call-1', 'des-1', actor());
      expect(designationsService.revoke).toHaveBeenCalledWith('des-1', {
        actorId: 'actor-1',
        actorHandle: 'actor',
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.C4P_EVALUATOR_REMOVED }),
      );
    });

    it('retorna 404 para designation de outra campanha', async () => {
      designationsRepo.findOneBy.mockResolvedValue(
        makeDesignation({ targetId: 'outra' }),
      );
      await expect(
        service.remove('call-1', 'des-1', actor()),
      ).rejects.toThrow(NotFoundException);
      expect(designationsService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('myEvaluations', () => {
    it('lista designations pending/active do membro com dados da campanha', async () => {
      designationsRepo.find.mockResolvedValue([
        makeDesignation({ status: 'active' }),
        makeDesignation({ id: 'des-2', status: 'pending' }),
      ]);
      const result = await service.myEvaluations('member-1');
      expect(designationsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memberId: 'member-1',
            targetType: 'c4p_campaign',
            status: expect.anything(),
          }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        designationId: 'des-1',
        status: 'active',
        call: expect.objectContaining({ id: 'call-1', slug: 'devpr-conf-2026' }),
      });
    });
  });
});
