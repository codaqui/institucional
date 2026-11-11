import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration047Announcements1795000000000 implements MigrationInterface {
  name = 'Migration047Announcements1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "text" character varying(280) NOT NULL,
        "severity" character varying(16) NOT NULL,
        "linkUrl" character varying(2048),
        "linkLabel" character varying(60),
        "startsAt" TIMESTAMPTZ,
        "endsAt" TIMESTAMPTZ,
        "active" boolean NOT NULL DEFAULT true,
        "createdById" uuid NOT NULL,
        "updatedById" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id"),
        CONSTRAINT "CK_announcements_severity" CHECK ("severity" IN ('info','success','warning','error')),
        CONSTRAINT "CK_announcements_link_label" CHECK (("linkUrl" IS NULL) OR ("linkLabel" IS NOT NULL)),
        CONSTRAINT "CK_announcements_window" CHECK (("startsAt" IS NULL OR "endsAt" IS NULL) OR ("endsAt" > "startsAt"))
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_announcements_active_window" ON "announcements" ("active", "startsAt", "endsAt")');
    await queryRunner.query('CREATE INDEX "IDX_announcements_createdAt" ON "announcements" ("createdAt" DESC)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "announcements"');
  }
}
