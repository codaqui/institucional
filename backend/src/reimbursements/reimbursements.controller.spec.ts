import { Test, TestingModule } from '@nestjs/testing';
import { ReimbursementsController } from './reimbursements.controller';
import { ReimbursementsService } from './reimbursements.service';
import { AuditService } from '../audit/audit.service';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('ReimbursementsController', () => {
  let controller: ReimbursementsController;
  let service: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createRequest: jest.fn(),
      getMyRequests: jest.fn(),
      getAllRequests: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
      revertApproval: jest.fn(),
      deleteRequest: jest.fn(),
      getPublicInfo: jest.fn(),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReimbursementsController],
      providers: [
        { provide: ReimbursementsService, useValue: service },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    controller = module.get<ReimbursementsController>(ReimbursementsController);
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

  describe('getPublicInfo', () => {
    it('should return public reimbursement info', async () => {
      service.getPublicInfo.mockResolvedValue({ id: uuid(1), amount: 75 });
      const result = await controller.getPublicInfo(uuid(1));
      expect(result.id).toBe(uuid(1));
    });
  });

  describe('createRequest', () => {
    it('should create request with user sub', async () => {
      service.createRequest.mockResolvedValue({ id: uuid(1) });

      const dto = {
        accountId: uuid(10),
        amount: 75,
        description: 'Uber',
        receiptUrl: 'https://example.com/r.pdf',
      };

      await controller.createRequest(req, dto);

      expect(service.createRequest).toHaveBeenCalledWith(uuid(9), dto);
    });
  });

  describe('getMyRequests', () => {
    it('should return user requests', async () => {
      service.getMyRequests.mockResolvedValue([]);
      const result = await controller.getMyRequests(req);
      expect(result).toEqual([]);
      expect(service.getMyRequests).toHaveBeenCalledWith(uuid(9));
    });
  });

  describe('getAllRequests', () => {
    it('should return paginated requests', async () => {
      service.getAllRequests.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
      const result = await controller.getAllRequests();
      expect(result.total).toBe(0);
      expect(service.getAllRequests).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('approveRequest', () => {
    it('should approve and log audit', async () => {
      const result = {
        id: uuid(1),
        amount: 75,
        description: 'Uber',
        status: 'approved',
      };
      service.approveRequest.mockResolvedValue(result);

      const dto = { internalReceiptUrl: 'https://drive.google.com/file/123' };
      const response = await controller.approveRequest(uuid(1), req, dto);

      expect(response).toEqual(result);
      expect(service.approveRequest).toHaveBeenCalledWith(
        uuid(1),
        uuid(9),
        dto,
        'admin',
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reimbursement.approved',
          targetId: uuid(1),
        }),
      );
    });
  });

  describe('revertApproval', () => {
    it('should revert and log audit', async () => {
      const result = { id: uuid(1), amount: 75, description: 'Uber' };
      service.revertApproval.mockResolvedValue(result);

      const response = await controller.revertApproval(uuid(1), req);

      expect(response).toEqual(result);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reimbursement.reverted' }),
      );
    });
  });

  describe('deleteRequest', () => {
    it('should delete and log audit', async () => {
      service.deleteRequest.mockResolvedValue(undefined);

      const result = await controller.deleteRequest(uuid(1), req);

      expect(result).toEqual({ deleted: true });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reimbursement.deleted' }),
      );
    });
  });

  describe('rejectRequest', () => {
    it('should reject and log audit', async () => {
      const result = { id: uuid(1), status: 'rejected' };
      service.rejectRequest.mockResolvedValue(result);

      const dto = { reviewNote: 'Invalid receipt' };
      const response = await controller.rejectRequest(uuid(1), req, dto);

      expect(response).toEqual(result);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reimbursement.rejected',
          details: { reviewNote: 'Invalid receipt' },
        }),
      );
    });
  });
});
