import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration026MemberDesignations1793289600000 implements MigrationInterface {
  name = 'Migration026MemberDesignations1793289600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "member_designations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "memberId" uuid NOT NULL,
        "targetType" character varying(32) NOT NULL,
        "targetId" uuid,
        "targetKey" character varying(64),
        "designation" character varying(32) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "appointedById" uuid NOT NULL,
        "confirmedById" uuid,
        "confirmedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_member_designations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_member_designations_targetType" CHECK (
          "targetType" IN (
            'community', 'event', 'ies', 'c4p_campaign', 'extension_project',
            'directorate', 'company', 'entity', 'program'
          )
        ),
        CONSTRAINT "CHK_member_designations_designation" CHECK (
          "designation" IN (
            'responsible', 'ambassador', 'organizer', 'evaluator', 'mentor',
            'director', 'maintainer', 'manager', 'volunteer', 'founder'
          )
        ),
        CONSTRAINT "CHK_member_designations_status" CHECK (
          "status" IN ('pending', 'active', 'ended', 'removed')
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_member_designations_member_status"
      ON "member_designations" ("memberId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_member_designations_target_id"
      ON "member_designations" ("targetType", "targetId", "designation", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_member_designations_target_key"
      ON "member_designations" ("targetType", "targetKey", "designation", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_active"
      ON "member_designations" (
        "memberId", "targetType", "targetId", "targetKey", "designation"
      ) NULLS NOT DISTINCT
      WHERE "status" = 'active'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_community_responsible"
      ON "member_designations" ("targetId")
      WHERE "targetType" = 'community'
        AND "designation" = 'responsible'
        AND "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_ies_ambassador"
      ON "member_designations" ("targetId")
      WHERE "targetType" = 'ies'
        AND "designation" = 'ambassador'
        AND "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_directorate_director"
      ON "member_designations" ("targetId")
      WHERE "targetType" = 'directorate'
        AND "designation" = 'director'
        AND "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_extension_project_mentor"
      ON "member_designations" ("targetId")
      WHERE "targetType" = 'extension_project'
        AND "designation" = 'mentor'
        AND "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_company_responsible"
      ON "member_designations" ("targetId")
      WHERE "targetType" = 'company'
        AND "designation" = 'responsible'
        AND "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_program_mentor_member"
      ON "member_designations" ("memberId")
      WHERE "targetType" = 'program'
        AND "targetKey" = 'mentoria'
        AND "designation" = 'mentor'
        AND "status" = 'active'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_program_mentor_member"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_company_responsible"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_extension_project_mentor"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_directorate_director"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_ies_ambassador"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_community_responsible"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_designations_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_member_designations_target_key"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_member_designations_target_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_member_designations_member_status"`,
    );
    await queryRunner.query(`DROP TABLE "member_designations"`);
  }
}
