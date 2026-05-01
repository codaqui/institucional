import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReimbursementsService } from './reimbursements.service';
import {
  ReimbursementRequest,
  ReimbursementStatus,
} from './entities/reimbursement-request.entity';
import { LedgerService } from '../ledger/ledger.service';
import { AccountType } from '../ledger/entities/account.entity';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const mockReimbursement = (overrides = {}): Partial<ReimbursementRequest> => ({
  id: uuid(1),
  memberId: uuid(5),
  accountId: uuid(10),
  amount: 75,
  description: 'Uber para evento',
  receiptUrl: 'https://example.com/receipt.pdf',
  internalReceiptUrl: null,
  status: ReimbursementStatus.PENDING,
  reviewedById: null,
  reviewNote: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: {
    id: uuid(10),
    name: 'DevParaná',
    type: AccountType.VIRTUAL_WALLET,
    projectKey: 'devparana',
  } as any,
  ...overrides,
});

describe('ReimbursementsService', () => {
  let service: ReimbursementsService;
  let repo: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(99) })),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
      getOrCreateCommunityAccount: jest.fn().mockResolvedValue({
        id: uuid(20),
        name: 'Reembolsos Pagos',
        type: AccountType.EXPENSE,
      }),
      getAccountBalance: jest.fn().mockResolvedValue(1000),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReimbursementsService,
        { provide: getRepositoryToken(ReimbursementRequest), useValue: repo },
        { provide: LedgerService, useValue: ledgerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ReimbursementsService>(ReimbursementsService);
  });

  // ─── createRequest ────────────────────────────────────────────────────────

  describe('createRequest', () => {
    it('should create a pending reimbursement request', async () => {
      const dto = {
        accountId: uuid(10),
        amount: 75,
        description: 'Uber',
        receiptUrl: 'https://example.com/receipt.pdf',
      };

      await service.createRequest(uuid(5), dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: uuid(5),
          status: ReimbursementStatus.PENDING,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when receiptUrl is empty', async () => {
      await expect(
        service.createRequest(uuid(5), {
          accountId: uuid(10),
          amount: 75,
          description: 'Test',
          receiptUrl: '  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when amount is zero or negative', async () => {
      await expect(
        service.createRequest(uuid(5), {
          accountId: uuid(10),
          amount: 0,
          description: 'Test',
          receiptUrl: 'https://example.com/r.pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getMyRequests ────────────────────────────────────────────────────────

  describe('getMyRequests', () => {
    it('should return requests for a member', async () => {
      repo.find.mockResolvedValue([mockReimbursement()]);

      const result = await service.getMyRequests(uuid(5));

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { memberId: uuid(5) } }),
      );
    });
  });

  // ─── getAllRequests ────────────────────────────────────────────────────────

  describe('getAllRequests', () => {
    it('should return paginated results', async () => {
      repo.findAndCount.mockResolvedValue([[mockReimbursement()], 1]);

      const result = await service.getAllRequests(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // ─── approveRequest ───────────────────────────────────────────────────────

  describe('approveRequest', () => {
    it('should approve and create ledger transaction', async () => {
      const request = mockReimbursement();
      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(request) // ReimbursementRequest
          .mockResolvedValueOnce(request.account), // Account
        save: jest.fn().mockResolvedValue({
          ...request,
          status: ReimbursementStatus.APPROVED,
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      const result = await service.approveRequest(
        uuid(1),
        uuid(9), // different from memberId
        {
          internalReceiptUrl: 'https://drive.google.com/file/123',
          reviewNote: 'Looks good',
        },
      );

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(10),
        uuid(20),
        75,
        expect.stringContaining('Reembolso aprovado'),
        expect.stringContaining('reimbursement:'),
      );
      expect(result.status).toBe(ReimbursementStatus.APPROVED);
    });

    it('should throw when internalReceiptUrl is empty', async () => {
      await expect(
        service.approveRequest(uuid(1), uuid(9), {
          internalReceiptUrl: '  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when request not found', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      await expect(
        service.approveRequest(uuid(1), uuid(9), {
          internalReceiptUrl: 'https://drive.google.com/file/123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when request is not pending', async () => {
      const request = mockReimbursement({
        status: ReimbursementStatus.APPROVED,
      });
      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(request)
          .mockResolvedValueOnce(request.account),
      };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      await expect(
        service.approveRequest(uuid(1), uuid(9), {
          internalReceiptUrl: 'https://drive.google.com/file/123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for self-approval', async () => {
      const request = mockReimbursement({ memberId: uuid(9) }); // same as reviewer
      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(request)
          .mockResolvedValueOnce(request.account),
      };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      await expect(
        service.approveRequest(uuid(1), uuid(9), {
          internalReceiptUrl: 'https://drive.google.com/file/123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when insufficient balance', async () => {
      const request = mockReimbursement({ amount: 2000 });
      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(request)
          .mockResolvedValueOnce(request.account),
      };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );
      ledgerService.getAccountBalance.mockResolvedValue(100); // less than 2000

      await expect(
        service.approveRequest(uuid(1), uuid(9), {
          internalReceiptUrl: 'https://drive.google.com/file/123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── rejectRequest ────────────────────────────────────────────────────────

  describe('rejectRequest', () => {
    it('should reject with review note', async () => {
      const request = mockReimbursement();
      repo.findOne.mockResolvedValue(request);

      await service.rejectRequest(uuid(1), uuid(9), {
        reviewNote: 'Receipt is blurry',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReimbursementStatus.REJECTED,
          reviewedById: uuid(9),
        }),
      );
    });

    it('should throw when not pending', async () => {
      repo.findOne.mockResolvedValue(
        mockReimbursement({ status: ReimbursementStatus.APPROVED }),
      );

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: 'No' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when reviewNote is empty', async () => {
      repo.findOne.mockResolvedValue(mockReimbursement());

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: 'No' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── revertApproval ───────────────────────────────────────────────────────

  describe('revertApproval', () => {
    it('should revert approved request with ledger reversal', async () => {
      const request = mockReimbursement({
        status: ReimbursementStatus.APPROVED,
        reviewedById: uuid(9),
        internalReceiptUrl: 'https://drive.google.com/file/123',
      });
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(request),
        save: jest.fn().mockResolvedValue({
          ...request,
          status: ReimbursementStatus.PENDING,
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      const result = await service.revertApproval(uuid(1));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(20), // reimbursements account
        uuid(10), // original account
        75,
        expect.stringContaining('Estorno'),
        expect.stringContaining('reimbursement-reversal:'),
      );
      expect(result.status).toBe(ReimbursementStatus.PENDING);
    });

    it('should throw when not found', async () => {
      const mockManager = { findOne: jest.fn().mockResolvedValue(null) };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      await expect(service.revertApproval(uuid(1))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when not approved', async () => {
      const request = mockReimbursement({
        status: ReimbursementStatus.PENDING,
      });
      const mockManager = { findOne: jest.fn().mockResolvedValue(request) };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );

      await expect(service.revertApproval(uuid(1))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when ledger reversal fails', async () => {
      const request = mockReimbursement({
        status: ReimbursementStatus.APPROVED,
      });
      const mockManager = { findOne: jest.fn().mockResolvedValue(request) };
      dataSource.transaction.mockImplementation(async (cb: Function) =>
        cb(mockManager),
      );
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('Ledger fail'),
      );

      await expect(service.revertApproval(uuid(1))).rejects.toThrow(
        'Ledger fail',
      );
    });
  });

  // ─── deleteRequest ────────────────────────────────────────────────────────

  describe('deleteRequest', () => {
    it('should delete pending request without ledger reversal', async () => {
      repo.findOne.mockResolvedValue(mockReimbursement());

      await service.deleteRequest(uuid(1));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(uuid(1));
    });

    it('should create reversal before deleting approved request', async () => {
      repo.findOne.mockResolvedValue(
        mockReimbursement({ status: ReimbursementStatus.APPROVED }),
      );

      await service.deleteRequest(uuid(1));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(20),
        uuid(10),
        75,
        expect.stringContaining('Estorno'),
        expect.stringContaining('reimbursement-deletion:'),
      );
      expect(repo.delete).toHaveBeenCalledWith(uuid(1));
    });

    it('should throw when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteRequest(uuid(1))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not delete if ledger reversal fails', async () => {
      repo.findOne.mockResolvedValue(
        mockReimbursement({ status: ReimbursementStatus.APPROVED }),
      );
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('Ledger fail'),
      );

      await expect(service.deleteRequest(uuid(1))).rejects.toThrow(
        'Ledger fail',
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── getPublicInfo ────────────────────────────────────────────────────────

  describe('getPublicInfo', () => {
    it('should return sanitized public info', async () => {
      const request = {
        ...mockReimbursement(),
        member: { githubHandle: 'user1', name: 'User One', avatarUrl: 'url' },
        reviewedBy: {
          githubHandle: 'admin',
          name: 'Admin',
          avatarUrl: 'admin-url',
        },
      };
      repo.findOne.mockResolvedValue(request);

      const result = await service.getPublicInfo(uuid(1));

      expect(result.requester).toEqual({
        handle: 'user1',
        name: 'User One',
        avatarUrl: 'url',
      });
      expect(result.approver).toEqual({
        handle: 'admin',
        name: 'Admin',
        avatarUrl: 'admin-url',
      });
      expect(result.amount).toBe(75);
    });

    it('should throw when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getPublicInfo(uuid(1))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null member and reviewer', async () => {
      repo.findOne.mockResolvedValue({
        ...mockReimbursement(),
        member: null,
        reviewedBy: null,
      });

      const result = await service.getPublicInfo(uuid(1));

      expect(result.requester).toBeNull();
      expect(result.approver).toBeNull();
    });
  });
});
