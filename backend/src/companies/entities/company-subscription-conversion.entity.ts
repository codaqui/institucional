import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CompanySubscriptionConversionStatus = 'pending' | 'completed';

@Entity('company_subscription_conversions')
export class CompanySubscriptionConversion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  stripeSubscriptionId: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  requestedById: string;

  @Column({ default: 'pending' })
  status: CompanySubscriptionConversionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
