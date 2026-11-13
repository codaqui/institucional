import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type C4pCallStatus = 'draft' | 'open' | 'closed';

export interface Criterion {
  key: string;
  label: string;
  weight: number;
}

@Entity('c4p_calls')
export class C4pCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  managedEventId: string | null;

  @Column({ type: 'uuid', nullable: true })
  communityId: string | null;

  @Index('IDX_c4p_calls_status')
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: C4pCallStatus;

  @Column({ type: 'timestamptz', nullable: true })
  submissionOpenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submissionCloseAt: Date | null;

  @Column({ type: 'jsonb' })
  criteria: Criterion[];

  @Column({ type: 'jsonb', nullable: true })
  selectedTalkIds: string[] | null;

  @Column({ type: 'boolean', default: false })
  publicResults: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  finalizedAt: Date | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
