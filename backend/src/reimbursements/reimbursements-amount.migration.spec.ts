import { Migration054ReimbursementAmountNumeric1795700000000 } from '../migrations/1795700000000-Migration054_ReimbursementAmountNumeric';

describe('Migration054_ReimbursementAmountNumeric', () => {
  const createQueryRunner = () => ({
    query: jest
      .fn<(query: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  });

  const executedSql = (queryRunner: {
    query: { mock: { calls: unknown[] } };
  }): string =>
    (queryRunner.query.mock.calls as string[][])
      .map(([query]) => query)
      .join('\n');

  it('converte amount para numeric(10,2) no up', async () => {
    const queryRunner = createQueryRunner();
    const migration = new Migration054ReimbursementAmountNumeric1795700000000();

    await migration.up(queryRunner as never);
    const sql = executedSql(queryRunner);

    expect(sql).toContain(
      'ALTER TABLE "reimbursement_requests" ALTER COLUMN "amount" TYPE numeric(10,2)',
    );
  });

  it('restora integer no down', async () => {
    const queryRunner = createQueryRunner();
    const migration = new Migration054ReimbursementAmountNumeric1795700000000();

    await migration.down(queryRunner as never);
    const sql = executedSql(queryRunner);

    expect(sql).toContain(
      'ALTER TABLE "reimbursement_requests" ALTER COLUMN "amount" TYPE integer',
    );
  });
});
