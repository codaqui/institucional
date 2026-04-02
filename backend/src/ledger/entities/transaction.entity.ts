import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Account } from './account.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Amount in reais (e.g., 75.00 = R$ 75,00)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  description: string;

  @ManyToOne(() => Account, { eager: true })
  sourceAccount: Account;

  @ManyToOne(() => Account, { eager: true })
  destinationAccount: Account;

  @Column({ nullable: true, unique: true })
  referenceId: string;

  @CreateDateColumn()
  createdAt: Date;
}
