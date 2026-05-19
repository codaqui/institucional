import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CompanyWallet } from './company-wallet.entity';

export enum CompanyWalletTxSource {
  STRIPE_INVOICE = 'stripe_invoice',
  MANUAL_ADMIN = 'manual_admin',
  RAFFLE_ENTRY = 'raffle_entry',
  RAFFLE_REFUND = 'raffle_refund',
  COMPANY_DISTRIBUTION = 'company_distribution',
}

/**
 * Histórico de movimentações de SortCoins de uma empresa.
 * Mesma lógica de idempotência da WalletTransaction de membro.
 */
@Entity('company_wallet_transactions')
@Unique(['walletId', 'source', 'referenceId', 'coinType'])
export class CompanyWalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompanyWallet)
  @JoinColumn({ name: 'walletId' })
  wallet: CompanyWallet;

  @Column()
  walletId: string;

  @Column({ default: 'sort_coin' })
  coinType: string;

  /** Positivo = crédito, negativo = débito */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: CompanyWalletTxSource })
  source: CompanyWalletTxSource;

  @Column({ nullable: true, type: 'varchar' })
  referenceId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
