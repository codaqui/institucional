import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration032ProfileVisibility1793797200000 implements MigrationInterface {
  name = 'Migration032ProfileVisibility1793797200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ADD "profileVisibility" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "profileVisibility"`);
  }
}
