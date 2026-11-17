import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration051AccountDeletionRequests1795400000000 implements MigrationInterface {
  name = 'Migration051AccountDeletionRequests1795400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "account_deletion_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "memberId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "requestedAt" timestamptz NOT NULL DEFAULT now(),
        "reviewedByMemberId" uuid,
        "reviewedAt" timestamptz,
        "reviewNote" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_deletion_requests" PRIMARY KEY ("id"),
        CONSTRAINT "CK_account_deletion_requests_status" CHECK ("status" IN ('pending', 'completed', 'canceled')),
        CONSTRAINT "FK_account_deletion_requests_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_account_deletion_requests_reviewer" FOREIGN KEY ("reviewedByMemberId") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_account_deletion_requests_pending_member"
      ON "account_deletion_requests" ("memberId") WHERE ("status" = 'pending')
    `);
    await queryRunner.query('CREATE INDEX "IDX_account_deletion_requests_status_requested" ON "account_deletion_requests" ("status", "requestedAt")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "account_deletion_requests"');
  }
}
