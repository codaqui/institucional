import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration045BusinessTiers1794700000000 implements MigrationInterface {
  name = 'Migration045BusinessTiers1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "companies" ADD "tier" character varying(32) NOT NULL DEFAULT \'amiga\'');
    await queryRunner.query('ALTER TABLE "companies" ADD "engagementCriterion" character varying(32)');
    await queryRunner.query('ALTER TABLE "companies" ADD "evidenceUrl" text');
    await queryRunner.query('ALTER TABLE "companies" ADD "validationNotes" text');
    await queryRunner.query('ALTER TABLE "companies" ADD "validatedAt" TIMESTAMPTZ');
    await queryRunner.query('ALTER TABLE "companies" ADD "validatedByMemberId" uuid');
    await queryRunner.query('ALTER TABLE "companies" ADD "sealValidUntil" TIMESTAMPTZ');
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "CHK_companies_tier" CHECK ("tier" IN (\'amiga\', \'aliada\'))');
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "CHK_companies_engagement_criterion" CHECK ("engagementCriterion" IN (\'workshop\', \'hiring\', \'business_event\'))');
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "FK_companies_validated_by_member" FOREIGN KEY ("validatedByMemberId") REFERENCES "members"("id") ON DELETE RESTRICT');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "companies" DROP CONSTRAINT "FK_companies_validated_by_member"');
    await queryRunner.query('ALTER TABLE "companies" DROP CONSTRAINT "CHK_companies_engagement_criterion"');
    await queryRunner.query('ALTER TABLE "companies" DROP CONSTRAINT "CHK_companies_tier"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "sealValidUntil"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "validatedByMemberId"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "validatedAt"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "validationNotes"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "evidenceUrl"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "engagementCriterion"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "tier"');
  }
}
