import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

/**
 * Base abstrata para movimentações de fornecedor (pagamentos e recebimentos).
 *
 * Concentra os campos comuns (vendor, valores, descrição, comprovantes,
 * auditoria) para evitar duplicação entre VendorPayment e VendorReceipt.
 *
 * As subclasses adicionam apenas a conta da contraparte interna:
 *   - VendorPayment.sourceAccountId        (community → vendor)
 *   - VendorReceipt.destinationAccountId  (vendor → community)
 */
export abstract class AbstractVendorTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Fornecedor ─────────────────────────────────────────────────────────────
  @ManyToOne(() => Vendor, { eager: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  vendorId: string;

  // ── Valores ────────────────────────────────────────────────────────────────
  /** Valor em centavos (ex: 15000 = R$ 150,00) */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  // ── Comprovantes ───────────────────────────────────────────────────────────
  /** Comprovante original enviado pela contraparte (pode expirar) */
  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string | null;

  /** Cópia permanente no Google Drive da comunidade */
  @Column({ type: 'varchar', nullable: true })
  internalReceiptUrl: string | null;

  // ── Auditoria ──────────────────────────────────────────────────────────────
  /** ID do membro que registrou o lançamento */
  @Column()
  registeredByUserId: string;

  /** Quando a movimentação ocorreu (default: now) */
  @Column({ type: 'timestamp', default: () => 'now()' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
