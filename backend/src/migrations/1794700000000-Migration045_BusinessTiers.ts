import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration045BusinessTiers1794700000000 implements MigrationInterface {
  name = 'Migration045BusinessTiers1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      '"tier" character varying(32) NOT NULL DEFAULT \'amiga\'',
      '"engagementCriterion" character varying(32)',
      '"evidenceUrl" text',
      '"validationNotes" text',
      '"validatedAt" TIMESTAMPTZ',
      '"validatedByMemberId" uuid',
      '"sealValidUntil" TIMESTAMPTZ',
    ];
    for (const column of columns) {
      await queryRunner.query(`ALTER TABLE "companies" ADD ${column}`);
    }
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "CHK_companies_tier" CHECK ("tier" IN (\'amiga\', \'aliada\'))');
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "CHK_companies_engagement_criterion" CHECK ("engagementCriterion" IN (\'workshop\', \'hiring\', \'business_event\'))');
    await queryRunner.query('ALTER TABLE "companies" ADD CONSTRAINT "FK_companies_validated_by_member" FOREIGN KEY ("validatedByMemberId") REFERENCES "members"("id") ON DELETE RESTRICT');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const constraints = ['FK_companies_validated_by_member', 'CHK_companies_engagement_criterion', 'CHK_companies_tier'];
    for (const constraint of constraints) {
      await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "${constraint}"`);
    }
    const columns = ['sealValidUntil', 'validatedByMemberId', 'validatedAt', 'validationNotes', 'evidenceUrl', 'engagementCriterion', 'tier'];
    for (const column of columns) {
      await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "${column}"`);
    }
  }
}
