import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CompanyStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

/**
 * Empresa apoiadora (CNPJ obrigatório).
 * Um único responsável por empresa (FK exclusivo no members.id).
 */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Somente dígitos (14 chars), único */
  @Column({ length: 14, unique: true })
  cnpj: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  logoUrl: string | null;

  @Column({ nullable: true, type: 'varchar' })
  websiteUrl: string | null;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.PENDING })
  status: CompanyStatus;

  /** FK → members.id — único: um responsável por empresa */
  @Column({ unique: true })
  responsibleMemberId: string;

  @Column({ nullable: true, type: 'varchar', unique: true })
  stripeCustomerId: string | null;

  @Column({ nullable: true, type: 'varchar', unique: true })
  stripeSubscriptionId: string | null;

  /** Valor da assinatura em centavos (mínimo R$200 = 20000) */
  @Column({ type: 'int', default: 20000 })
  subscriptionAmountCents: number;

  @Column({ default: false })
  showOnSponsorsPage: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
