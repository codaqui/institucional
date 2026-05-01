import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 005 — Recebimentos de Fornecedores
 *
 * Mudanças:
 *  1. Renomeia colunas de auditoria em vendor_payments para nomes neutros
 *     (paidByUserId → registeredByUserId, paidAt → occurredAt) para alinhamento
 *     com a entidade base AbstractVendorTransaction (compartilhada com vendor_receipts).
 *  2. Adiciona coluna `direction` em transaction_templates ('payment' | 'receipt'),
 *     default 'payment' para preservar comportamento existente.
 *  3. Cria tabela vendor_receipts: espelho de vendor_payments com
 *     destinationAccountId no lugar de sourceAccountId. Usado para registrar
 *     repasses recebidos (ex: Sympla → Codaqui).
 */
export class Migration005VendorReceipts1775163746256 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Rename de colunas em vendor_payments ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vendor_payments"
        RENAME COLUMN "paidByUserId" TO "registeredByUserId"
    `);
    await queryRunner.query(`
      ALTER TABLE "vendor_payments"
        RENAME COLUMN "paidAt" TO "occurredAt"
    `);

    // ── 2. Direction em transaction_templates ────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "transaction_templates"
        ADD COLUMN IF NOT EXISTS "direction" character varying(10)
        NOT NULL DEFAULT 'payment'
    `);

    // ── 3. Nova tabela vendor_receipts ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendorId" uuid NOT NULL,
        "destinationAccountId" uuid NOT NULL,
        "amount" integer NOT NULL,
        "description" text NOT NULL,
        "receiptUrl" character varying,
        "internalReceiptUrl" character varying,
        "registeredByUserId" character varying NOT NULL,
        "occurredAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vendor_receipts_vendor" FOREIGN KEY ("vendorId")
          REFERENCES "vendors"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vendor_receipts_destination" FOREIGN KEY ("destinationAccountId")
          REFERENCES "accounts"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_receipts"`);
    await queryRunner.query(`
      ALTER TABLE "transaction_templates" DROP COLUMN IF EXISTS "direction"
    `);
    await queryRunner.query(`
      ALTER TABLE "vendor_payments" RENAME COLUMN "occurredAt" TO "paidAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "vendor_payments" RENAME COLUMN "registeredByUserId" TO "paidByUserId"
    `);
  }
}
