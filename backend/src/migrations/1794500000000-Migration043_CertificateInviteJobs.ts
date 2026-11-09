import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration043CertificateInviteJobs1794500000000 implements MigrationInterface {
  name = 'Migration043CertificateInviteJobs1794500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "certificate_invite_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batchId" uuid NOT NULL,
        "registrationId" uuid NOT NULL,
        "requestedById" uuid NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'queued',
        "attempts" integer NOT NULL DEFAULT 0,
        "availableAt" timestamptz NOT NULL DEFAULT now(),
        "lockedAt" timestamptz,
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_certificate_invite_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_certificate_invite_batch_registration" UNIQUE ("batchId", "registrationId"),
        CONSTRAINT "FK_certificate_invite_registration" FOREIGN KEY ("registrationId") REFERENCES "event_registrations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_certificate_invite_requester" FOREIGN KEY ("requestedById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_certificate_invite_active_registration"
      ON "certificate_invite_jobs" ("registrationId")
      WHERE status IN ('queued','processing','retry')`);
    await queryRunner.query('CREATE INDEX "IDX_certificate_invite_jobs_available" ON "certificate_invite_jobs" ("status", "availableAt")');
    await queryRunner.query('CREATE INDEX "IDX_certificate_invite_jobs_batch" ON "certificate_invite_jobs" ("batchId")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "certificate_invite_jobs"');
  }
}
