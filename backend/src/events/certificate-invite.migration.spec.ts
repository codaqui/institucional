import { Migration043CertificateInviteJobs1794500000000 } from '../migrations/1794500000000-Migration043_CertificateInviteJobs';

describe('Migration043_CertificateInviteJobs', () => {
  it('creates certificate invite jobs with active uniqueness and worker indexes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration043CertificateInviteJobs1794500000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('CREATE TABLE "certificate_invite_jobs"');
    expect(sql).toContain('UNIQUE ("batchId", "registrationId")');
    expect(sql).toContain("status IN ('queued','processing','retry')");
    expect(sql).toContain('CREATE INDEX "IDX_certificate_invite_jobs_available"');
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('drops only the queue on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration043CertificateInviteJobs1794500000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('DROP TABLE IF EXISTS "certificate_invite_jobs"');
    expect(sql).not.toContain('DROP TABLE IF EXISTS "event_registrations"');
    expect(sql).not.toContain('DROP TABLE IF EXISTS "members"');
  });
});
