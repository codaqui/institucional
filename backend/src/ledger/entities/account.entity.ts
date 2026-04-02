import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AccountType {
  BANK = 'BANK',
  VIRTUAL_WALLET = 'VIRTUAL_WALLET',
  EXTERNAL = 'EXTERNAL',
  EXPENSE = 'EXPENSE',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    default: AccountType.VIRTUAL_WALLET,
  })
  type: AccountType;

  // Optional project identifier
  @Column({ nullable: true })
  projectKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
