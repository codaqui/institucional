import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration019EventTicketAttendees1785390000000
  implements MigrationInterface
{
  name = 'Migration019EventTicketAttendees1785390000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Remove a constraint única que impedia a mesma pessoa de ter mais de um
    // ingresso no mesmo evento externo ativado (necessário para multi-ingresso
    // e ingressos nominados a terceiros).
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_event_registrations_activation_email"`,
    );

    // Quem pagou o pedido (pode ser diferente do participante).
    await queryRunner.query(
      `ALTER TABLE "event_orders" ADD "payerMemberId" varchar`,
    );

    // Dados dos participantes informados no checkout (JSON).
    // [{"name":"...","email":"..."}, ...]
    await queryRunner.query(
      `ALTER TABLE "event_orders" ADD "attendees" text`,
    );

    // Quem pagou o ingresso (denormalizado para queries rápidas de "meus pedidos").
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD "payerMemberId" varchar`,
    );

    // Backfill: pedidos antigos são considerados pagos pelo próprio memberId.
    await queryRunner.query(
      `UPDATE "event_orders" SET "payerMemberId" = "memberId" WHERE "payerMemberId" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "event_registrations" SET "payerMemberId" = "memberId" WHERE "payerMemberId" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_event_orders_payerMemberId" ON "event_orders" ("payerMemberId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_payerMemberId" ON "event_registrations" ("payerMemberId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_event_registrations_payerMemberId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_event_orders_payerMemberId"`);
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN "payerMemberId"`,
    );
    await queryRunner.query(`ALTER TABLE "event_orders" DROP COLUMN "attendees"`);
    await queryRunner.query(
      `ALTER TABLE "event_orders" DROP COLUMN "payerMemberId"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_event_registrations_activation_email" ON "event_registrations" ("externalActivationId", lower("attendeeEmail")) WHERE "externalActivationId" IS NOT NULL`,
    );
  }
}
