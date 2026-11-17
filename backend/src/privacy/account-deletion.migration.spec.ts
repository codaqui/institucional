import { Migration051AccountDeletionRequests1795400000000 } from '../migrations/1795400000000-Migration051_AccountDeletionRequests';

describe('Migration051_AccountDeletionRequests', () => {
  it('cria histórico, FK e uma única pendência por membro e reverte com segurança', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration051AccountDeletionRequests1795400000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');
    expect(sql).toContain('CREATE TABLE "account_deletion_requests"');
    expect(sql).toContain('FOREIGN KEY ("memberId") REFERENCES "members"("id")');
    expect(sql).toContain('WHERE ("status" = \'pending\')');

    await migration.down(queryRunner as any);
    expect(queryRunner.query).toHaveBeenLastCalledWith('DROP TABLE "account_deletion_requests"');
  });
});
