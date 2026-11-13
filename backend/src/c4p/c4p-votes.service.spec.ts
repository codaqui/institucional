import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { C4pVotesService } from './c4p-votes.service';
import { DEFAULT_CRITERIA } from './c4p.constants';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

const actor = (sub = 'eval-1'): JwtPayload =>
  ({
    sub,
    githubId: 2,
    handle: 'evaluator',
    name: 'Evaluator',
    email: 'eval@example.com',
    avatarUrl: null,
    roles: ['membro'],
  }) as JwtPayload;

const makeCall = (overrides: Partial<C4pCall> = {}): C4pCall =>
  ({
    id: 'call-1',
    slug: 'devpr-conf-2026',
    name: 'C4P DevPR',
    status: 'open',
    criteria: DEFAULT_CRITERIA,
    ...overrides,
  }) as C4pCall;

const makeTalk = (overrides: Partial<C4pTalk> = {}): C4pTalk =>
  ({
    id: 'talk-1',
    callId: 'call-1',
    title: 'Palestra A',
    summary: 'Resumo.',
    speakerName: 'Maria',
    ...overrides,
  }) as C4pTalk;

const activeDesignation = {
  id: 'des-1',
  memberId: 'eval-1',
  targetType: 'c4p_campaign',
  targetId: 'call-1',
  designation: 'evaluator',
  status: 'active',
};

describe('C4pVotesService', () => {
  let callsRepo: Record<string, jest.Mock>;
  let designationsRepo: Record<string, jest.Mock>;
  let talksRepo: Record<string, jest.Mock>;
  let votesRepo: Record<string, jest.Mock>;
  let service: C4pVotesService;

  beforeEach(() => {
    callsRepo = { findOneBy: jest.fn().mockResolvedValue(makeCall()) };
    designationsRepo = {
      findOne: jest.fn().mockResolvedValue(activeDesignation),
    };
    talksRepo = {
      find: jest.fn().mockResolvedValue([makeTalk()]),
      findOneBy: jest.fn().mockResolvedValue(makeTalk()),
    };
    votesRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((vote) => Promise.resolve({ id: 'vote-1', ...vote })),
    };
    service = new C4pVotesService(
      callsRepo as never,
      designationsRepo as never,
      talksRepo as never,
      votesRepo as never,
    );
  });

  const validDto = { scores: { relevancia: 8, viabilidade: 6 } };

  describe('upsert', () => {
    it('cria o voto quando ainda não existe', async () => {
      const vote = await service.upsert('call-1', 'talk-1', actor(), validDto);
      expect(votesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          talkId: 'talk-1',
          evaluatorDesignationId: 'des-1',
          scores: validDto.scores,
        }),
      );
      expect(vote.id).toBe('vote-1');
    });

    it('atualiza o voto existente sem criar nova linha', async () => {
      votesRepo.findOne.mockResolvedValue({
        id: 'vote-1',
        talkId: 'talk-1',
        evaluatorDesignationId: 'des-1',
        scores: { relevancia: 2 },
        comment: null,
      });
      const vote = await service.upsert('call-1', 'talk-1', actor(), {
        scores: { relevancia: 9 },
        comment: 'ótima',
      });
      expect(votesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vote-1', scores: { relevancia: 9 } }),
      );
      expect(vote.comment).toBe('ótima');
    });

    it('rejeita designation não ativa com 403', async () => {
      designationsRepo.findOne.mockResolvedValue({
        ...activeDesignation,
        status: 'pending',
      });
      await expect(
        service.upsert('call-1', 'talk-1', actor(), validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejeita avaliador removido com 403', async () => {
      designationsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsert('call-1', 'talk-1', actor(), validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejeita voto em campanha fechada com 409', async () => {
      callsRepo.findOneBy.mockResolvedValue(makeCall({ status: 'closed' }));
      await expect(
        service.upsert('call-1', 'talk-1', actor(), validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita talk de outra campanha com 404', async () => {
      talksRepo.findOneBy.mockResolvedValue(makeTalk({ callId: 'outra' }));
      await expect(
        service.upsert('call-1', 'talk-1', actor(), validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita critério desconhecido', async () => {
      await expect(
        service.upsert('call-1', 'talk-1', actor(), {
          scores: { inexistente: 5 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([[11], [-1], [1.5], ['8']])(
      'rejeita score inválido (%p)',
      async (score) => {
        await expect(
          service.upsert('call-1', 'talk-1', actor(), {
            scores: { relevancia: score as number },
          }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('rejeita scores vazio', async () => {
      await expect(
        service.upsert('call-1', 'talk-1', actor(), { scores: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita comentário acima de 2000 caracteres', async () => {
      await expect(
        service.upsert('call-1', 'talk-1', actor(), {
          ...validDto,
          comment: 'x'.repeat(2001),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listTalksForEvaluator', () => {
    it('embute myVote por proposta', async () => {
      talksRepo.find.mockResolvedValue([
        makeTalk({ id: 'talk-1' }),
        makeTalk({ id: 'talk-2', title: 'Palestra B' }),
      ]);
      votesRepo.find.mockResolvedValue([
        {
          talkId: 'talk-2',
          evaluatorDesignationId: 'des-1',
          scores: { relevancia: 7 },
          comment: 'boa',
          updatedAt: new Date('2026-11-10T00:00:00Z'),
        },
      ]);
      const talks = await service.listTalksForEvaluator('call-1', actor());
      expect(talks).toHaveLength(2);
      expect(talks[0].myVote).toBeNull();
      expect(talks[1].myVote).toEqual({
        scores: { relevancia: 7 },
        comment: 'boa',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('getEvaluatorCall', () => {
    it('retorna progresso voted/total coerente', async () => {
      talksRepo.find.mockResolvedValue([
        makeTalk({ id: 'talk-1' }),
        makeTalk({ id: 'talk-2' }),
        makeTalk({ id: 'talk-3' }),
      ]);
      votesRepo.find.mockResolvedValue([
        { talkId: 'talk-1', evaluatorDesignationId: 'des-1' },
        { talkId: 'talk-3', evaluatorDesignationId: 'des-1' },
      ]);
      const result = await service.getEvaluatorCall('call-1', actor());
      expect(result.progress).toEqual({ voted: 2, total: 3 });
      expect(result.call.id).toBe('call-1');
    });
  });
});
