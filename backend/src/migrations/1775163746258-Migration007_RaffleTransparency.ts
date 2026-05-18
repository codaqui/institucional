import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration007RaffleTransparency1775163746258
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "club_raffles"
      ADD COLUMN IF NOT EXISTS "drawSeed" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "club_raffles"
      ADD COLUMN IF NOT EXISTS "drawAlgorithm" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "club_raffles"
      DROP COLUMN IF EXISTS "drawAlgorithm"
    `);
    await queryRunner.query(`
      ALTER TABLE "club_raffles"
      DROP COLUMN IF EXISTS "drawSeed"
    `);
  }
}

