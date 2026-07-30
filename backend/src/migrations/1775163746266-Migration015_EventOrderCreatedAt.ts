import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration015EventOrderCreatedAt1775163746266
  implements MigrationInterface
{
  name = 'Migration015EventOrderCreatedAt1775163746266';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_orders" ADD "createdAt" timestamptz NOT NULL DEFAULT now()`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_orders" DROP COLUMN "createdAt"`,
    );
  }
}
