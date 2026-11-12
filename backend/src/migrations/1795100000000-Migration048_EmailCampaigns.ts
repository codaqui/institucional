import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration048EmailCampaigns1795100000000
  implements MigrationInterface
{
  name = 'Migration048EmailCampaigns1795100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "members" ADD COLUMN "marketingEmailOptIn" boolean NOT NULL DEFAULT false',
    );

    await queryRunner.query(`
      CREATE TABLE "email_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(160) NOT NULL,
        "subject" character varying(200) NOT NULL,
        "bodyMarkdown" text NOT NULL,
        "templateId" character varying(80),
        "purpose" character varying(16) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'draft',
        "segmentType" character varying(32) NOT NULL,
        "segmentConfig" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "scheduledAt" TIMESTAMPTZ,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdById" uuid NOT NULL,
        "confirmedById" uuid,
        "confirmedAt" TIMESTAMPTZ,
        "idempotencyKey" character varying(128) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_campaigns_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "CK_email_campaigns_purpose" CHECK ("purpose" IN ('transactional','promotional')),
        CONSTRAINT "CK_email_campaigns_status" CHECK ("status" IN ('draft','preview','scheduled','sending','completed','completed_with_errors','failed','canceled')),
        CONSTRAINT "CK_email_campaigns_segmentType" CHECK ("segmentType" IN ('all_opted_in_members','role','designation','community_governance','manual')),
        CONSTRAINT "FK_email_campaigns_createdBy" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_email_campaigns_confirmedBy" FOREIGN KEY ("confirmedById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaigns_status_scheduledAt" ON "email_campaigns" ("status", "scheduledAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaigns_createdById" ON "email_campaigns" ("createdById")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaigns_confirmedById" ON "email_campaigns" ("confirmedById")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaigns_createdAt" ON "email_campaigns" ("createdAt" DESC)',
    );

    await queryRunner.query(`
      CREATE TABLE "email_campaign_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaignId" uuid NOT NULL,
        "memberId" uuid,
        "email" character varying(320),
        "name" character varying(200),
        "emailNormalized" character varying(320),
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "nextAttemptAt" TIMESTAMPTZ,
        "lockedAt" TIMESTAMPTZ,
        "lastError" text,
        "sentAt" TIMESTAMPTZ,
        "emailLogId" uuid,
        "unsubscribeTokenHash" character varying(64),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_campaign_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_campaign_recipients_campaign_email" UNIQUE ("campaignId", "emailNormalized"),
        CONSTRAINT "CK_email_campaign_recipients_status" CHECK ("status" IN ('pending','sending','sent','failed','skipped','suppressed')),
        CONSTRAINT "FK_email_campaign_recipients_campaign" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_email_campaign_recipients_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_email_campaign_recipients_emailLog" FOREIGN KEY ("emailLogId") REFERENCES "email_logs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaign_recipients_campaign_status" ON "email_campaign_recipients" ("campaignId", "status", "nextAttemptAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaign_recipients_memberId" ON "email_campaign_recipients" ("memberId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaign_recipients_emailLogId" ON "email_campaign_recipients" ("emailLogId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_campaign_recipients_tokenHash" ON "email_campaign_recipients" ("unsubscribeTokenHash")',
    );

    await queryRunner.query(`
      CREATE TABLE "email_suppressions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "emailNormalized" character varying(320) NOT NULL,
        "reason" text NOT NULL,
        "source" character varying(32) NOT NULL,
        "createdById" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_suppressions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_suppressions_emailNormalized" UNIQUE ("emailNormalized"),
        CONSTRAINT "CK_email_suppressions_source" CHECK ("source" IN ('unsubscribe','admin','complaint','bounce_manual')),
        CONSTRAINT "FK_email_suppressions_createdBy" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_email_suppressions_createdById" ON "email_suppressions" ("createdById")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_suppressions_source" ON "email_suppressions" ("source")',
    );

    await queryRunner.query(
      'ALTER TABLE "email_logs" ADD COLUMN "campaignId" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" ADD COLUMN "campaignRecipientId" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" ADD CONSTRAINT "FK_email_logs_campaign" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" ADD CONSTRAINT "FK_email_logs_campaign_recipient" FOREIGN KEY ("campaignRecipientId") REFERENCES "email_campaign_recipients"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_logs_campaignId" ON "email_logs" ("campaignId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_email_logs_campaignRecipientId" ON "email_logs" ("campaignRecipientId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_email_logs_campaignRecipientId"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_logs_campaignId"');
    await queryRunner.query(
      'ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "FK_email_logs_campaign_recipient"',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "FK_email_logs_campaign"',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "campaignRecipientId"',
    );
    await queryRunner.query(
      'ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "campaignId"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "email_suppressions"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_campaign_recipients"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_campaigns"');
    await queryRunner.query(
      'ALTER TABLE "members" DROP COLUMN IF EXISTS "marketingEmailOptIn"',
    );
  }
}
