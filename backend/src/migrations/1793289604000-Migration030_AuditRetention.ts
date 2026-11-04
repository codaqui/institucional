import { MigrationInterface, QueryRunner } from 'typeorm';
import { auditCategory } from '../audit/audit-category';
import { AuditAction } from '../audit/entities/audit-log.entity';

export class Migration030AuditRetention1793289604000 implements MigrationInterface {
  name = 'Migration030AuditRetention1793289604000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD "category" character varying(16) NOT NULL DEFAULT 'operational'
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "CHK_audit_logs_category"
      CHECK ("category" IN ('governance', 'operational'))
    `);

    const actions = (await queryRunner.query(
      `SELECT DISTINCT "action" FROM "audit_logs"`,
    )) as Array<{ action: AuditAction }>;
    const governanceActions = actions
      .filter(({ action }) => auditCategory(action) === 'governance')
      .map(({ action }) => action);
    const operationalActions = actions
      .filter(({ action }) => auditCategory(action) === 'operational')
      .map(({ action }) => action);
    if (governanceActions.length > 0) {
      await queryRunner.query(
        `UPDATE "audit_logs" SET "category" = $1 WHERE "action" = ANY($2)`,
        ['governance', governanceActions],
      );
    }
    if (operationalActions.length > 0) {
      await queryRunner.query(
        `UPDATE "audit_logs" SET "category" = $1 WHERE "action" = ANY($2)`,
        ['operational', operationalActions],
      );
    }

    await queryRunner.query(`
      UPDATE "audit_logs" SET "ipAddress" = NULL
      WHERE "category" = 'governance'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_category_createdAt"
      ON "audit_logs" ("category", "createdAt")
    `);
    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "key" character varying(100) NOT NULL,
        "value" jsonb NOT NULL,
        "updatedById" uuid NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("key")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_category_createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_audit_logs_category"`,
    );
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "category"`);
  }
}
