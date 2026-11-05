import { QueryRunner } from 'typeorm';
import { Migration032ProfileVisibility1793797200000 } from '../migrations/1793797200000-Migration032_ProfileVisibility';

describe('Migration032ProfileVisibility', () => {
  it('adds profileVisibility with a compatibility-preserving default', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new Migration032ProfileVisibility1793797200000();

    await migration.up({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ADD "profileVisibility" jsonb NOT NULL DEFAULT \'{}\'::jsonb'),
    );
  });

  it('drops only profileVisibility on down', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new Migration032ProfileVisibility1793797200000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "members" DROP COLUMN "profileVisibility"',
    );
  });
});
