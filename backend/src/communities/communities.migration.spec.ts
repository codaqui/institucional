import { QueryRunner } from 'typeorm';
import { Migration028Communities1793289602000 } from '../migrations/1793289602000-Migration028_Communities';

describe('Migration028Communities', () => {
  it('does not overlap seed inserts on the same database connection', async () => {
    let releaseFirstInsert: () => void;
    let markFirstInsertStarted: () => void;
    const firstInsert = new Promise<void>((resolve) => {
      releaseFirstInsert = resolve;
    });
    const firstInsertStarted = new Promise<void>((resolve) => {
      markFirstInsertStarted = resolve;
    });
    let activeInserts = 0;
    let maxActiveInserts = 0;
    const insertedValues: unknown[] = [];
    const query = jest
      .fn()
      .mockImplementation((sql: string, parameters: unknown[] = []) => {
        if (!sql.includes('INSERT INTO "communities"')) {
          return Promise.resolve([]);
        }
        insertedValues.push(...parameters);
        activeInserts += 1;
        maxActiveInserts = Math.max(maxActiveInserts, activeInserts);
        const finish = () => {
          activeInserts -= 1;
        };
        if (activeInserts === 1) {
          markFirstInsertStarted();
          return firstInsert.then(finish);
        }
        return Promise.resolve([]).then(finish);
      });
    const migration = new Migration028Communities1793289602000();

    const migrationPromise = migration.up({ query } as unknown as QueryRunner);
    await firstInsertStarted;
    const observedMaxActiveInserts = maxActiveInserts;
    releaseFirstInsert!();
    await migrationPromise;

    expect(observedMaxActiveInserts).toBe(1);
    expect(insertedValues).toEqual(
      expect.arrayContaining([
        'devparana',
        'elasnocodigo',
        'campostechpg',
        'tisocial',
        'cloudnativemaringa',
        'cumbucadev',
      ]),
    );
  });
});
