import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { VendorPayment } from './entities/vendor-payment.entity';
import { VendorReceipt } from './entities/vendor-receipt.entity';
import { TransactionTemplate } from './entities/transaction-template.entity';
import { Account, AccountType } from '../ledger/entities/account.entity';
import { Member } from '../members/entities/member.entity';
import { LedgerService } from '../ledger/ledger.service';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

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
  registeredByUserId: uuid(9),
  occurredAt: new Date(),
  ...overrides,
});

const mockReceipt = (overrides = {}): Partial<VendorReceipt> => ({
  id: uuid(4),
  vendorId: uuid(2),
  destinationAccountId: uuid(1),
  amount: 25000,
  description: 'Repasse de ingressos',
  receiptUrl: null,
  internalReceiptUrl: null,
  registeredByUserId: uuid(9),
  occurredAt: new Date(),
  ...overrides,
});

const mockQB = () => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
});

describe('VendorsService', () => {
  let service: VendorsService;
  let vendorRepo: Record<string, jest.Mock>;
  let paymentRepo: Record<string, jest.Mock>;
  let receiptRepo: Record<string, jest.Mock>;
  let templateRepo: Record<string, jest.Mock>;
  let accountRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let ledgerService: Record<string, jest.Mock>;

  beforeEach(async () => {
    vendorRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d: Record<string, unknown>) => ({ ...d })),
      save: jest.fn((e: { id?: string } & Record<string, unknown>) =>
        Promise.resolve({ ...e, id: e.id ?? uuid(99) }),
      ),
    };
    paymentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((d: { id?: string } & Record<string, unknown>) => ({
        ...d,
        id: d.id ?? uuid(98),
      })),
      save: jest.fn((e: { id?: string } & Record<string, unknown>) =>
        Promise.resolve({ ...e, id: e.id ?? uuid(98) }),
      ),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => mockQB()),
    };
    receiptRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((d: { id?: string } & Record<string, unknown>) => ({
        ...d,
        id: d.id ?? uuid(97),
      })),
      save: jest.fn((e: { id?: string } & Record<string, unknown>) =>
        Promise.resolve({ ...e, id: e.id ?? uuid(97) }),
      ),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => mockQB()),
    };
    templateRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d: Record<string, unknown>) => ({ ...d })),
      save: jest.fn((e: { id?: string } & Record<string, unknown>) =>
        Promise.resolve({ ...e, id: e.id ?? uuid(96) }),
      ),
    };
    accountRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((d: Record<string, unknown>) => ({ ...d })),
      save: jest.fn((e: { id?: string } & Record<string, unknown>) =>
        Promise.resolve({ ...e, id: e.id ?? uuid(95) }),
      ),
    };
    memberRepo = {
      find: jest.fn().mockResolvedValue([]),
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
        { provide: getRepositoryToken(VendorReceipt), useValue: receiptRepo },
        {
          provide: getRepositoryToken(TransactionTemplate),
          useValue: templateRepo,
        },
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
      accountRepo.findOneBy.mockResolvedValue(
        mockAccount({ type: AccountType.EXTERNAL }),
      );

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
      accountRepo.findOneBy.mockResolvedValue(
        mockAccount({ type: AccountType.VIRTUAL_WALLET }),
      );

      await expect(
        service.createVendor({ name: 'V', accountId: uuid(1) }),
      ).rejects.toThrow('EXTERNAL');
    });

    it('should auto-create EXTERNAL account when no accountId', async () => {
      accountRepo.findOneBy.mockResolvedValue(null);
      accountRepo.save.mockResolvedValue({
        id: uuid(50),
        type: AccountType.EXTERNAL,
      });

      await service.createVendor({ name: 'Auto Vendor' });

      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: AccountType.EXTERNAL }),
      );
    });

    it('should reuse existing account by projectKey', async () => {
      accountRepo.findOneBy.mockResolvedValueOnce({ id: uuid(50) });

      await service.createVendor({ name: 'Auto Vendor' });

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
        expect.objectContaining({
          where: { isActive: true },
          order: { name: 'ASC' },
        }),
      );
    });
  });

  describe('findAllPublic', () => {
    it('should return only public fields', async () => {
      vendorRepo.find.mockResolvedValue([
        { id: uuid(1), name: 'V', document: null, website: null },
      ]);

      const result = await service.findAllPublic();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('findAllWithCounters', () => {
    it('should return empty when no vendors', async () => {
      vendorRepo.find.mockResolvedValue([]);
      const result = await service.findAllWithCounters();
      expect(result).toEqual([]);
    });

    it('should attach paymentCount and receiptCount per vendor', async () => {
      vendorRepo.find.mockResolvedValue([mockVendor()]);
      const pQB = mockQB();
      pQB.getRawMany.mockResolvedValue([{ vendorId: uuid(2), count: '3' }]);
      const rQB = mockQB();
      rQB.getRawMany.mockResolvedValue([{ vendorId: uuid(2), count: '2' }]);
      paymentRepo.createQueryBuilder.mockReturnValue(pQB);
      receiptRepo.createQueryBuilder.mockReturnValue(rQB);

      const result = await service.findAllWithCounters();

      expect(result[0].paymentCount).toBe(3);
      expect(result[0].receiptCount).toBe(2);
    });

    it('should default counters to 0 when vendor has no movements', async () => {
      vendorRepo.find.mockResolvedValue([mockVendor()]);
      const result = await service.findAllWithCounters();
      expect(result[0].paymentCount).toBe(0);
      expect(result[0].receiptCount).toBe(0);
    });
  });

  describe('updateVendor', () => {
    it('should update and save vendor', async () => {
      const vendor = mockVendor();
      vendorRepo.findOneBy.mockResolvedValue(vendor);

      await service.updateVendor(uuid(2), { name: 'Updated' });

      expect(vendor.name).toBe('Updated');
      expect(vendorRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.updateVendor(uuid(2), { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
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
      await expect(service.softDeleteVendor(uuid(2))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createPayment', () => {
    const dto = {
      vendorId: uuid(2),
      sourceAccountId: uuid(1),
      amount: 15000,
      description: 'Monthly payment',
    };

    it('should create payment and record ledger transaction', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      paymentRepo.findOneOrFail.mockResolvedValue(mockPayment());

      await service.createPayment(dto, uuid(9));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1),
        expect.any(String),
        150,
        expect.stringContaining('Pagamento a fornecedor'),
        expect.stringContaining('vendor-payment:'),
      );
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createPayment(dto, uuid(9))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when source account not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createPayment(dto, uuid(9))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when source account is EXTERNAL', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(
        mockAccount({ type: AccountType.EXTERNAL }),
      );

      await expect(service.createPayment(dto, uuid(9))).rejects.toThrow(
        'EXTERNAL',
      );
    });

    it('should rollback payment if ledger fails', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      paymentRepo.save.mockResolvedValue({ ...mockPayment(), id: uuid(3) });
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('Ledger fail'),
      );

      await expect(service.createPayment(dto, uuid(9))).rejects.toThrow(
        'Ledger fail',
      );

      expect(paymentRepo.delete).toHaveBeenCalledWith(uuid(3));
    });
  });

  describe('findPayments', () => {
    it('should return payments with registeredBy member info', async () => {
      paymentRepo.find.mockResolvedValue([mockPayment()]);
      memberRepo.find.mockResolvedValue([
        { id: uuid(9), name: 'Admin', avatarUrl: 'url', githubHandle: 'admin' },
      ]);

      const result = await service.findPayments();

      expect(result[0].registeredBy).toEqual({
        name: 'Admin',
        avatarUrl: 'url',
        githubHandle: 'admin',
      });
    });

    it('should handle payments with no matching member', async () => {
      paymentRepo.find.mockResolvedValue([mockPayment()]);
      memberRepo.find.mockResolvedValue([]);

      const result = await service.findPayments();

      expect(result[0].registeredBy).toBeUndefined();
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
      await expect(service.findPaymentById(uuid(3))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPaymentByReferenceId', () => {
    it('should return null for non-vendor-payment reference', async () => {
      const result = await service.findPaymentByReferenceId('other:123');
      expect(result).toBeNull();
    });

    it('should return null when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      const result = await service.findPaymentByReferenceId(
        'vendor-payment:' + uuid(3),
      );
      expect(result).toBeNull();
    });

    it('should return public payment data with registeredBy', async () => {
      const payment = {
        ...mockPayment(),
        vendor: { name: 'V', document: '123', website: null },
      };
      paymentRepo.findOne.mockResolvedValue(payment);
      memberRepo.find.mockResolvedValue([
        { id: uuid(9), name: 'Admin', avatarUrl: 'url', githubHandle: 'admin' },
      ]);

      const result = await service.findPaymentByReferenceId(
        'vendor-payment:' + uuid(3),
      );

      expect(result).toBeDefined();
      expect(result!.vendor).toEqual({
        name: 'V',
        document: '123',
        website: null,
      });
      expect(result!.registeredBy).toEqual({
        name: 'Admin',
        avatarUrl: 'url',
        githubHandle: 'admin',
      });
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
        uuid(10),
        uuid(1),
        expect.any(Number),
        expect.stringContaining('Estorno'),
        expect.stringContaining('vendor-payment-reversal:'),
      );
      expect(paymentRepo.delete).toHaveBeenCalledWith(uuid(3));
    });

    it('should throw when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.deletePayment(uuid(3))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not delete payment if ledger reversal fails', async () => {
      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment(),
        vendor: { ...mockVendor(), accountId: uuid(10) },
        sourceAccount: mockAccount(),
      });
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('Ledger fail'),
      );

      await expect(service.deletePayment(uuid(3))).rejects.toThrow(
        'Ledger fail',
      );
      expect(paymentRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECEIPTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createReceipt', () => {
    const dto = {
      vendorId: uuid(2),
      destinationAccountId: uuid(1),
      amount: 25000,
      description: 'Repasse Sympla',
    };

    it('should create receipt and record ledger transaction (vendor → destination)', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      receiptRepo.findOneOrFail.mockResolvedValue(mockReceipt());

      await service.createReceipt(dto, uuid(9));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1), // vendor.accountId
        uuid(1), // destinationAccountId (mesma conta no mock)
        250,
        expect.stringContaining('Recebimento de fornecedor'),
        expect.stringContaining('vendor-receipt:'),
      );
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createReceipt(dto, uuid(9))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when destination account is EXTERNAL', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(
        mockAccount({ type: AccountType.EXTERNAL }),
      );

      await expect(service.createReceipt(dto, uuid(9))).rejects.toThrow(
        'EXTERNAL',
      );
    });

    it('should rollback if ledger fails', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());
      receiptRepo.save.mockResolvedValue({ ...mockReceipt(), id: uuid(4) });
      ledgerService.recordTransaction.mockRejectedValue(
        new Error('Ledger fail'),
      );

      await expect(service.createReceipt(dto, uuid(9))).rejects.toThrow(
        'Ledger fail',
      );
      expect(receiptRepo.delete).toHaveBeenCalledWith(uuid(4));
    });
  });

  describe('findReceipts', () => {
    it('should return receipts with registeredBy', async () => {
      receiptRepo.find.mockResolvedValue([mockReceipt()]);
      memberRepo.find.mockResolvedValue([
        { id: uuid(9), name: 'Admin', avatarUrl: 'url', githubHandle: 'admin' },
      ]);

      const result = await service.findReceipts();

      expect(result[0].registeredBy?.name).toBe('Admin');
    });
  });

  describe('findReceiptByReferenceId', () => {
    it('should return null for non-vendor-receipt reference', async () => {
      const result = await service.findReceiptByReferenceId(
        'vendor-payment:' + uuid(4),
      );
      expect(result).toBeNull();
    });

    it('should resolve and return public data', async () => {
      receiptRepo.findOne.mockResolvedValue({
        ...mockReceipt(),
        vendor: { name: 'Sympla', document: null, website: null },
      });
      memberRepo.find.mockResolvedValue([]);

      const result = await service.findReceiptByReferenceId(
        'vendor-receipt:' + uuid(4),
      );

      expect(result?.vendor?.name).toBe('Sympla');
    });
  });

  describe('deleteReceipt', () => {
    it('should create reversal (destination → vendor) and delete', async () => {
      receiptRepo.findOne.mockResolvedValue({
        ...mockReceipt(),
        vendor: { ...mockVendor(), accountId: uuid(10) },
        destinationAccount: mockAccount(),
        destinationAccountId: uuid(1),
      });

      await service.deleteReceipt(uuid(4));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1), // destination
        uuid(10), // vendor (reverse)
        expect.any(Number),
        expect.stringContaining('Estorno'),
        expect.stringContaining('vendor-receipt-reversal:'),
      );
      expect(receiptRepo.delete).toHaveBeenCalledWith(uuid(4));
    });

    it('should throw when not found', async () => {
      receiptRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteReceipt(uuid(4))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createTemplate', () => {
    const dto = {
      name: 'Monthly',
      sourceAccountId: uuid(1),
      vendorId: uuid(2),
      amount: 5000,
      description: 'Monthly payment',
    };

    it('should create a template with default direction=payment', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());

      await service.createTemplate(dto, uuid(9));

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'payment',
          createdByUserId: uuid(9),
        }),
      );
    });

    it('should accept direction=receipt', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(mockAccount());

      await service.createTemplate({ ...dto, direction: 'receipt' }, uuid(9));

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'receipt' }),
      );
    });

    it('should throw when vendor not found', async () => {
      vendorRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createTemplate(dto, uuid(9))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when source account is EXTERNAL', async () => {
      vendorRepo.findOneBy.mockResolvedValue(mockVendor());
      accountRepo.findOneBy.mockResolvedValue(
        mockAccount({ type: AccountType.EXTERNAL }),
      );

      await expect(service.createTemplate(dto, uuid(9))).rejects.toThrow(
        'EXTERNAL',
      );
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
      await expect(
        service.updateTemplate(uuid(1), { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
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
      await expect(service.softDeleteTemplate(uuid(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
