import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const SUPPRESSION_SOURCES = [
  'unsubscribe',
  'admin',
  'complaint',
  'bounce_manual',
] as const;
export type SuppressionSource = (typeof SUPPRESSION_SOURCES)[number];

@Entity('email_suppressions')
@Index('IDX_email_suppressions_createdById', ['createdById'])
@Index('IDX_email_suppressions_source', ['source'])
export class EmailSuppression {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  emailNormalized: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 32 })
  source: SuppressionSource;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

