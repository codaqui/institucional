import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration053EventC4P1795600000000 implements MigrationInterface {
  name = 'Migration053EventC4P1795600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "c4p_calls" ADD "externalActivationId" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "c4p_calls" ADD CONSTRAINT "FK_c4p_calls_externalActivation" FOREIGN KEY ("externalActivationId") REFERENCES "external_event_activations"("id") ON DELETE RESTRICT',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_c4p_calls_managedEvent" ON "c4p_calls" ("managedEventId") WHERE "managedEventId" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_c4p_calls_externalActivation" ON "c4p_calls" ("externalActivationId") WHERE "externalActivationId" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."UQ_c4p_calls_externalActivation"',
    );
    await queryRunner.query('DROP INDEX "public"."UQ_c4p_calls_managedEvent"');
    await queryRunner.query(
      'ALTER TABLE "c4p_calls" DROP CONSTRAINT "FK_c4p_calls_externalActivation"',
    );
    await queryRunner.query(
      'ALTER TABLE "c4p_calls" DROP COLUMN "externalActivationId"',
    );
  }
}
