import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration036Assemblies1794100000000 implements MigrationInterface {
  name = 'Migration036Assemblies1794100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assemblies_type_enum" AS ENUM('ordinaria', 'oficial')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."assemblies_status_enum" AS ENUM('scheduled', 'held', 'canceled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "assemblies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."assemblies_type_enum" NOT NULL,
        "number" integer NOT NULL,
        "title" character varying(160) NOT NULL,
        "scheduledAt" timestamptz NOT NULL,
        "heldAt" timestamptz,
        "status" "public"."assemblies_status_enum" NOT NULL DEFAULT 'scheduled',
        "agendaSummary" text NOT NULL,
        "discussionUrl" text NOT NULL,
        "ataPdfUrl" text,
        "notaryRegistry" jsonb,
        "createdById" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assemblies_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_assemblies_number_positive" CHECK ("number" > 0),
        CONSTRAINT "FK_assemblies_createdBy" FOREIGN KEY ("createdById")
          REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_assemblies_type_number" ON "assemblies" ("type", "number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assemblies_status_scheduledAt" ON "assemblies" ("status", "scheduledAt" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assemblies"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."assemblies_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."assemblies_type_enum"`,
    );
  }
}
