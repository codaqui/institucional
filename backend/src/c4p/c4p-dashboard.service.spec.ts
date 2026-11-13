import type { JwtPayload } from '../auth/jwt.strategy';
import { DEFAULT_CRITERIA } from './c4p.constants';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

const actor = (): JwtPayload =>
  ({
    sub: 'actor-1',
    handle: 'actor',
    roles: ['admin'],
  }) as JwtPayload;

const makeCall = (overrides: Partial<C4pCall> = {}): C4pCall =>
  ({
    id: 'call-1',
    slug: 'devpr-conf-2026',
    name: 'C4P DevPR',
    description: null,
    status: 'open',
    criteria: DEFAULT_CRITERIA,
    selectedTalkIds: null,
    publicResults: false,
    finalizedAt: null,
    submissionOpenAt: null,
    submissionCloseAt: null,
    managedEventId: null,
    communityId: null,
    ...overrides,
  }) as C4pCall;

const makeTalk = (overrides: Partial<C4pTalk> = {}): C4pTalk =>
  ({
    id: 'talk-1',
    callId: 'call-1',
    title: 'Palestra A',
    speakerName: 'Maria',
    speakerEmail: 'maria@example.com',
    track: 'Frontend',
    level: 'Iniciante',
    ...overrides,
  }) as C4pTalk;

const makeVote = (overrides: Partial<C4pVote> = {}): C4pVote =>
  ({
    id: 'vote-1',
    talkId: 'talk-1',
    evaluatorDesignationId: 'des-1',
    scores: { relevancia: 8, viabilidade: 6 },
    comment: null,
    updatedAt: new Date('2026-11-10T00:00:00Z'),
    ...overrides,
  }) as C4pVote;

const designations = [
  {
    id: 'des-1',
    memberId: 'member-1',
    status: 'active',
    since: new Date('2026-11-01T00:00:00Z'),
  },
  {
    id: 'des-2',
    memberId: 'member-2',
    status: 'active',
    since: new Date('2026-11-01T00:00:00Z'),
  },
  {
    id: 'des-3',
    memberId: 'member-3',
    status: 'removed',
    since: new Date('2026-11-01T00:00:00Z'),
  },
];

const members = [
  { id: 'member-1', name: 'Ana', githubHandle: 'ana' },
  { id: 'member-2', name: 'Bruno', githubHandle: 'bruno' },
  { id: 'member-3', name: 'Carla', githubHandle: 'carla' },
];

