import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration052CompanySubscriptionConversion1795500000000 implements MigrationInterface {
  name = 'Migration052CompanySubscriptionConversion1795500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "company_subscription_conversions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "stripeSubscriptionId" varchar NOT NULL,
        "memberId" uuid NOT NULL,
        "companyId" uuid NOT NULL,
        "requestedById" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz,
        CONSTRAINT "PK_company_subscription_conversions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_subscription_conversions_subscription" UNIQUE ("stripeSubscriptionId"),
        CONSTRAINT "CK_company_subscription_conversions_status" CHECK ("status" IN ('pending', 'completed')),
        CONSTRAINT "FK_company_subscription_conversions_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_company_subscription_conversions_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_company_subscription_conversions_requester" FOREIGN KEY ("requestedById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "company_subscription_conversions"');
  }
}
