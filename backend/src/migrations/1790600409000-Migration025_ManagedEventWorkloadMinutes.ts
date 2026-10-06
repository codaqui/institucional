import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration025ManagedEventWorkloadMinutes1790600409000 implements MigrationInterface {
  name = 'Migration025ManagedEventWorkloadMinutes1790600409000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events" ADD "workloadMinutes" int
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events" DROP COLUMN "workloadMinutes"
    `);
  }
}
