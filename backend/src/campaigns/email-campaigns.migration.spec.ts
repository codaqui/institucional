import { Migration048EmailCampaigns1795100000000 } from '../migrations/1795100000000-Migration048_EmailCampaigns';

describe('Migration048EmailCampaigns1795100000000', () => {
  it('cria tabelas de campanhas, recipients e supressões, além das colunas em members e email_logs', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    };
    const migration = new Migration048EmailCampaigns1795100000000();

    await migration.up(queryRunner as any);
    const upSql = queries.join('\n');

    expect(upSql).toContain('CREATE TABLE "email_campaigns"');
    expect(upSql).toContain('CONSTRAINT "UQ_email_campaigns_idempotencyKey" UNIQUE ("idempotencyKey")');
    expect(upSql).toContain(`"purpose" IN ('transactional','promotional')`);
    expect(upSql).toContain(
      `"status" IN ('draft','preview','scheduled','sending','completed','completed_with_errors','failed','canceled')`,
    );
    expect(upSql).toContain(
      `"segmentType" IN ('all_opted_in_members','role','designation','community_governance','manual')`,
    );

    expect(upSql).toContain('CREATE TABLE "email_campaign_recipients"');
    expect(upSql).toContain(
      'CONSTRAINT "UQ_email_campaign_recipients_campaign_email" UNIQUE ("campaignId", "emailNormalized")',
    );
    expect(upSql).toContain(
      `"status" IN ('pending','sending','sent','failed','skipped','suppressed')`,
    );

    expect(upSql).toContain('CREATE TABLE "email_suppressions"');
    expect(upSql).toContain(
      'CONSTRAINT "UQ_email_suppressions_emailNormalized" UNIQUE ("emailNormalized")',
    );
    expect(upSql).toContain(
      `"source" IN ('unsubscribe','admin','complaint','bounce_manual')`,
    );

    expect(upSql).toContain(
      'ALTER TABLE "members" ADD COLUMN "marketingEmailOptIn" boolean NOT NULL DEFAULT false',
    );
    expect(upSql).toContain('ALTER TABLE "email_logs" ADD COLUMN "campaignId" uuid');
    expect(upSql).toContain('ALTER TABLE "email_logs" ADD COLUMN "campaignRecipientId" uuid');

    queries.length = 0;
    await migration.down(queryRunner as any);
    const downSql = queries.join('\n');

    expect(downSql).toContain('ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "campaignRecipientId"');
    expect(downSql).toContain('ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "campaignId"');
    expect(downSql).toContain('ALTER TABLE "members" DROP COLUMN IF EXISTS "marketingEmailOptIn"');
    expect(downSql).toContain('DROP TABLE IF EXISTS "email_campaign_recipients"');
    expect(downSql).toContain('DROP TABLE IF EXISTS "email_suppressions"');
    expect(downSql).toContain('DROP TABLE IF EXISTS "email_campaigns"');
  });
});

