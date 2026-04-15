import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { VendorPayment } from './entities/vendor-payment.entity';
import { TransactionTemplate } from './entities/transaction-template.entity';
import { Account, AccountType } from '../ledger/entities/account.entity';
import { Member } from '../members/entities/member.entity';
import { LedgerService } from '../ledger/ledger.service';

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

const mockAccount = (overrides = {}): Partial<Account> => ({
  id: uuid(1),
  name: 'Test Account',
  type: AccountType.VIRTUAL_WALLET,
  projectKey: 'test-account',
  ...overrides,
});

const mockVendor = (overrides = {}): Partial<Vendor> => ({
  id: uuid(2),
  name: 'Fornecedor Teste',
  document: '12345678901234',
  website: 'https://example.com',
  accountId: uuid(1),
  isActive: true,
  ...overrides,
});

const mockPayment = (overrides = {}): Partial<VendorPayment> => ({
  id: uuid(3),
  vendorId: uuid(2),
  sourceAccountId: uuid(1),
  amount: 15000,
  description: 'Pagamento mensal',
  receiptUrl: null,
  internalReceiptUrl: null,
  paidByUserId: uuid(9),
  paidAt: new Date(),
  ...overrides,
});

describe('VendorsService', () => {
  let service: VendorsService;
  let vendorRepo: Record<string, jest.Mock>;
  let paymentRepo: Record<string, jest.Mock>;
  let templateRepo: Record<string, jest.Mock>;
  let accountRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;

  beforeEach(async () => {
    vendorRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(99) })),
    };
    paymentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(98) })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    templateRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(97) })),
    };
    accountRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? uuid(96) })),
    };
    memberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: getRepositoryToken(Vendor), useValue: vendorRepo },
        { provide: getRepositoryToken(VendorPayment), useValue: paymentRepo },
        { provide: getRepositoryToken(TransactionTemplate), useValue: templateRepo },
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        { provide: LedgerService, useValue: ledgerService },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createVendor', () => {
    it('should create vendor with existing accountId', async () => {
      accountRepo.findOneBy.mockResolvedValue(mockAccount({ type: AccountType.EXTERNAL }));

      await service.createVendor({ name: 'New Vendor', accountId: uuid(1) });

      expect(vendorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Vendor', accountId: uuid(1) }),
      );
      expect(vendorRepo.save).toHaveBeenCalled();
    });

    it('should throw when accountId not found', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createVendor({ name: 'V', accountId: uuid(1) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when account is not EXTERNAL type', async () => {
      accountRepo.findOneBy.mockResolvedValue(mockAccount({ type: AccountType.VIRTUAL_WALLET }));

      await expect(
        service.createVendor({ name: 'V', accountId: uuid(1) }),
      ).rejects.toThrow('EXTERNAL');
    });

    it('should auto-create EXTERNAL account when no accountId', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);
      accountRepo.save.mockResolvedValue({ id: uuid(50), type: AccountType.EXTERNAL });

      await service.createVendor({ name: 'Auto Vendor' });

      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: AccountType.EXTERNAL }),
      );
    });

    it('should reuse existing account by projectKey', async () => {
      // When no accountId: first findOneBy is for projectKey
      accountRepo.findOneBy.mockResolvedValueOnce({ id: uuid(50) });

      await service.createVendor({ name: 'Auto Vendor' });

      // Should not create a new account since projectKey already exists
      expect(accountRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return active vendors sorted by name', async () => {
      const vendors = [mockVendor()];
      vendorRepo.find.mockResolvedValue(vendors);

      const result = await service.findAll();

      expect(result).toEqual(vendors);
      expect(vendorRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true }, order: { name: 'ASC' } }),
      );
    });
  });

  describe('findAllPublic', () => {
    it('should return only public fields', async () => {
      vendorRepo.find.mockResolvedValue([{ id: uuid(1), name: 'V', document: null, website: null }]);

      const result = await service.findAllPublic();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('updateVendor', () => {
    it('should update and save vendor', async () => {
      const vendor = mockVendor();
      vendorRepo.findOneBy.mockResolvedValue(vendor);

      const result = await service.updateVendor(uuid(2), { name: 'Updated' });

      expect(vendor.name).toBe('Updated');
      expect(vendorRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      await expect(service.updateVendor(uuid(2), { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteVendor', () => {
    it('should set isActive to false', async () => {
      const vendor = mockVendor();
      vendorRepo.findOneBy.mockResolvedValue(vendor);

      await service.softDeleteVendor(uuid(2));

      expect(vendor.isActive).toBe(false);
      expect(vendorRepo.save).toHaveBeenCalled();
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      await expect(service.softDeleteVendor(uuid(2))).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createPayment', () => {
    it('should create payment and record ledger transaction', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      paymentRepo.save.mockResolvedValue({ ...mockPayment(), id: uuid(3) });
      paymentRepo.findOneOrFail.mockResolvedValue(mockPayment());

      const dto = {
        vendorId: uuid(2),
        sourceAccountId: uuid(1),
        amount: 15000,
        description: 'Monthly payment',
      };

      const result = await service.createPayment(dto, uuid(9));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1),
        expect.any(String),
        150, // amount / 100
        expect.stringContaining('Pagamento a fornecedor'),
        expect.stringContaining('vendor-payment:'),
      );
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      accountRepo.findOneBy.mockResolvedValue(mockAccount());

      await expect(
        service.createPayment(
          { vendorId: uuid(2), sourceAccountId: uuid(1), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when source account not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createPayment(
          { vendorId: uuid(2), sourceAccountId: uuid(1), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when source account is EXTERNAL', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount({ type: AccountType.EXTERNAL }));

      await expect(
        service.createPayment(
          { vendorId: uuid(2), sourceAccountId: uuid(1), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow('inválida');
    });

    it('should rollback payment if ledger fails', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      paymentRepo.save.mockResolvedValue({ ...mockPayment(), id: uuid(3) });
      ledgerService.recordTransaction.mockRejectedValue(new Error('Ledger fail'));

      await expect(
        service.createPayment(
          { vendorId: uuid(2), sourceAccountId: uuid(1), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow('Ledger fail');

      expect(paymentRepo.delete).toHaveBeenCalledWith(uuid(3));
    });
  });

  describe('findPayments', () => {
    it('should return payments with paidBy member info', async () => {
      const payment = { ...mockPayment(), paidByUserId: uuid(9) };
      paymentRepo.find.mockResolvedValue([payment]);
      memberRepo.find.mockResolvedValue([
        { id: uuid(9), name: 'Admin', avatarUrl: 'url', githubHandle: 'admin' },
      ]);

      const result = await service.findPayments();

      expect(result[0].paidBy).toEqual({
        name: 'Admin',
        avatarUrl: 'url',
        githubHandle: 'admin',
      });
    });

    it('should handle payments with no matching member', async () => {
      paymentRepo.find.mockResolvedValue([{ ...mockPayment() }]);
      memberRepo.find.mockResolvedValue([]);

      const result = await service.findPayments();

      expect(result[0].paidBy).toBeUndefined();
    });
  });

  describe('findPaymentById', () => {
    it('should return payment with relations', async () => {
      const payment = mockPayment();
      paymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.findPaymentById(uuid(3));

      expect(result).toEqual(payment);
    });

    it('should throw when not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.findPaymentById(uuid(3))).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPaymentByReferenceId', () => {
    it('should return null for non-vendor-payment reference', async () => {
      const result = await service.findPaymentByReferenceId('other:123');
      expect(result).toBeNull();
    });

    it('should return null when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      const result = await service.findPaymentByReferenceId('vendor-payment:' + uuid(3));
      expect(result).toBeNull();
    });

    it('should return public payment data with paidBy', async () => {
      const payment = {
        ...mockPayment(),
        vendor: { name: 'V', document: '123', website: null },
        paidByUserId: uuid(9),
      };
      paymentRepo.findOne.mockResolvedValue(payment);
      memberRepo.findOne.mockResolvedValue({
        name: 'Admin',
        avatarUrl: 'url',
        githubHandle: 'admin',
      });

      const result = await service.findPaymentByReferenceId('vendor-payment:' + uuid(3));

      expect(result).toBeDefined();
      expect(result!.vendor).toEqual({ name: 'V', document: '123', website: null });
      expect(result!.paidBy).toEqual({ name: 'Admin', avatarUrl: 'url', githubHandle: 'admin' });
    });
  });

  describe('deletePayment', () => {
    it('should create reversal transaction and delete payment', async () => {
      const payment = {
        ...mockPayment(),
        vendor: { ...mockVendor(), accountId: uuid(10) },
        sourceAccount: mockAccount(),
        sourceAccountId: uuid(1),
      };
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.deletePayment(uuid(3));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(10), // vendor account (reversal: vendor → source)
        uuid(1),
        expect.any(Number),
        expect.stringContaining('Estorno'),
        expect.stringContaining('vendor-payment-reversal:'),
      );
      expect(paymentRepo.delete).toHaveBeenCalledWith(uuid(3));
    });

    it('should throw when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.deletePayment(uuid(3))).rejects.toThrow(NotFoundException);
    });

    it('should not delete payment if ledger reversal fails', async () => {
      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment(),
        vendor: { ...mockVendor(), accountId: uuid(10) },
        sourceAccount: mockAccount(),
      });
      ledgerService.recordTransaction.mockRejectedValue(new Error('Ledger fail'));

      await expect(service.deletePayment(uuid(3))).rejects.toThrow('Ledger fail');
      expect(paymentRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createTemplate', () => {
    it('should create a template', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());

      const dto = {
        name: 'Monthly',
        sourceAccountId: uuid(1),
        vendorId: uuid(2),
        amount: 5000,
        description: 'Monthly payment',
      };

      await service.createTemplate(dto, uuid(9));

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, createdByUserId: uuid(9) }),
      );
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      accountRepo.findOneBy.mockResolvedValue(mockAccount());

      await expect(
        service.createTemplate(
          { name: 'T', sourceAccountId: uuid(1), vendorId: uuid(2), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when source account is EXTERNAL', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount({ type: AccountType.EXTERNAL }));

      await expect(
        service.createTemplate(
          { name: 'T', sourceAccountId: uuid(1), vendorId: uuid(2), amount: 100, description: 'X' },
          uuid(9),
        ),
      ).rejects.toThrow('inválida');
    });
  });

  describe('findTemplates', () => {
    it('should return active templates', async () => {
      templateRepo.find.mockResolvedValue([]);
      const result = await service.findTemplates();
      expect(result).toEqual([]);
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      const template = { id: uuid(1), name: 'Old', isActive: true };
      templateRepo.findOneBy.mockResolvedValue(template);

      await service.updateTemplate(uuid(1), { name: 'New' });

      expect(template.name).toBe('New');
      expect(templateRepo.save).toHaveBeenCalled();
    });

    it('should throw when template not found', async () => {
      templateRepo.findOneBy.mockResolvedValue(null);
      await expect(service.updateTemplate(uuid(1), { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteTemplate', () => {
    it('should deactivate template', async () => {
      const template = { id: uuid(1), isActive: true };
      templateRepo.findOneBy.mockResolvedValue(template);

      await service.softDeleteTemplate(uuid(1));

      expect(template.isActive).toBe(false);
    });

    it('should throw when not found', async () => {
      templateRepo.findOneBy.mockResolvedValue(null);
      await expect(service.softDeleteTemplate(uuid(1))).rejects.toThrow(NotFoundException);
    });
  });
});
