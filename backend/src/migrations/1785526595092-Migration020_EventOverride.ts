import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration020EventOverride1785526595092
  implements MigrationInterface
{
  name = 'Migration020EventOverride1785526595092';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceKey" character varying NOT NULL,
        "eventId" character varying NOT NULL,
        "ownerMemberId" character varying NOT NULL,
        "ownerHandle" character varying NOT NULL,
        "payload" text NOT NULL,
        "reason" character varying,
        "createdByMemberId" character varying NOT NULL,
        "updatedByMemberId" character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_overrides_sourceKey_eventId" UNIQUE ("sourceKey", "eventId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_overrides_ownerMemberId" ON "event_overrides" ("ownerMemberId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_event_overrides_ownerMemberId"
    `);
    await queryRunner.query(`
      DROP TABLE "event_overrides"
    `);
  }
}
