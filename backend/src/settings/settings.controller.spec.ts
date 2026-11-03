import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import {
  UpdateAuditRetentionDto,
  SettingsController,
} from './settings.controller';
import {
  AUDIT_RETENTION_SETTING_KEY,
  SettingsService,
} from './settings.service';

describe('SettingsController', () => {
  const settings = {
    getAuditRetention: jest.fn(),
    getNumber: jest.fn(),
    setNumber: jest.fn(),
  };
  const audit = { log: jest.fn() };
  let controller: SettingsController;
  const req = {
    user: { sub: 'admin-1', handle: 'admin' },
    ip: '203.0.113.10',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SettingsController(
      settings as unknown as SettingsService,
      audit as unknown as AuditService,
    );
  });

  it('returns the effective retention policy', async () => {
    settings.getAuditRetention.mockResolvedValue({
      retentionDays: 30,
      source: 'env',
    });

    await expect(controller.getAuditRetention()).resolves.toEqual({
      retentionDays: 30,
      source: 'env',
    });
  });

  it('updates retention and writes a governance audit event', async () => {
    settings.getNumber.mockResolvedValue(30);

    await expect(
      controller.updateAuditRetention(req, { retentionDays: 45 }),
    ).resolves.toEqual({ retentionDays: 45, source: 'setting' });

    expect(settings.setNumber).toHaveBeenCalledWith(
      AUDIT_RETENTION_SETTING_KEY,
      45,
      'admin-1',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SETTINGS_AUDIT_RETENTION_UPDATED,
        actorId: 'admin-1',
        details: { previousDays: 30, retentionDays: 45 },
        ipAddress: '203.0.113.10',
      }),
    );
  });

  it.each([7, 365])('accepts the inclusive retention boundary %s', async (days) => {
    const dto = plainToInstance(UpdateAuditRetentionDto, {
      retentionDays: days,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([6, 366, 30.5, 'invalid'])(
    'rejects invalid retention value %s',
    async (days) => {
      const dto = plainToInstance(UpdateAuditRetentionDto, {
        retentionDays: days,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
});
