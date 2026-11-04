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
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "action" = ANY($2)'),
      ['governance', [AuditAction.ROLE_CHANGE, AuditAction.ROLE_DERIVED]],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "action" = ANY($2)'),
      ['operational', [AuditAction.LOGIN]],
    );
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

  it('does not overlap category updates on the same database connection', async () => {
    let releaseFirstUpdate: () => void;
    let markFirstUpdateStarted: () => void;
    const firstUpdate = new Promise<void>((resolve) => {
      releaseFirstUpdate = resolve;
    });
    const firstUpdateStarted = new Promise<void>((resolve) => {
      markFirstUpdateStarted = resolve;
    });
    let activeUpdates = 0;
    let maxActiveUpdates = 0;
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT "action"')) {
        return Promise.resolve([
          { action: AuditAction.ROLE_CHANGE },
          { action: AuditAction.ROLE_DERIVED },
          { action: AuditAction.LOGIN },
        ]);
      }
      if (!sql.includes('UPDATE "audit_logs" SET "category"')) {
        return Promise.resolve([]);
      }
      activeUpdates += 1;
      maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
      const finish = () => {
        activeUpdates -= 1;
      };
      if (activeUpdates === 1) {
        markFirstUpdateStarted();
        return firstUpdate.then(finish);
      }
      return Promise.resolve([]).then(finish);
    });
    const migration = new Migration030AuditRetention1793289604000();

    const migrationPromise = migration.up({ query } as unknown as QueryRunner);
    await firstUpdateStarted;
    const observedMaxActiveUpdates = maxActiveUpdates;
    releaseFirstUpdate!();
    await migrationPromise;

    expect(observedMaxActiveUpdates).toBe(1);
  });

  it('removes only objects owned by this migration on down', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new Migration030AuditRetention1793289604000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX'));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP TABLE "app_settings"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "category"'),
    );
  });
});
