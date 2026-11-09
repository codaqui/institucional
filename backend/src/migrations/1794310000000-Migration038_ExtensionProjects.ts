import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration038ExtensionProjects1794310000000 implements MigrationInterface {
  name = 'Migration038ExtensionProjects1794310000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "extension_projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" character varying(24),
        "name" character varying(120) NOT NULL,
        "normalizedName" character varying(160) NOT NULL,
        "slug" character varying(160) NOT NULL,
        "entityId" uuid NOT NULL,
        "partnershipId" uuid,
        "createdById" uuid NOT NULL,
        "summary" text,
        "isPublic" boolean NOT NULL DEFAULT true,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "startsAt" date,
        "endsAt" date,
        "registrationStartsAt" date,
        "registrationEndsAt" date,
        "odsPrimary" integer,
        "odsSecondary" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        "targetCommunity" text,
        "justification" text,
        "objective" text,
        "skillsDeveloped" text,
        "methodology" text,
        "totalHours" numeric(8,2),
        "schedule" jsonb,
        "maxParticipants" integer,
        "supportPartners" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "budget" jsonb,
        "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "internalNotes" text,
        "reportDiscussionUrl" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extension_projects_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_extension_projects_normalizedName" UNIQUE ("normalizedName"),
        CONSTRAINT "UQ_extension_projects_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_extension_projects_maxParticipants" CHECK ("maxParticipants" IS NULL OR "maxParticipants" >= 0),
        CONSTRAINT "FK_extension_projects_entity" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_extension_projects_partnership" FOREIGN KEY ("partnershipId") REFERENCES "partnerships"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_extension_projects_createdBy" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_extension_projects_status_entity" ON "extension_projects" ("status", "entityId")');
    await queryRunner.query(`
      CREATE TABLE "project_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "memberId" uuid NOT NULL,
        "role" character varying(16) NOT NULL,
        "joinedAt" timestamptz NOT NULL DEFAULT now(),
        "leftAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_participants_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_participants_project" FOREIGN KEY ("projectId") REFERENCES "extension_projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_participants_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_project_participants_project_role" ON "project_participants" ("projectId", "role", "leftAt")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_project_participants_active_member" ON "project_participants" ("projectId", "memberId") WHERE "leftAt" IS NULL');
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_extension_project_active_mentor" ON "member_designations" ("targetType", "targetId", "designation") WHERE "targetType" = 'extension_project' AND "designation" = 'mentor' AND "status" = 'active'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_extension_project_active_mentor"');
    await queryRunner.query('DROP TABLE IF EXISTS "project_participants"');
    await queryRunner.query('DROP TABLE IF EXISTS "extension_projects"');
  }
}
