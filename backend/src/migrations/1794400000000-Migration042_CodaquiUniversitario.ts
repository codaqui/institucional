import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration042CodaquiUniversitario1794400000000 implements MigrationInterface {
  name = 'Migration042CodaquiUniversitario1794400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "uf" character varying(2) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cities_name_uf" UNIQUE ("name", "uf")
      )
    `);
    await queryRunner.query('ALTER TABLE "entities" ADD "cityId" uuid');
    await queryRunner.query('ALTER TABLE "managed_events" ADD "institutionId" uuid');
    await queryRunner.query('ALTER TABLE "member_designations" ADD "validUntil" TIMESTAMPTZ');
    await queryRunner.query('ALTER TABLE "member_designations" ADD "applicationNotes" text');

    const activeDuplicates = await queryRunner.query(`
      SELECT "targetId" FROM "member_designations"
      WHERE "targetType" = 'ies' AND "designation" = 'ambassador' AND "status" = 'active'
      GROUP BY "targetId" HAVING COUNT(*) > 1
    `);
    if (activeDuplicates.length > 0) {
      throw new Error(
        `Embaixadores ativos duplicados: ${activeDuplicates.map((row: { targetId: string }) => row.targetId).join(', ')}`,
      );
    }
    const pendingDuplicates = await queryRunner.query(`
      SELECT "memberId", "targetId" FROM "member_designations"
      WHERE "targetType" = 'ies' AND "designation" = 'ambassador' AND "status" = 'pending'
      GROUP BY "memberId", "targetType", "targetId", "designation"
      HAVING COUNT(*) > 1
    `);
    if (pendingDuplicates.length > 0) {
      throw new Error(
        `Candidaturas pendentes duplicadas: ${pendingDuplicates.map((row: { targetId: string }) => row.targetId).join(', ')}`,
      );
    }

    await queryRunner.query('ALTER TABLE "entities" ADD CONSTRAINT "FK_entities_city" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT');
    await queryRunner.query('ALTER TABLE "managed_events" ADD CONSTRAINT "FK_managed_events_institution" FOREIGN KEY ("institutionId") REFERENCES "entities"("id") ON DELETE RESTRICT');
    await queryRunner.query('CREATE INDEX "IDX_managed_events_institution" ON "managed_events" ("institutionId")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_university_one_active_ambassador" ON "member_designations" ("targetType", "targetId", "designation") WHERE "status" = \'active\' AND "designation" = \'ambassador\' AND "targetType" = \'ies\'');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_university_pending_ambassador" ON "member_designations" ("memberId", "targetType", "targetId", "designation") WHERE "status" = \'pending\'');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_university_pending_ambassador"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_university_one_active_ambassador"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_managed_events_institution"');
    await queryRunner.query('ALTER TABLE "managed_events" DROP CONSTRAINT "FK_managed_events_institution"');
    await queryRunner.query('ALTER TABLE "entities" DROP CONSTRAINT "FK_entities_city"');
    await queryRunner.query('ALTER TABLE "member_designations" DROP COLUMN "applicationNotes"');
    await queryRunner.query('ALTER TABLE "member_designations" DROP COLUMN "validUntil"');
    await queryRunner.query('ALTER TABLE "managed_events" DROP COLUMN "institutionId"');
    await queryRunner.query('ALTER TABLE "entities" DROP COLUMN "cityId"');
    await queryRunner.query('DROP TABLE IF EXISTS "cities"');
  }
}
