import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration054ReimbursementAmountNumeric1795700000000 implements MigrationInterface {
  name = 'Migration054ReimbursementAmountNumeric1795700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "reimbursement_requests" ALTER COLUMN "amount" TYPE numeric(10,2)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "reimbursement_requests" ALTER COLUMN "amount" TYPE integer',
    );
  }
}
