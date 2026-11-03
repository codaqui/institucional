import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppSetting } from './entities/app-setting.entity';
import {
  AUDIT_RETENTION_SETTING_KEY,
  SettingsService,
} from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  const previousEnv = process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
  const mockRepo = {
    findOneBy: jest.fn(),
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
    mockRepo.findOneBy.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(AppSetting), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  afterAll(() => {
    if (previousEnv === undefined) {
      delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
    } else {
      process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = previousEnv;
    }
  });

  it('returns a numeric setting and ignores malformed values', async () => {
    mockRepo.findOneBy.mockResolvedValueOnce({ value: 45 });
    await expect(service.getNumber(AUDIT_RETENTION_SETTING_KEY)).resolves.toBe(
      45,
    );

    mockRepo.findOneBy.mockResolvedValueOnce({ value: '45' });
    await expect(
      service.getNumber(AUDIT_RETENTION_SETTING_KEY),
    ).resolves.toBeNull();
  });

  it('creates a setting with its author', async () => {
    await service.setNumber(AUDIT_RETENTION_SETTING_KEY, 45, 'admin-1');

    expect(mockRepo.save).toHaveBeenCalledWith({
      key: AUDIT_RETENTION_SETTING_KEY,
      value: 45,
      updatedById: 'admin-1',
    });
  });

  it('updates an existing setting without losing its key', async () => {
    mockRepo.findOneBy.mockResolvedValue({
      key: AUDIT_RETENTION_SETTING_KEY,
      value: 30,
      updatedById: 'admin-old',
    });

    await service.setNumber(AUDIT_RETENTION_SETTING_KEY, 90, 'admin-new');

    expect(mockRepo.save).toHaveBeenCalledWith({
      key: AUDIT_RETENTION_SETTING_KEY,
      value: 90,
      updatedById: 'admin-new',
    });
  });

  it('returns the effective setting and its source', async () => {
    mockRepo.findOneBy.mockResolvedValue({ value: 45 });

    await expect(service.getAuditRetention()).resolves.toEqual({
      retentionDays: 45,
      source: 'setting',
    });
  });

  it('uses the environment fallback and identifies its source', async () => {
    process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = '60';

    await expect(service.getAuditRetention()).resolves.toEqual({
      retentionDays: 60,
      source: 'env',
    });
  });

  it.each([undefined, 'invalid', '6', '366', '30.5'])(
    'uses 30 days when the environment fallback is %s',
    async (value) => {
      if (value === undefined) {
        delete process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
      } else {
        process.env.AUDIT_OPERATIONAL_RETENTION_DAYS = value;
      }

      await expect(service.getAuditRetention()).resolves.toEqual({
        retentionDays: 30,
        source: 'env',
      });
    },
  );
});