describe('C4pDashboardService', () => {
  let callsService: Record<string, jest.Mock>;
  let callsRepo: Record<string, jest.Mock>;
  let talksRepo: Record<string, jest.Mock>;
  let votesRepo: Record<string, jest.Mock>;
  let designationsRepo: Record<string, jest.Mock>;
  let membersRepo: Record<string, jest.Mock>;
  let communitiesRepo: Record<string, jest.Mock>;
  let eventsRepo: Record<string, jest.Mock>;
  let service: C4pDashboardService;

  beforeEach(() => {
    callsService = { getManage: jest.fn().mockResolvedValue(makeCall()) };
    callsRepo = {
      findOneBy: jest.fn().mockResolvedValue(makeCall()),
      find: jest.fn().mockResolvedValue([]),
    };
    talksRepo = {
      find: jest.fn().mockResolvedValue([
        makeTalk({ id: 'talk-1' }),
        makeTalk({ id: 'talk-2', title: 'Palestra B', track: null, level: null }),
        makeTalk({ id: 'talk-3', title: 'Palestra C' }),
      ]),
      findBy: jest.fn().mockResolvedValue([]),
    };
    votesRepo = {
      find: jest.fn().mockResolvedValue([
        makeVote({ id: 'v1', talkId: 'talk-1', evaluatorDesignationId: 'des-1', scores: { relevancia: 8, viabilidade: 6 } }),
        makeVote({ id: 'v2', talkId: 'talk-1', evaluatorDesignationId: 'des-2', scores: { relevancia: 6, viabilidade: 4 } }),
        makeVote({ id: 'v3', talkId: 'talk-2', evaluatorDesignationId: 'des-1', scores: { relevancia: 4 } }),
      ]),
    };
    designationsRepo = { find: jest.fn().mockResolvedValue(designations) };
    membersRepo = { findBy: jest.fn().mockResolvedValue(members) };
    communitiesRepo = { findBy: jest.fn().mockResolvedValue([]) };
    eventsRepo = { findBy: jest.fn().mockResolvedValue([]) };
    service = new C4pDashboardService(
      callsService as never,
      callsRepo as never,
      talksRepo as never,
      votesRepo as never,
      designationsRepo as never,
      membersRepo as never,
      communitiesRepo as never,
      eventsRepo as never,
    );
  });

  describe('dashboard', () => {
    it('calcula totais com expected = talks × avaliadores ativos', async () => {
      const result = await service.dashboard('call-1', actor());
      expect(result.totals).toEqual({
        talks: 3,
        evaluators: 2,
        votes: 3,
        expected: 6,
        completionPercent: 50,
      });
    });

    it('progresso por avaliador conta só votos das talks da campanha', async () => {
      const result = await service.dashboard('call-1', actor());
      expect(result.progressByEvaluator).toEqual([
        expect.objectContaining({
          designationId: 'des-1',
          member: { name: 'Ana', handle: 'ana' },
          done: 2,
          total: 3,
          complete: false,
        }),
        expect.objectContaining({
          designationId: 'des-2',
          member: { name: 'Bruno', handle: 'bruno' },
          done: 1,
          total: 3,
          complete: false,
        }),
      ]);
    });

    it('ranking ordena por média, sem voto por último, selected pela campanha', async () => {
      callsService.getManage.mockResolvedValue(
        makeCall({ selectedTalkIds: ['talk-2'] }),
      );
      const result = await service.dashboard('call-1', actor());
      expect(result.ranking.map((r) => r.talkId)).toEqual([
        'talk-1',
        'talk-2',
        'talk-3',
      ]);
      expect(result.ranking[0].avgTotal).toBeCloseTo(6);
      expect(result.ranking[0].votesCount).toBe(2);
      expect(result.ranking[1].selected).toBe(true);
      expect(result.ranking[2].avgTotal).toBeNull();
      expect(result.ranking.map((r) => r.position)).toEqual([1, 2, 3]);
    });

    it('criteriaAverages é a média das médias das talks com voto no critério', async () => {
      const result = await service.dashboard('call-1', actor());
      const relevancia = result.criteriaAverages.find(
        (c) => c.key === 'relevancia',
      );
      // talk-1 avg=7, talk-2 avg=4 → média 5.5
      expect(relevancia?.average).toBeCloseTo(5.5);
      const diversidade = result.criteriaAverages.find(
        (c) => c.key === 'diversidade',
      );
      expect(diversidade).toBeUndefined();
    });

    it('distribuições usam fallbacks para trilha e nível ausentes', async () => {
      const result = await service.dashboard('call-1', actor());
      expect(result.byTrack).toEqual([
        { value: 'Frontend', count: 2 },
        { value: 'Sem trilha', count: 1 },
      ]);
      expect(result.byLevel).toEqual([
        { value: 'Iniciante', count: 2 },
        { value: 'Não informado', count: 1 },
      ]);
    });
  });

  describe('report', () => {
    it('inclui ranking e votos com nome do avaliador e comentários', async () => {
      votesRepo.find.mockResolvedValue([
        makeVote({ id: 'v1', talkId: 'talk-1', evaluatorDesignationId: 'des-1', comment: 'ótima' }),
      ]);
      const result = await service.report('call-1', actor());
      expect(result.call.slug).toBe('devpr-conf-2026');
      expect(result.ranking.length).toBeGreaterThan(0);
      expect(result.votes).toEqual([
        {
          talkId: 'talk-1',
          evaluatorName: 'Ana',
          scores: { relevancia: 8, viabilidade: 6 },
          comment: 'ótima',
          updatedAt: expect.any(Date),
        },
      ]);
    });
  });

  describe('getSnapshot', () => {
    it('inclui abertas e fechadas com publicResults; results só quando fechada e pública', async () => {
      callsRepo.find.mockResolvedValue([
        makeCall({ id: 'call-1', status: 'open' }),
        makeCall({
          id: 'call-2',
          slug: 'fechada-publica',
          status: 'closed',
          publicResults: true,
          finalizedAt: new Date('2026-11-11T00:00:00Z'),
          selectedTalkIds: ['talk-9'],
        }),
      ]);
      talksRepo.findBy.mockResolvedValue([
        makeTalk({ id: 'talk-9', title: 'Aprovada', speakerEmail: 'privado@example.com' }),
      ]);
      const snapshot = await service.getSnapshot();
      // a query filtra open + closed/publicResults; fechadas privadas e
      // rascunhos nunca entram
      expect(callsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { status: 'open' },
            { status: 'closed', publicResults: true },
          ],
        }),
      );
      expect(snapshot.calls.map((c) => c.slug)).toEqual([
        'devpr-conf-2026',
        'fechada-publica',
      ]);
      const publica = snapshot.calls.find((c) => c.slug === 'fechada-publica');
      expect(publica?.results).toEqual({
        talks: [
          {
            title: 'Aprovada',
            speakerName: 'Maria',
            track: 'Frontend',
            level: 'Iniciante',
          },
        ],
      });
      const aberta = snapshot.calls.find((c) => c.slug === 'devpr-conf-2026');
      expect(aberta?.results).toBeNull();
    });

    it('nunca expõe scores, comentários ou e-mails no payload', async () => {
      callsRepo.find.mockResolvedValue([
        makeCall({
          id: 'call-2',
          status: 'closed',
          publicResults: true,
          selectedTalkIds: ['talk-9'],
        }),
      ]);
      talksRepo.findBy.mockResolvedValue([
        makeTalk({ id: 'talk-9', speakerEmail: 'privado@example.com' }),
      ]);
      const snapshot = await service.getSnapshot();
      const json = JSON.stringify(snapshot);
      expect(json).not.toContain('privado@example.com');
      expect(json).not.toContain('scores');
      expect(json).not.toContain('comment');
      expect(json).not.toContain('speakerEmail');
    });
  });
});
