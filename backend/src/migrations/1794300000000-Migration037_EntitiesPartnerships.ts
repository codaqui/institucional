import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration037EntitiesPartnerships1794300000000 implements MigrationInterface {
  name = 'Migration037EntitiesPartnerships1794300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "entities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "type" character varying(24) NOT NULL,
        "cnpj" character varying(18),
        "website" text,
        "contactEmail" character varying(255),
        "registeredById" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_entities_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_entities_registeredBy" FOREIGN KEY ("registeredById")
          REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "partnerships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entityId" uuid NOT NULL,
        "kind" character varying(16) NOT NULL,
        "startedAt" date NOT NULL,
        "endsAt" date,
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partnerships_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_partnerships_entity" FOREIGN KEY ("entityId")
          REFERENCES "entities"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_partnerships_entity_status" ON "partnerships" ("entityId", "status")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "partnerships"');
    await queryRunner.query('DROP TABLE IF EXISTS "entities"');
  }
}
