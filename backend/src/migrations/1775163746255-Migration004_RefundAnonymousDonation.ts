import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 004 — Estorno manual de doação anônima
 *
 * Contexto:
 *  Em produção foi recebido o evento `charge.refunded` antes de o webhook
 *  tratá-lo (frente A do PR), gerando inconsistência: o ledger registrou
 *  a doação mas não o estorno. Esta migration insere a transação reversa
 *  vinculada aos IDs reais do Stripe.
 *
 * Dados do incidente:
 *  - Charge:         ch_3TSH3JFtPCSoiGky1bnkoUn8
 *  - Payment Intent: pi_3TSH3JFtPCSoiGky1wUsFOJy  (referenceId da doação)
 *  - Invoice:        in_1TSH3JFtPCSoiGkyyhCayA6M
 *  - Refund:         re_3TSH3JFtPCSoiGky18dl80ut  (referenceId do estorno)
 *  - Customer:       cus_UR9Mvl6aIK74Fi
 *  - Valor:          R$ 100,00 (10000 centavos) — estorno total
 *  - Refund created: 1777644355 (Unix timestamp)
 *
 * Estratégia:
 *  Insere uma transação reversa (source = destino original; destination =
 *  origem original) com o `referenceId` do refund. Não altera nem remove
 *  a doação original — preserva audit trail e partidas dobradas.
 *
 * Idempotência:
 *  - Verifica se a tx original existe antes de inserir
 *  - Verifica se o estorno (re_xxx) ainda não foi registrado
 *  - Se a doação não existir ou o estorno já tiver sido criado pelo webhook,
 *    a migration vira no-op
 */
export class Migration004RefundAnonymousDonation1775163746255
  implements MigrationInterface
{
  name = 'Migration004RefundAnonymousDonation1775163746255';

  private readonly originalReferenceId = 'pi_3TSH3JFtPCSoiGky1wUsFOJy';
  private readonly refundReferenceId = 're_3TSH3JFtPCSoiGky18dl80ut';
  private readonly amount = 100.0;
  private readonly description =
    'Estorno de doação — Refund re_3TSH3JFtPCSoiGky18dl80ut (referente a pi_3TSH3JFtPCSoiGky1wUsFOJy)';
  private readonly refundedAt = '2026-05-01 13:25:55+00'; // Unix 1777644355

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Já registrado pelo webhook? — no-op
    const alreadyRefunded = await queryRunner.query(
      `SELECT id FROM "transactions" WHERE "referenceId" = $1 LIMIT 1`,
      [this.refundReferenceId],
    );
    if (alreadyRefunded.length > 0) {
      console.log(
        `[Migration004] Estorno ${this.refundReferenceId} já registrado — pulando.`,
      );
      return;
    }

    const original = await queryRunner.query(
      `SELECT "sourceAccountId", "destinationAccountId"
         FROM "transactions"
        WHERE "referenceId" = $1
        LIMIT 1`,
      [this.originalReferenceId],
    );

    if (original.length === 0) {
      console.warn(
        `[Migration004] Doação original (${this.originalReferenceId}) não encontrada — pulando.`,
      );
      return;
    }

    const { sourceAccountId, destinationAccountId } = original[0];

    // Reversa: source ↔ destination invertidos
    await queryRunner.query(
      `INSERT INTO "transactions"
        ("amount", "description", "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        this.amount,
        this.description,
        this.refundReferenceId,
        destinationAccountId, // ← era destino, vira origem
        sourceAccountId, // ← era origem, vira destino
        this.refundedAt,
      ],
    );

    console.log(
      `[Migration004] Estorno R$ ${this.amount.toFixed(2)} registrado (${this.refundReferenceId}).`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "transactions" WHERE "referenceId" = $1`,
      [this.refundReferenceId],
    );
  }
}
