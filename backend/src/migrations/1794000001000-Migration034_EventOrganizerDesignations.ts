import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration034EventOrganizerDesignations1794000001000 implements MigrationInterface {
  name = 'Migration034EventOrganizerDesignations1794000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "member_designations" (
        "memberId", "targetType", "targetId", "targetKey", "designation",
        "status", "appointedById", "createdAt", "updatedAt"
      )
      SELECT
        "o"."memberId", 'event', "a"."id",
        CASE WHEN "a"."id" IS NULL THEN "scopeValue" ELSE NULL END,
        'organizer', 'active', "o"."updatedByMemberId", now(), now()
      FROM "event_organizer_ownerships" AS "o"
      CROSS JOIN unnest("o"."scope") AS "scopeValue"
      LEFT JOIN "external_event_activations" AS "a" ON "a"."eventKey" = "scopeValue"
      ON CONFLICT DO NOTHING
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Rollback não destrutivo: designations podem ser anteriores ao seed ou
    // ter sido atualizadas pelo dual-write posterior.
  }
}
