import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransfersService } from './transfers.service';
import {
  AccountTransferRequest,
  TransferRequestStatus,
} from './entities/account-transfer-request.entity';
import { LedgerService } from '../ledger/ledger.service';

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const mockRequest = (overrides = {}): Partial<AccountTransferRequest> => ({
  id: uuid(1),
  requestedById: uuid(5),
  sourceAccountId: uuid(10),
  destinationAccountId: uuid(11),
  amount: 500,
  reason: 'Saldo insuficiente para reembolso',
  status: TransferRequestStatus.PENDING,
  reviewedById: null,
  reviewNote: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TransfersService', () => {
  let service: TransfersService;
  let repo: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(99) })),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };

    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: getRepositoryToken(AccountTransferRequest), useValue: repo },
        { provide: LedgerService, useValue: ledgerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  // ─── createTransferRequest ────────────────────────────────────────────────

  describe('createTransferRequest', () => {
    it('should create a pending transfer request', async () => {
      const dto = {
        sourceAccountId: uuid(10),
        destinationAccountId: uuid(11),
        amount: 500,
        reason: 'Need funds',
      };

      await service.createTransferRequest(uuid(5), dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedById: uuid(5),
          status: TransferRequestStatus.PENDING,
          amount: 500,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when amount is zero or negative', async () => {
      await expect(
        service.createTransferRequest(uuid(5), {
          sourceAccountId: uuid(10),
          destinationAccountId: uuid(11),
          amount: 0,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createTransferRequest(uuid(5), {
          sourceAccountId: uuid(10),
          destinationAccountId: uuid(11),
          amount: -1,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when source equals destination', async () => {
      await expect(
        service.createTransferRequest(uuid(5), {
          sourceAccountId: uuid(10),
          destinationAccountId: uuid(10),
          amount: 100,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when reason is empty', async () => {
      await expect(
        service.createTransferRequest(uuid(5), {
          sourceAccountId: uuid(10),
          destinationAccountId: uuid(11),
          amount: 100,
          reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getAllRequests ────────────────────────────────────────────────────────

  describe('getAllRequests', () => {
    it('should return paginated results', async () => {
      const requests = [mockRequest()];
      repo.findAndCount.mockResolvedValue([requests, 1]);

      const result = await service.getAllRequests(1, 20);

      expect(result).toEqual({
        data: requests,
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });
  });

  // ─── approveRequest ───────────────────────────────────────────────────────

  describe('approveRequest', () => {
    it('should approve pending request with ledger transaction', async () => {
      const request = mockRequest();
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(request),
        save: jest.fn().mockResolvedValue({
          ...request,
          status: TransferRequestStatus.APPROVED,
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: Function) => cb(mockManager));

      const result = await service.approveRequest(uuid(1), uuid(9), { reviewNote: 'OK' });

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(10),
        uuid(11),
        500,
        expect.stringContaining('Transferência interna aprovada'),
        `transfer:${uuid(1)}`,
      );
      expect(result.status).toBe(TransferRequestStatus.APPROVED);
    });

    it('should throw when request not found', async () => {
      const mockManager = { findOne: jest.fn().mockResolvedValue(null) };
      dataSource.transaction.mockImplementation(async (cb: Function) => cb(mockManager));

      await expect(
        service.approveRequest(uuid(1), uuid(9), {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when request is not pending', async () => {
      const request = mockRequest({ status: TransferRequestStatus.APPROVED });
      const mockManager = { findOne: jest.fn().mockResolvedValue(request) };
      dataSource.transaction.mockImplementation(async (cb: Function) => cb(mockManager));

      await expect(
        service.approveRequest(uuid(1), uuid(9), {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── rejectRequest ────────────────────────────────────────────────────────

  describe('rejectRequest', () => {
    it('should reject pending request with review note', async () => {
      const request = mockRequest();
      repo.findOne.mockResolvedValue(request);

      await service.rejectRequest(uuid(1), uuid(9), {
        reviewNote: 'Insufficient justification',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TransferRequestStatus.REJECTED,
          reviewedById: uuid(9),
          reviewNote: 'Insufficient justification',
        }),
      );
    });

    it('should throw when request not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: 'No' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when request is not pending', async () => {
      repo.findOne.mockResolvedValue(mockRequest({ status: TransferRequestStatus.APPROVED }));

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: 'No' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when reviewNote is empty', async () => {
      repo.findOne.mockResolvedValue(mockRequest());

      await expect(
        service.rejectRequest(uuid(1), uuid(9), { reviewNote: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
