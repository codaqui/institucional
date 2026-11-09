import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration039ProjectCertificates1794320000000 implements MigrationInterface {
  name = 'Migration039ProjectCertificates1794320000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_certificates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "memberId" uuid NOT NULL,
        "kind" character varying(24) NOT NULL,
        "code" character varying(48) NOT NULL,
        "hoursAtIssue" numeric(8,2) NOT NULL,
        "issuedAt" timestamptz NOT NULL,
        "createdById" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_certificates_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_certificates_code" UNIQUE ("code"),
        CONSTRAINT "UQ_project_certificates_project_member_kind" UNIQUE ("projectId", "memberId", "kind"),
        CONSTRAINT "FK_project_certificates_project" FOREIGN KEY ("projectId") REFERENCES "extension_projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_certificates_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_project_certificates_createdBy" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "project_certificates"');
  }
}
