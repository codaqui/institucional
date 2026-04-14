import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { Account } from '../../ledger/entities/account.entity';

/**
 * Pagamento a fornecedor — registra a saída de dinheiro para um fornecedor.
 *
 * Segue o padrão de reembolsos:
 *  - receiptUrl: comprovante original (pode expirar)
 *  - internalReceiptUrl: cópia permanente no Drive da comunidade
 *
 * Ao ser criado, gera automaticamente uma Transaction no ledger
 * com referenceId = "vendor-payment:<id>".
 */
@Entity('vendor_payments')
export class VendorPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Fornecedor ────────────────────────────────────────────────────────────
  @ManyToOne(() => Vendor, { eager: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  vendorId: string;

  // ── Conta de origem (de onde sai o dinheiro) ──────────────────────────────
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Account;

  @Column()
  sourceAccountId: string;

  // ── Valores ───────────────────────────────────────────────────────────────
  /** Valor em centavos (ex: 15000 = R$ 150,00) */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  // ── Comprovantes ──────────────────────────────────────────────────────────
  /** Comprovante original enviado pelo fornecedor (pode expirar) */
  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string | null;

  /** Cópia permanente no Google Drive da comunidade */
  @Column({ type: 'varchar', nullable: true })
  internalReceiptUrl: string | null;

  // ── Quem registrou ────────────────────────────────────────────────────────
  @Column()
  paidByUserId: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
