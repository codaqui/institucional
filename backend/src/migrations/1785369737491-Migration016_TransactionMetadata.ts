import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration016TransactionMetadata1785369737491
  implements MigrationInterface
{
  name = 'Migration016TransactionMetadata1785369737491';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "metadata" jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_metadata_event" ON "transactions" (("metadata"->>'eventId'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_metadata_ticket" ON "transactions" (("metadata"->>'ticketTypeId'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_transactions_metadata_ticket"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_transactions_metadata_event"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "metadata"`,
    );
  }
}
