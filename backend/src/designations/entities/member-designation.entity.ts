import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const TARGET_TYPES = [
  'community',
  'event',
  'ies',
  'c4p_campaign',
  'extension_project',
  'directorate',
  'company',
  'entity',
  'program',
] as const;

export const DESIGNATIONS = [
  'responsible',
  'ambassador',
  'organizer',
  'evaluator',
  'mentor',
  'director',
  'maintainer',
  'manager',
  'volunteer',
  'founder',
] as const;

export const DESIGNATION_STATUSES = [
  'pending',
  'active',
  'ended',
  'removed',
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];
export type Designation = (typeof DESIGNATIONS)[number];
export type DesignationStatus = (typeof DESIGNATION_STATUSES)[number];

@Entity('member_designations')
@Index('IDX_member_designations_member_status', ['memberId', 'status'])
@Index('IDX_member_designations_target_id', [
  'targetType',
  'targetId',
  'designation',
  'status',
])
@Index('IDX_member_designations_target_key', [
  'targetType',
  'targetKey',
  'designation',
  'status',
])
export class MemberDesignation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 32 })
  targetType: TargetType;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  targetKey: string | null;

  @Column({ type: 'varchar', length: 32 })
  designation: Designation;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: DesignationStatus;

  @Column({ type: 'uuid' })
  appointedById: string;

  @Column({ type: 'uuid', nullable: true })
  confirmedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
