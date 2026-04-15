import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('VendorsController', () => {
  let controller: VendorsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAllPublic: jest.fn(),
      findAll: jest.fn(),
      createVendor: jest.fn(),
      updateVendor: jest.fn(),
      softDeleteVendor: jest.fn(),
      findPayments: jest.fn(),
      findPaymentById: jest.fn(),
      findPaymentByReferenceId: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      findTemplates: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      softDeleteTemplate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController],
      providers: [{ provide: VendorsService, useValue: service }],
    }).compile();

    controller = module.get<VendorsController>(VendorsController);
  });

  const req = {
    user: { sub: uuid(9), githubId: '99', handle: 'admin', name: 'Admin', email: 'a@a.com', avatarUrl: '', role: 'admin' },
  };

  describe('getPublicVendors', () => {
    it('should delegate to findAllPublic', async () => {
      service.findAllPublic.mockResolvedValue([]);
      const result = await controller.getPublicVendors();
      expect(result).toEqual([]);
    });
  });

  describe('getVendors', () => {
    it('should delegate to findAll', async () => {
      service.findAll.mockResolvedValue([{ id: uuid(1), name: 'V' }]);
      const result = await controller.getVendors();
      expect(result).toHaveLength(1);
    });
  });

  describe('createVendor', () => {
    it('should create a vendor', async () => {
      service.createVendor.mockResolvedValue({ id: uuid(1), name: 'New' });
      const result = await controller.createVendor({ name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('updateVendor', () => {
    it('should update a vendor', async () => {
      service.updateVendor.mockResolvedValue({ id: uuid(1), name: 'Updated' });
      const result = await controller.updateVendor(uuid(1), { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteVendor', () => {
    it('should soft delete a vendor', async () => {
      service.softDeleteVendor.mockResolvedValue(undefined);
      await controller.deleteVendor(uuid(1));
      expect(service.softDeleteVendor).toHaveBeenCalledWith(uuid(1));
    });
  });

  describe('getPayments', () => {
    it('should list payments', async () => {
      service.findPayments.mockResolvedValue([]);
      const result = await controller.getPayments();
      expect(result).toEqual([]);
    });
  });

  describe('getPayment', () => {
    it('should get a single payment', async () => {
      service.findPaymentById.mockResolvedValue({ id: uuid(3) });
      const result = await controller.getPayment(uuid(3));
      expect(result.id).toBe(uuid(3));
    });
  });

  describe('getPaymentByReference', () => {
    it('should validate reference format', () => {
      expect(() => controller.getPaymentByReference('bad-format')).toThrow(BadRequestException);
    });

    it('should accept valid reference format', async () => {
      service.findPaymentByReferenceId.mockResolvedValue({ id: uuid(3) });
      const validRef = `vendor-payment:${uuid(3)}`;
      const result = await controller.getPaymentByReference(validRef);
      expect(result).toBeDefined();
    });
  });

  describe('createPayment', () => {
    it('should create payment with user sub', async () => {
      service.createPayment.mockResolvedValue({ id: uuid(3) });

      const dto = { vendorId: uuid(2), sourceAccountId: uuid(1), amount: 100, description: 'Test' };
      await controller.createPayment(dto, req);

      expect(service.createPayment).toHaveBeenCalledWith(dto, uuid(9));
    });
  });

  describe('deletePayment', () => {
    it('should delete payment', async () => {
      service.deletePayment.mockResolvedValue(undefined);
      await controller.deletePayment(uuid(3));
      expect(service.deletePayment).toHaveBeenCalledWith(uuid(3));
    });
  });

  describe('templates', () => {
    it('should list templates', async () => {
      service.findTemplates.mockResolvedValue([]);
      const result = await controller.getTemplates();
      expect(result).toEqual([]);
    });

    it('should create a template with user sub', async () => {
      service.createTemplate.mockResolvedValue({ id: uuid(1) });
      const dto = { name: 'T', sourceAccountId: uuid(1), vendorId: uuid(2), amount: 100, description: 'X' };
      await controller.createTemplate(dto, req);
      expect(service.createTemplate).toHaveBeenCalledWith(dto, uuid(9));
    });

    it('should update a template', async () => {
      service.updateTemplate.mockResolvedValue({ id: uuid(1), name: 'Updated' });
      const result = await controller.updateTemplate(uuid(1), { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should delete a template', async () => {
      service.softDeleteTemplate.mockResolvedValue(undefined);
      await controller.deleteTemplate(uuid(1));
      expect(service.softDeleteTemplate).toHaveBeenCalledWith(uuid(1));
    });
  });
});
