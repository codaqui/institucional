import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { C4pTalksService } from './c4p-talks.service';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';

const actor = (): JwtPayload =>
  ({
    sub: 'actor-1',
    githubId: 1,
    handle: 'actor',
    name: 'Actor',
    email: 'actor@example.com',
    avatarUrl: null,
    roles: ['admin'],
  }) as JwtPayload;

const makeCall = (): C4pCall =>
  ({ id: 'call-1', slug: 'devpr-conf-2026', status: 'open' }) as C4pCall;

const CSV_VALID = [
  'Nome,Título,Email',
  'João,Palestra A,joao@example.com',
  'Maria,Palestra B,maria@example.com',
  ',Sem título,',
].join('\n');

describe('C4pTalksService', () => {
  let callsService: Record<string, jest.Mock>;
  let talksRepo: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let service: C4pTalksService;

  beforeEach(() => {
    callsService = {
      getManage: jest.fn().mockResolvedValue(makeCall()),
      assertCanManage: jest.fn().mockResolvedValue(undefined),
    };
    talksRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((talks) =>
        Promise.resolve(
          Array.isArray(talks)
            ? talks.map((t, i) => ({ id: `talk-${i}`, ...t }))
            : { id: 'talk-1', ...talks },
        ),
      ),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOneBy: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new C4pTalksService(
      callsService as never,
      talksRepo as never,
      audit as never,
    );
  });

  describe('importCsv', () => {
    it('importa linhas válidas e reporta skipped', async () => {
      const result = await service.importCsv('call-1', CSV_VALID, actor());
      expect(result.imported).toBe(2);
      expect(result.skipped).toEqual([{ line: 4, reason: 'Nome do palestrante ausente.' }]);
      expect(talksRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ origin: 'csv_import', consentAt: null }),
        ]),
      );
    });

    it('converte erro estrutural do parser em BadRequest', async () => {
      await expect(
        service.importCsv('call-1', '', actor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('propaga 404 da campanha', async () => {
      callsService.getManage.mockRejectedValue(
        new NotFoundException('Campanha não encontrada.'),
      );
      await expect(
        service.importCsv('nope', CSV_VALID, actor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('propaga 403 de permissão', async () => {
      callsService.getManage.mockRejectedValue(
        new ForbiddenException('não'),
      );
      await expect(
        service.importCsv('call-1', CSV_VALID, actor()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('grava audit c4p_talk.imported', async () => {
      await service.importCsv('call-1', CSV_VALID, actor());
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.C4P_TALK_IMPORTED,
          details: expect.objectContaining({
            imported: 2,
            skipped: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('deleteTalk', () => {
    it('remove a proposta e grava audit', async () => {
      talksRepo.findOneBy.mockResolvedValue({ id: 'talk-1', callId: 'call-1' });
      await service.deleteTalk('call-1', 'talk-1', actor());
      expect(talksRepo.delete).toHaveBeenCalledWith({ id: 'talk-1' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.C4P_TALK_DELETED }),
      );
    });

    it('rejeita proposta de outra campanha com 404', async () => {
      talksRepo.findOneBy.mockResolvedValue({ id: 'talk-1', callId: 'outra' });
      await expect(
        service.deleteTalk('call-1', 'talk-1', actor()),
      ).rejects.toThrow(NotFoundException);
      expect(talksRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('listTalks', () => {
    it('retorna envelope paginado', async () => {
      const talk = { id: 'talk-1', callId: 'call-1' } as C4pTalk;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[talk], 1]),
      };
      talksRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.listTalks(
        'call-1',
        { page: 1, limit: 50 },
        actor(),
      );
      expect(result).toEqual({
        data: [talk],
        total: 1,
        page: 1,
        totalPages: 1,
        limit: 50,
      });
    });

    it('aplica filtro de busca por título ou palestrante', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      talksRepo.createQueryBuilder.mockReturnValue(qb);
      await service.listTalks(
        'call-1',
        { page: 1, limit: 50, search: 'typescript' },
        actor(),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%typescript%' }),
      );
    });
  });
});
