import { QueryRunner } from 'typeorm';
import { Migration030AuditRetention1793289604000 } from '../migrations/1793289604000-Migration030_AuditRetention';
import { AuditAction } from './entities/audit-log.entity';

describe('Migration030AuditRetention', () => {
  it('classifies existing logs, minimizes governance IPs and creates the retention index', async () => {
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT DISTINCT "action"')) {
        return [
          { action: AuditAction.ROLE_CHANGE },
          { action: AuditAction.ROLE_DERIVED },
          { action: AuditAction.LOGIN },
        ];
      }
      return [];
    });
    const migration = new Migration030AuditRetention1793289604000();

    await migration.up({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ADD "category" character varying(16)'),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "audit_logs" SET "category" = $1'), [
      'governance',
      AuditAction.ROLE_CHANGE,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "audit_logs" SET "category" = $1'), [
      'governance',
      AuditAction.ROLE_DERIVED,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "audit_logs" SET "category" = $1'), [
      'operational',
      AuditAction.LOGIN,
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SET "ipAddress" = NULL'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('("category", "createdAt")'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "app_settings"'),
    );
  });

  it('removes only objects owned by this migration on down', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new Migration030AuditRetention1793289604000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP INDEX'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP TABLE "app_settings"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "category"'),
    );
  });
});
