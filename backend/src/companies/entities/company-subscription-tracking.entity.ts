import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Acompanhamento do status de assinatura Stripe de uma empresa.
 * Permite detectar assinaturas `past_due` por mais de 3 dias antes de congelar
 * a carteira automaticamente.
 */
@Entity('company_subscription_tracking')
export class CompanySubscriptionTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK lógica para companies.id (mantida como string para não criar FK física) */
  @Column({ unique: true })
  companyId: string;

  @Column({ nullable: true, unique: true, type: 'varchar' })
  stripeSubscriptionId: string | null;

  /** Último status conhecido (active, past_due, unpaid, cancelled, etc.) */
  @Column()
  status: string;

  /** Quando o status atual entrou em vigor */
  @Column({ type: 'timestamp' })
  statusChangedAt: Date;

  /** Quando a carteira foi congelada por past_due (null = não congelada) */
  @Column({ type: 'timestamp', nullable: true })
  frozenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
