import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration033HourLedger1794000000000 implements MigrationInterface {
  name = 'Migration033HourLedger1794000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hour_ledger" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "memberId" uuid NOT NULL,
        "sourceType" varchar(32) NOT NULL,
        "sourceId" uuid NOT NULL,
        "sourceLabel" varchar(160) NOT NULL,
        "hours" numeric(8,2) NOT NULL,
        "description" varchar(500) NOT NULL,
        "occurredAt" timestamptz NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "reportedById" uuid,
        "approvedById" uuid,
        "approvedAt" timestamptz,
        "rejectReason" varchar(500),
        "idempotencyKey" varchar(128),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hour_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hour_ledger_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_hour_ledger_source" CHECK ("sourceType" IN ('event_checkin','directorate_activity','extension_project','mentorship_session')),
        CONSTRAINT "CHK_hour_ledger_status" CHECK ("status" IN ('pending','approved','rejected')),
        CONSTRAINT "CHK_hour_ledger_hours" CHECK ("hours" > 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_hour_ledger_member_status" ON "hour_ledger" ("memberId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_hour_ledger_source" ON "hour_ledger" ("sourceType", "sourceId")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_hour_ledger_automatic_source" ON "hour_ledger" ("memberId", "sourceType", "sourceId")
      WHERE "sourceType" IN ('event_checkin', 'mentorship_session')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_hour_ledger_idempotency" ON "hour_ledger" ("memberId", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "hour_statements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "memberId" uuid NOT NULL,
        "from" timestamptz,
        "to" timestamptz,
        "totalHours" numeric(8,2) NOT NULL,
        "entries" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hour_statements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hour_statements_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_hour_statements_member" ON "hour_statements" ("memberId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hour_statements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hour_ledger"`);
  }
}
