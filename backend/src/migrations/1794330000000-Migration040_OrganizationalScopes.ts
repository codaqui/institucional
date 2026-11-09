import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration040OrganizationalScopes1794330000000 implements MigrationInterface {
  name = 'Migration040OrganizationalScopes1794330000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "directorates" ADD "communityId" uuid');
    await queryRunner.query('ALTER TABLE "assemblies" ADD "entityId" uuid');
    await queryRunner.query(`
      INSERT INTO "entities" ("slug", "name", "type", "cnpj", "registeredById")
      SELECT 'codaqui', 'Associação Codaqui', 'ong', '44.593.429/0001-05',
        (SELECT "id" FROM "members" WHERE "roles" @> ARRAY['admin']::text[] ORDER BY "joinedAt" ASC LIMIT 1)
      ON CONFLICT ("slug") DO NOTHING
    `);
    await queryRunner.query(`UPDATE "assemblies" SET "entityId" = (SELECT "id" FROM "entities" WHERE "slug" = 'codaqui')`);
    await queryRunner.query('ALTER TABLE "assemblies" ALTER COLUMN "entityId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "directorates" ADD CONSTRAINT "FK_directorates_community" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT');
    await queryRunner.query('ALTER TABLE "assemblies" ADD CONSTRAINT "FK_assemblies_entity" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_assemblies_type_number"');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_assemblies_entity_type_number" ON "assemblies" ("entityId", "type", "number")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_assemblies_entity_type_number"');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_assemblies_type_number" ON "assemblies" ("type", "number")');
    await queryRunner.query('ALTER TABLE "assemblies" DROP CONSTRAINT "FK_assemblies_entity"');
    await queryRunner.query('ALTER TABLE "directorates" DROP CONSTRAINT "FK_directorates_community"');
    await queryRunner.query('ALTER TABLE "assemblies" DROP COLUMN "entityId"');
    await queryRunner.query('ALTER TABLE "directorates" DROP COLUMN "communityId"');
    await queryRunner.query(`DELETE FROM "entities" WHERE "slug" = 'codaqui'`);
  }
}
