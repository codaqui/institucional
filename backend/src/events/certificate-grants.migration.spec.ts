import { Migration041CertificateGrants1794340000000 } from '../migrations/1794340000000-Migration041_CertificateGrants';

describe('Migration041_CertificateGrants', () => {
  it('adds certificate grant metadata and backfills existing check-ins', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration041CertificateGrants1794340000000();

    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('ALTER TABLE "event_registrations" ADD "certificateGrantedAt" TIMESTAMPTZ');
    expect(sql).toContain('ALTER TABLE "event_registrations" ADD "certificateGrantedByMemberId" uuid');
    expect(sql).toContain('ALTER TABLE "event_registrations" ADD "certificateInvitedAt" TIMESTAMPTZ');
    expect(sql).toContain('SET "certificateGrantedAt" = "checkedInAt"');
    expect(sql).toContain('"certificateGrantedByMemberId" = "checkedInByMemberId"::uuid');
  });

  it('drops only certificate grant metadata on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new Migration041CertificateGrants1794340000000();

    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map(([query]) => query).join('\n');

    expect(sql).toContain('ALTER TABLE "event_registrations" DROP COLUMN "certificateGrantedAt"');
    expect(sql).toContain('ALTER TABLE "event_registrations" DROP COLUMN "certificateGrantedByMemberId"');
    expect(sql).toContain('ALTER TABLE "event_registrations" DROP COLUMN "certificateInvitedAt"');
    expect(sql).not.toContain('DROP TABLE');
  });
});
