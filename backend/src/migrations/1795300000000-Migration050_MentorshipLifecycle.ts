import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration050MentorshipLifecycle1795300000000 implements MigrationInterface {
  name = 'Migration050MentorshipLifecycle1795300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mentor_profile_active_backup" (
        "id" uuid NOT NULL,
        "active" boolean NOT NULL,
        CONSTRAINT "PK_mentor_profile_active_backup" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "mentor_profile_active_backup" ("id", "active")
      SELECT "id", "active" FROM "mentor_profiles"
    `);
    await queryRunner.query(`
      UPDATE "mentor_profiles" AS "profile"
      SET "active" = EXISTS (
        SELECT 1 FROM "member_designations" AS "designation"
        WHERE "designation"."memberId" = "profile"."memberId"
          AND "designation"."targetType" = 'program'
          AND "designation"."targetKey" = 'mentoria'
          AND "designation"."designation" = 'mentor'
          AND "designation"."status" = 'active'
          AND ("designation"."validUntil" IS NULL OR "designation"."validUntil" > NOW())
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "mentor_profiles" AS "profile"
      SET "active" = "backup"."active"
      FROM "mentor_profile_active_backup" AS "backup"
      WHERE "profile"."id" = "backup"."id"
    `);
    await queryRunner.query('DROP TABLE "mentor_profile_active_backup"');
  }
}
