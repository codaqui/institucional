import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Institution } from '../../entities/entities/institution.entity';

export type AssemblyType = 'ordinaria' | 'oficial';
export type AssemblyStatus = 'scheduled' | 'held' | 'canceled';

export interface AssemblyNotaryRegistry {
  book: string;
  page: string;
  registeredAt: Date | string;
}

@Entity('assemblies')
@Index('UQ_assemblies_type_number', ['type', 'number'], { unique: true })
@Index('IDX_assemblies_status_scheduledAt', () => ({
  status: 1,
  scheduledAt: -1,
}))
export class Assembly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['ordinaria', 'oficial'] })
  type: AssemblyType;

  @Column({ type: 'integer' })
  number: number;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  heldAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'held', 'canceled'],
    default: 'scheduled',
  })
  status: AssemblyStatus;

  @Column({ type: 'text' })
  agendaSummary: string;

  @Column({ type: 'text' })
  discussionUrl: string;

  @Column({ type: 'text', nullable: true })
  ataPdfUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  notaryRegistry: AssemblyNotaryRegistry | null;

  @Column({ type: 'uuid' })
  entityId: string;

  @ManyToOne(() => Institution, { nullable: false })
  @JoinColumn({ name: 'entityId' })
  entity: Institution;

  @Column({ type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
