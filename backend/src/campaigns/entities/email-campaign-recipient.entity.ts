import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const CAMPAIGN_RECIPIENT_STATUSES = [
  'pending',
  'sending',
  'sent',
  'failed',
  'skipped',
  'suppressed',
] as const;
export type CampaignRecipientStatus =
  (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

@Entity('email_campaign_recipients')
@Unique('UQ_email_campaign_recipients_campaign_email', [
  'campaignId',
  'emailNormalized',
])
@Index('IDX_email_campaign_recipients_campaign_status', [
  'campaignId',
  'status',
  'nextAttemptAt',
])
@Index('IDX_email_campaign_recipients_memberId', ['memberId'])
@Index('IDX_email_campaign_recipients_emailLogId', ['emailLogId'])
@Index('IDX_email_campaign_recipients_tokenHash', ['unsubscribeTokenHash'])
export class EmailCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'uuid', nullable: true })
  memberId: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  emailNormalized: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CampaignRecipientStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  emailLogId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unsubscribeTokenHash: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

