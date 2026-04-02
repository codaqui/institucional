import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog, AUDIT_RETENTION_DAYS } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  const mockRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log audit entry without throwing', async () => {
    await service.log({
      action: 'member.role_change' as any,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorHandle: 'testuser',
      targetId: '11111111-1111-1111-1111-111111111111',
      targetType: 'member',
      details: { role: 'admin' },
    });

    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should not throw on log failure', async () => {
    mockRepo.save.mockRejectedValueOnce(new Error('DB Error'));

    await expect(
      service.log({
        action: 'member.role_change' as any,
        actorId: '00000000-0000-0000-0000-000000000000',
        actorHandle: 'testuser',
      }),
    ).resolves.toBeUndefined();
  });

  it('should cleanup old records', async () => {
    const deleted = await service.cleanup();
    expect(deleted).toBe(5);
    expect(mockRepo.delete).toHaveBeenCalled();
  });

  it('should have retention of 90 days', () => {
    expect(AUDIT_RETENTION_DAYS).toBe(90);
  });

  it('should paginate results', async () => {
    const result = await service.findAll(1, 10);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('totalPages');
  });
});
