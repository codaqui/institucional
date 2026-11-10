import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CertificateInviteJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  RETRY = 'retry',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('certificate_invite_jobs')
@Index('UQ_certificate_invite_batch_registration', ['batchId', 'registrationId'], { unique: true })
@Index('UQ_certificate_invite_active_registration', ['registrationId'], {
  unique: true,
  where: "status IN ('queued','processing','retry')",
})
@Index('IDX_certificate_invite_jobs_available', ['status', 'availableAt'])
@Index('IDX_certificate_invite_jobs_batch', ['batchId'])
export class CertificateInviteJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  batchId: string;

  @Column({ type: 'uuid' })
  registrationId: string;

  @Column({ type: 'uuid' })
  requestedById: string;

  @Column({ type: 'varchar', length: 32, default: CertificateInviteJobStatus.QUEUED })
  status: CertificateInviteJobStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  availableAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
