import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';

/**
 * Carteira de SortCoins de uma empresa.
 * Mesma lógica da Wallet de membro — JSONB para balances.
 */
@Entity('company_wallets')
export class CompanyWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ unique: true, type: 'uuid' })
  companyId: string;

  @Column({ type: 'jsonb', default: '{}' })
  balances: Record<string, number>;

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  frozenTypes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
