import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PartnershipKind = 'termo' | 'pontual';
export type PartnershipStatus = 'active' | 'ended' | 'canceled';

@Entity('partnerships')
@Index('IDX_partnerships_entity_status', ['entityId', 'status'])
export class Partnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 16 })
  kind: PartnershipKind;

  @Column({ type: 'date' })
  startedAt: string;

  @Column({ type: 'date', nullable: true })
  endsAt: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: PartnershipStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
