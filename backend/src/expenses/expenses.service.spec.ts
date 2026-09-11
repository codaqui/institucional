import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { LedgerService } from '../ledger/ledger.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
  };
  let ledgerService: { recordTransaction: jest.Mock };

  const pendingExpense = (overrides: Partial<Expense> = {}) =>
    ({
      id: 'expense-1',
      description: 'Impressão de materiais',
      amount: 15000, // centavos
      targetProjectId: 'devparana',
      submittedByUserId: 'user-1',
      receiptUrl: 'https://drive.google.com/receipt',
      status: ExpenseStatus.PENDING,
      approvedByUserId: null,
      createdAt: new Date(),
      ...overrides,
    }) as Expense;

  beforeEach(async () => {
    expenseRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((e) => Promise.resolve(e)),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
    };
    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: LedgerService, useValue: ledgerService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('createExpense', () => {
    it('creates a pending expense and saves it', async () => {
      const result = await service.createExpense(
        'Impressão de materiais',
        15000,
        'devparana',
        'user-1',
        'https://drive.google.com/receipt',
      );

      expect(expenseRepo.create).toHaveBeenCalledWith({
        description: 'Impressão de materiais',
        amount: 15000,
        targetProjectId: 'devparana',
        submittedByUserId: 'user-1',
        receiptUrl: 'https://drive.google.com/receipt',
        status: ExpenseStatus.PENDING,
      });
      expect(expenseRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(ExpenseStatus.PENDING);
    });

    it('creates an expense without a receipt URL', async () => {
      await service.createExpense('Coffee break', 8000, 'tisocial', 'user-2');

      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ receiptUrl: undefined }),
      );
    });
  });

  describe('getExpenses', () => {
    it('returns expenses ordered by most recent first', async () => {
      const expenses = [pendingExpense(), pendingExpense({ id: 'expense-2' })];
      expenseRepo.find.mockResolvedValue(expenses);

      const result = await service.getExpenses();

      expect(expenseRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(expenses);
    });
  });

  describe('getExpenseById', () => {
    it('returns the expense when it exists', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      const result = await service.getExpenseById('expense-1');

      expect(expenseRepo.findOneBy).toHaveBeenCalledWith({ id: 'expense-1' });
      expect(result.id).toBe('expense-1');
    });

    it('throws NotFoundException when the expense does not exist', async () => {
      expenseRepo.findOneBy.mockResolvedValue(null);

      await expect(service.getExpenseById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the expense to the submitting user', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      const result = await service.getExpenseById('expense-1', 'user-1');

      expect(result.id).toBe('expense-1');
    });

    it('hides the expense from a different user (404, not 403)', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      await expect(
        service.getExpenseById('expense-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveExpense', () => {
    it('approves a pending expense by a different user', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      const result = await service.approveExpense('expense-1', 'user-2');

      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.approvedByUserId).toBe('user-2');
      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExpenseStatus.APPROVED }),
      );
    });

    it('rejects approving an expense that is not pending', async () => {
      expenseRepo.findOneBy.mockResolvedValue(
        pendingExpense({ status: ExpenseStatus.APPROVED }),
      );

      await expect(
        service.approveExpense('expense-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects self-approval (submitter cannot approve own expense)', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      await expect(
        service.approveExpense('expense-1', 'user-1'),
      ).rejects.toThrow('Você não pode aprovar suas próprias despesas.');
    });

    it('propagates NotFoundException for a missing expense', async () => {
      expenseRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.approveExpense('missing', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsPaid', () => {
    it('records the ledger transaction (community → external) and marks as paid', async () => {
      expenseRepo.findOneBy.mockResolvedValue(
        pendingExpense({ status: ExpenseStatus.APPROVED }),
      );

      const result = await service.markAsPaid('expense-1', 'ext-account-1');

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        'devparana', // source: virtual wallet (debit)
        'ext-account-1', // destination: external vendor account
        150, // amount em reais (15000 centavos)
        'Payment for expense: Impressão de materiais',
        'expense:expense-1',
      );
      expect(result.status).toBe(ExpenseStatus.PAID);
      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExpenseStatus.PAID }),
      );
    });

    it('rejects marking a pending expense as paid', async () => {
      expenseRepo.findOneBy.mockResolvedValue(pendingExpense());

      await expect(
        service.markAsPaid('expense-1', 'ext-account-1'),
      ).rejects.toThrow(BadRequestException);
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('rejects marking an already-paid expense again', async () => {
      expenseRepo.findOneBy.mockResolvedValue(
        pendingExpense({ status: ExpenseStatus.PAID }),
      );

      await expect(
        service.markAsPaid('expense-1', 'ext-account-1'),
      ).rejects.toThrow(BadRequestException);
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('propagates ledger errors and does not mark as paid', async () => {
      expenseRepo.findOneBy.mockResolvedValue(
        pendingExpense({ status: ExpenseStatus.APPROVED }),
      );
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('insufficient funds'),
      );

      await expect(
        service.markAsPaid('expense-1', 'ext-account-1'),
      ).rejects.toThrow('insufficient funds');
      expect(expenseRepo.save).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException for a missing expense', async () => {
      expenseRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.markAsPaid('missing', 'ext-account-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
