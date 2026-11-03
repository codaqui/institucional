import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';

export const AUDIT_RETENTION_SETTING_KEY = 'audit.operational_retention_days';
export const DEFAULT_AUDIT_OPERATIONAL_RETENTION_DAYS = 30;
export const MIN_AUDIT_OPERATIONAL_RETENTION_DAYS = 7;
export const MAX_AUDIT_OPERATIONAL_RETENTION_DAYS = 365;

export interface AuditRetentionPolicy {
  retentionDays: number;
  source: 'setting' | 'env';
}

export function isValidAuditRetentionDays(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_AUDIT_OPERATIONAL_RETENTION_DAYS &&
    value <= MAX_AUDIT_OPERATIONAL_RETENTION_DAYS
  );
}

export function getEnvironmentAuditRetentionDays(): number {
  const raw = process.env.AUDIT_OPERATIONAL_RETENTION_DAYS;
  if (raw === undefined) return DEFAULT_AUDIT_OPERATIONAL_RETENTION_DAYS;
  const value = Number(raw);
  return isValidAuditRetentionDays(value)
    ? value
    : DEFAULT_AUDIT_OPERATIONAL_RETENTION_DAYS;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  async getNumber(key: string): Promise<number | null> {
    const setting = await this.repo.findOneBy({ key });
    return typeof setting?.value === 'number' &&
      Number.isFinite(setting.value)
      ? setting.value
      : null;
  }

  async setNumber(
    key: string,
    value: number,
    updatedById: string,
  ): Promise<void> {
    const setting =
      (await this.repo.findOneBy({ key })) ??
      this.repo.create({ key, value, updatedById });
    setting.value = value;
    setting.updatedById = updatedById;
    await this.repo.save(setting);
  }

  async getAuditRetention(): Promise<AuditRetentionPolicy> {
    const configured = await this.getNumber(AUDIT_RETENTION_SETTING_KEY);
    if (configured !== null && isValidAuditRetentionDays(configured)) {
      return { retentionDays: configured, source: 'setting' };
    }
    return {
      retentionDays: getEnvironmentAuditRetentionDays(),
      source: 'env',
    };
  }
}
