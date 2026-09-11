import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration023ManagedEventDescription1789096550201
  implements MigrationInterface
{
  name = 'Migration023ManagedEventDescription1789096550201';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events" ADD "description" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events" DROP COLUMN "description"
    `);
  }
}
