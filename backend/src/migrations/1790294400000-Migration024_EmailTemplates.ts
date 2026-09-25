import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration024EmailTemplates1790294400000
  implements MigrationInterface
{
  name = 'Migration024EmailTemplates1790294400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_templates" (
        "id" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "bodyMarkdown" text NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_templates" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_templates"`);
  }
}
