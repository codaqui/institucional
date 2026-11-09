import { Migration039ProjectCertificates1794320000000 } from '../migrations/1794320000000-Migration039_ProjectCertificates';

describe('Migration039_ProjectCertificates', () => {
  it('creates unique certificate code and idempotent member/kind constraints', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration039ProjectCertificates1794320000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "project_certificates"');
    expect(sql).toContain('UQ_project_certificates_code');
    expect(sql).toContain('UQ_project_certificates_project_member_kind');
    expect(sql).toContain('"hoursAtIssue" numeric(8,2) NOT NULL');
  });

  it('drops the certificate table on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration039ProjectCertificates1794320000000();

    await migration.down(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "project_certificates"');
  });
});
