import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HourEntrySource {
  EVENT_CHECKIN = 'event_checkin',
  DIRECTORATE_ACTIVITY = 'directorate_activity',
  EXTENSION_PROJECT = 'extension_project',
  MENTORSHIP_SESSION = 'mentorship_session',
}

export enum HourEntryStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('hour_ledger')
@Index('IDX_hour_ledger_member_status', ['memberId', 'status'])
@Index('IDX_hour_ledger_source', ['sourceType', 'sourceId'])
export class HourEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 32 })
  sourceType: HourEntrySource;

  @Column({ type: 'uuid' })
  sourceId: string;

  @Column({ type: 'varchar', length: 160 })
  sourceLabel: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, transformer: {
    to: (value: number) => value,
    from: (value: string) => Number(value),
  } })
  hours: number;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 16, default: HourEntryStatus.PENDING })
  status: HourEntryStatus;

  @Column({ type: 'uuid', nullable: true })
  reportedById: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectReason: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
