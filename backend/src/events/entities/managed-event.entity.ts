import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ManagedEventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELED = 'canceled',
  COMPLETED = 'completed',
}

@Entity('managed_events')
export class ManagedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** usado no snapshot e nas URLs */
  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column('text')
  summary: string;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column()
  location: string;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({ default: 'America/Sao_Paulo' })
  timezone: string;

  /** conta ledger que recebe a receita */
  @Column()
  communityProjectKey: string;

  @Column({
    type: 'enum',
    enum: ManagedEventStatus,
    default: ManagedEventStatus.DRAFT,
  })
  status: ManagedEventStatus;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column()
  createdByMemberId: string;

  @CreateDateColumn()
  createdAt: Date;
}
