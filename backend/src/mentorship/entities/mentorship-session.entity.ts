import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum MentorshipSessionStatus {
  REQUESTED = 'requested',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  NO_SHOW = 'no_show',
}

@Entity('mentorship_sessions')
@Index('UQ_mentorship_session_slot', ['mentorId', 'scheduledAt'], { unique: true })
@Index('IDX_mentorship_session_status', ['status'])
export class MentorshipSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  mentorId: string;

  @Column({ type: 'varchar', length: 160 })
  menteeName: string;

  @Column({ type: 'varchar', length: 254 })
  menteeEmail: string;

  @Column({ type: 'uuid', nullable: true })
  menteeMemberId: string | null;

  @Column({ type: 'text', array: true })
  topicTags: string[];

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'integer' })
  durationMin: number;

  @Column({ type: 'varchar', length: 64, default: 'America/Sao_Paulo' })
  timeZone: string;

  @Column({ type: 'varchar', length: 32, default: MentorshipSessionStatus.REQUESTED })
  status: MentorshipSessionStatus;

  @Column({ type: 'text', nullable: true })
  meetLink: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'integer', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'uuid', unique: true })
  token: string;

  @Column({ type: 'timestamptz', nullable: true })
  guestConsentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
