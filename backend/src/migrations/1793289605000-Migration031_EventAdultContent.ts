import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration031EventAdultContent1793289605000
  implements MigrationInterface
{
  name = 'Migration031EventAdultContent1793289605000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events"
      ADD "adultOnly" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_events"
      ADD "venueType" character varying
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_events" DROP COLUMN "venueType"
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_events" DROP COLUMN "adultOnly"
    `);
  }
}
