import { Test, TestingModule } from '@nestjs/testing';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { AuditService } from '../audit/audit.service';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('TransfersController', () => {
  let controller: TransfersController;
  let service: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createTransferRequest: jest.fn(),
      getAllRequests: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        { provide: TransfersService, useValue: service },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    controller = module.get<TransfersController>(TransfersController);
  });

  const req = {
    user: {
      sub: uuid(9),
      githubId: '99',
      handle: 'admin',
      name: 'Admin',
      email: 'a@a.com',
      avatarUrl: '',
      role: 'admin',
    },
  };

  describe('createTransferRequest', () => {
    it('should create request with user sub', async () => {
      service.createTransferRequest.mockResolvedValue({ id: uuid(1) });

      const dto = {
        sourceAccountId: uuid(10),
        destinationAccountId: uuid(11),
        amount: 500,
        reason: 'Need funds',
      };

      const result = await controller.createTransferRequest(req, dto);

      expect(result).toEqual({ id: uuid(1) });
      expect(service.createTransferRequest).toHaveBeenCalledWith(uuid(9), dto);
    });
  });

  describe('getAllRequests', () => {
    it('should return paginated requests with defaults', async () => {
      const expected = { data: [], total: 0, page: 1, totalPages: 0 };
      service.getAllRequests.mockResolvedValue(expected);

      const result = await controller.getAllRequests();

      expect(result).toEqual(expected);
      expect(service.getAllRequests).toHaveBeenCalledWith(1, 20);
    });

    it('should pass page and limit', async () => {
      service.getAllRequests.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        totalPages: 0,
      });
      await controller.getAllRequests(2, 10);
      expect(service.getAllRequests).toHaveBeenCalledWith(2, 10);
    });
  });

  describe('approveRequest', () => {
    it('should approve and log audit', async () => {
      const result = {
        id: uuid(1),
        amount: 500,
        reason: 'Test',
        status: 'approved',
      };
      service.approveRequest.mockResolvedValue(result);

      const response = await controller.approveRequest(uuid(1), req, {
        reviewNote: 'OK',
      });

      expect(response).toEqual(result);
      expect(service.approveRequest).toHaveBeenCalledWith(uuid(1), uuid(9), {
        reviewNote: 'OK',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'transfer.approved',
          actorId: uuid(9),
          targetId: uuid(1),
        }),
      );
    });
  });

  describe('rejectRequest', () => {
    it('should reject and log audit', async () => {
      const result = { id: uuid(1), status: 'rejected' };
      service.rejectRequest.mockResolvedValue(result);

      const response = await controller.rejectRequest(uuid(1), req, {
        reviewNote: 'Denied',
      });

      expect(response).toEqual(result);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'transfer.rejected',
          details: { reviewNote: 'Denied' },
        }),
      );
    });
  });
});
