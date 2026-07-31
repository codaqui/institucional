import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration017ReimbursementEventLink1785370582491
  implements MigrationInterface
{
  name = 'Migration017ReimbursementEventLink1785370582491';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD "eventId" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD "externalActivationId" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD "eventMetadata" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reimbursement_requests_eventId" ON "reimbursement_requests" ("eventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reimbursement_requests_externalActivationId" ON "reimbursement_requests" ("externalActivationId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_reimbursement_requests_externalActivationId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_reimbursement_requests_eventId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP COLUMN "eventMetadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP COLUMN "externalActivationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP COLUMN "eventId"`,
    );
  }
}
