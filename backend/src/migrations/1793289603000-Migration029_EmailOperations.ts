import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration029EmailOperations1793289603000
  implements MigrationInterface
{
  name = 'Migration029EmailOperations1793289603000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."email_logs_status_enum" ADD VALUE IF NOT EXISTS 'skipped'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_template_registration" ON "email_logs" ("template", "registrationId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_email_logs_template_registration"`,
    );
  }
}
