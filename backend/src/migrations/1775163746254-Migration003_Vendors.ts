import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 003 — Fornecedores, Pagamentos a Fornecedores e Templates de Lançamento
 *
 * Tabelas criadas:
 *  - vendors: cadastro de fornecedores (PF/PJ) vinculados a Account EXTERNAL
 *  - vendor_payments: pagamentos a fornecedores com comprovantes duplos
 *  - transaction_templates: templates para lançamentos recorrentes
 */
export class Migration003Vendors1775163746254 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── vendors ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "document" character varying(20),
        "website" character varying(500),
        "accountId" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vendors_account" FOREIGN KEY ("accountId")
          REFERENCES "accounts"("id") ON DELETE RESTRICT
      )
    `);

    // ── vendor_payments ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendorId" uuid NOT NULL,
        "sourceAccountId" uuid NOT NULL,
        "amount" integer NOT NULL,
        "description" text NOT NULL,
        "receiptUrl" character varying,
        "internalReceiptUrl" character varying,
        "paidByUserId" character varying NOT NULL,
        "paidAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vendor_payments_vendor" FOREIGN KEY ("vendorId")
          REFERENCES "vendors"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vendor_payments_source" FOREIGN KEY ("sourceAccountId")
          REFERENCES "accounts"("id") ON DELETE RESTRICT
      )
    `);

    // ── transaction_templates ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transaction_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "sourceAccountId" uuid NOT NULL,
        "vendorId" uuid NOT NULL,
        "amount" integer NOT NULL,
        "description" text NOT NULL,
        "createdByUserId" character varying NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_templates_source" FOREIGN KEY ("sourceAccountId")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_templates_vendor" FOREIGN KEY ("vendorId")
          REFERENCES "vendors"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendors"`);
  }
}
