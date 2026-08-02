import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration021EventOrganizerOwnership1785531505000
  implements MigrationInterface
{
  name = 'Migration021EventOrganizerOwnership1785531505000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_organizer_ownerships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "memberId" uuid NOT NULL,
        "githubHandle" character varying NOT NULL,
        "scope" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "createdByMemberId" uuid NOT NULL,
        "updatedByMemberId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_organizer_ownerships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_organizer_ownerships_memberId" UNIQUE ("memberId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_organizer_ownerships_memberId"
      ON "event_organizer_ownerships" ("memberId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_event_organizer_ownerships_memberId"
    `);
    await queryRunner.query(`
      DROP TABLE "event_organizer_ownerships"
    `);
  }
}
