import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 009 — Acompanhamento de status de assinatura empresarial.
 *
 * Permite congelar carteiras de empresas que ficam mais de 3 dias em
 * `past_due`, sem depender apenas do evento de cancelamento.
 */
export class Migration009CompanySubscriptionTracking1775163746260
  implements MigrationInterface
{
  name = 'Migration009CompanySubscriptionTracking1775163746260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_subscription_tracking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "stripeSubscriptionId" character varying UNIQUE,
        "status" character varying NOT NULL,
        "statusChangedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "frozenAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_subscription_tracking" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_subscription_tracking_companyId" UNIQUE ("companyId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "company_subscription_tracking"`,
    );
  }
}
