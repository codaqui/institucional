import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export enum WalletTxSource {
  STRIPE_INVOICE = 'stripe_invoice',
  RAFFLE_ENTRY = 'raffle_entry',
  RAFFLE_REFUND = 'raffle_refund',
  MANUAL_ADMIN = 'manual_admin',
  COMPANY_DISTRIBUTION = 'company_distribution',
}

/**
 * Histórico de movimentações de SortCoins de um membro.
 * Constraint de idempotência: (walletId, source, referenceId, coinType) é único.
 * NULLs em referenceId são permitidos (múltiplos ajustes manuais).
 */
@Entity('club_wallet_transactions')
@Unique(['walletId', 'source', 'referenceId', 'coinType'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column()
  walletId: string;

  @Column({ default: 'sort_coin' })
  coinType: string;

  /** Positivo = crédito, negativo = débito */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: WalletTxSource })
  source: WalletTxSource;

  @Column({ nullable: true, type: 'varchar' })
  referenceId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
