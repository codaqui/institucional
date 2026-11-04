import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration027Directorates1793289601000 implements MigrationInterface {
  name = 'Migration027Directorates1793289601000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "directorates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_directorates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_directorates_slug" UNIQUE ("slug")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directorates"`);
  }
}
