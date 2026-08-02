import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration022EventOverrideSchemaFix1785535200000
  implements MigrationInterface
{
  name = 'Migration022EventOverrideSchemaFix1785535200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_overrides"
        ALTER COLUMN "ownerMemberId" TYPE uuid USING "ownerMemberId"::uuid,
        ALTER COLUMN "createdByMemberId" TYPE uuid USING "createdByMemberId"::uuid,
        ALTER COLUMN "updatedByMemberId" TYPE uuid USING "updatedByMemberId"::uuid,
        ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC',
        ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_overrides"
        ALTER COLUMN "ownerMemberId" TYPE character varying,
        ALTER COLUMN "createdByMemberId" TYPE character varying,
        ALTER COLUMN "updatedByMemberId" TYPE character varying,
        ALTER COLUMN "createdAt" TYPE timestamp,
        ALTER COLUMN "updatedAt" TYPE timestamp
    `);
  }
}
