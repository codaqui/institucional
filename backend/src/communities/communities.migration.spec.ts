import { QueryRunner } from 'typeorm';
import { Migration028Communities1793289602000 } from '../migrations/1793289602000-Migration028_Communities';

describe('Migration028Communities', () => {
  it('starts all seed inserts in order before waiting for the first one', async () => {
    let releaseFirstInsert: () => void;
    let markFirstInsertStarted: () => void;
    const firstInsert = new Promise<void>((resolve) => {
      releaseFirstInsert = resolve;
    });
    const firstInsertStarted = new Promise<void>((resolve) => {
      markFirstInsertStarted = resolve;
    });
    let insertCount = 0;
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO "communities"')) {
        insertCount += 1;
        if (insertCount === 1) {
          markFirstInsertStarted();
          return firstInsert;
        }
      }
      return Promise.resolve([]);
    });
    const migration = new Migration028Communities1793289602000();

    const migrationPromise = migration.up({ query } as unknown as QueryRunner);
    await firstInsertStarted;
    const insertsStarted = query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO "communities"'),
    );
    releaseFirstInsert!();
    await migrationPromise;

    expect(insertsStarted).toHaveLength(6);
    expect(
      insertsStarted.map(([, values]) => values[0]),
    ).toEqual([
      'devparana',
      'elasnocodigo',
      'campostechpg',
      'tisocial',
      'cloudnativemaringa',
      'cumbucadev',
    ]);
    expect(insertsStarted[0][0]).toContain('"slug", "name", "description"');
    expect(insertsStarted[0][0]).toContain('$1, $2, $3');
  });
});
