import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from '../../ledger/entities/account.entity';
import { AbstractVendorTransaction } from './abstract-vendor-transaction.entity';

/**
 * Pagamento a fornecedor — registra a saída de dinheiro para um fornecedor.
 *
 * Espelho de VendorReceipt, no sentido community → vendor:
 *   recordTransaction(sourceAccount → vendor.account, ...)
 *
 * referenceId no ledger: `vendor-payment:<id>`
 *
 * Comprovantes seguem o padrão de reembolsos:
 *  - receiptUrl: comprovante original (pode expirar)
 *  - internalReceiptUrl: cópia permanente no Drive da comunidade
 */
@Entity('vendor_payments')
export class VendorPayment extends AbstractVendorTransaction {
  // ── Conta de origem (de onde sai o dinheiro) ──────────────────────────────
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Account;

  @Column()
  sourceAccountId: string;
}
