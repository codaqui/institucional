import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from '../../ledger/entities/account.entity';
import { AbstractVendorTransaction } from './abstract-vendor-transaction.entity';

/**
 * Recebimento de fornecedor — registra a entrada de dinheiro vinda de um
 * fornecedor/parceiro (ex: Sympla repassando vendas de ingressos, parcerias
 * que enviam valores para a Codaqui).
 *
 * Espelho de VendorPayment, mas no sentido oposto do ledger:
 *   recordTransaction(vendor.account → destinationAccount, ...)
 *
 * referenceId no ledger: `vendor-receipt:<id>`
 */
@Entity('vendor_receipts')
export class VendorReceipt extends AbstractVendorTransaction {
  // ── Conta de destino (para onde entra o dinheiro) ────────────────────────
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'destinationAccountId' })
  destinationAccount: Account;

  @Column()
  destinationAccountId: string;
}
