import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const CAMPAIGN_PURPOSES = ['transactional', 'promotional'] as const;
export type CampaignPurpose = (typeof CAMPAIGN_PURPOSES)[number];

export const CAMPAIGN_STATUSES = [
  'draft',
  'preview',
  'scheduled',
  'sending',
  'completed',
  'completed_with_errors',
  'failed',
  'canceled',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_SEGMENT_TYPES = [
  'all_opted_in_members',
  'role',
  'designation',
  'community_governance',
  'manual',
] as const;
export type CampaignSegmentType = (typeof CAMPAIGN_SEGMENT_TYPES)[number];

export interface CampaignSegmentConfig {
  role?: string;
  targetType?: string;
  targetId?: string;
  targetKey?: string;
  designation?: string;
  communityId?: string;
  emails?: string[];
  memberIds?: string[];
  consentEvidence?: string;
}

@Entity('email_campaigns')
@Index('IDX_email_campaigns_status_scheduledAt', ['status', 'scheduledAt'])
@Index('IDX_email_campaigns_createdById', ['createdById'])
@Index('IDX_email_campaigns_confirmedById', ['confirmedById'])
@Index('IDX_email_campaigns_createdAt', ['createdAt'])
export class EmailCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  bodyMarkdown: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar', length: 16 })
  purpose: CampaignPurpose;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: CampaignStatus;

  @Column({ type: 'varchar', length: 32 })
  segmentType: CampaignSegmentType;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  segmentConfig: CampaignSegmentConfig;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @Column({ type: 'uuid', nullable: true })
  confirmedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'varchar', length: 128, unique: true })
  idempotencyKey: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

