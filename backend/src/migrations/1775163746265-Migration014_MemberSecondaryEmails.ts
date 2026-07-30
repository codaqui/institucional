import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration014MemberSecondaryEmails1775163746265
  implements MigrationInterface
{
  name = 'Migration014MemberSecondaryEmails1775163746265';

  async up(queryRunner: QueryRunner): Promise<void> {
    // E-mails verificados da conta GitHub (todos, não só o primário) —
    // match de participantes importados via CSV (docs/EVENT_PLAN.md, 2026-07-29).
    await queryRunner.query(
      `ALTER TABLE "members" ADD "secondaryEmails" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" DROP COLUMN "secondaryEmails"`,
    );
  }
}
