import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import { SettingsService } from '../settings/settings.service';

describe('AuditService', () => {
  let service: AuditService;
  const previousEnv = process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
  const mockRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const mockSettings = { getNumber: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
    mockSettings.getNumber.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterAll(() => {
    if (previousEnv === undefined) {
      delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
    } else {
      process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = previousEnv;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('always classifies governance logs and never persists their IP', async () => {
    await service.log({
      action: AuditAction.ROLE_DERIVED,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorHandle: 'testuser',
      ipAddress: '203.0.113.10',
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'governance', ipAddress: null }),
    );
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('classifies operational logs and preserves their IP', async () => {
    await service.log({
      action: AuditAction.LOGIN,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorHandle: 'testuser',
      ipAddress: '203.0.113.10',
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'operational',
        ipAddress: '203.0.113.10',
      }),
    );
  });

  it('should not throw on log failure', async () => {
    mockRepo.save.mockRejectedValueOnce(new Error('DB Error'));

    await expect(
      service.log({
        action: AuditAction.ROLE_CHANGE,
        actorId: '00000000-0000-0000-0000-000000000000',
        actorHandle: 'testuser',
      }),
    ).resolves.toBeUndefined();
  });

  it('never deletes governance logs', async () => {
    await service.cleanupOperational();

    expect(mockRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'operational' }),
    );
    expect(mockRepo.delete).not.toHaveBeenCalledWith(
      expect.objectContaining({ category: 'governance' }),
    );
  });

  it('keeps the legacy cleanup entry point on the operational-only policy', async () => {
    await expect(service.cleanup()).resolves.toBe(5);
    expect(mockRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'operational' }),
    );
  });

  it('prefers the admin setting over the environment fallback', async () => {
    process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = '90';
    mockSettings.getNumber.mockResolvedValue(45);

    expect(await service.getOperationalRetentionDays()).toBe(45);
  });

  it('uses the environment fallback and then the 30-day default', async () => {
    process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = '60';
    expect(await service.getOperationalRetentionDays()).toBe(60);

    delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
    expect(await service.getOperationalRetentionDays()).toBe(30);
  });

  it('filters logs by category when requested', async () => {
    await service.findAll(1, 10, 'governance');

    expect(mockRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: 'governance' } }),
    );
  });

  it('should paginate results', async () => {
    const result = await service.findAll(1, 10);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('totalPages');
  });
});
