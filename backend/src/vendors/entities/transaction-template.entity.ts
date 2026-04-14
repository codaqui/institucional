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
 * Template de lançamento — atalho para pagamentos recorrentes.
 *
 * Não gera pagamentos automáticos. Apenas preenche o formulário
 * de pagamento a fornecedor com valores pré-definidos.
 */
@Entity('transaction_templates')
export class TransactionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nome do template (ex: "Contador mensal", "Hosting DigitalOcean") */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // ── Conta de origem ───────────────────────────────────────────────────────
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Account;

  @Column()
  sourceAccountId: string;

  // ── Fornecedor destino ────────────────────────────────────────────────────
  @ManyToOne(() => Vendor, { eager: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  vendorId: string;

  /** Valor padrão em centavos */
  @Column({ type: 'int' })
  amount: number;

  /** Descrição padrão do lançamento */
  @Column({ type: 'text' })
  description: string;

  @Column()
  createdByUserId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
