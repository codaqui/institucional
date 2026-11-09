import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ProjectBudget, ScheduleItem } from '../project.rules';

export type ProjectKind = 'programa' | 'projeto' | 'oficina' | 'evento' | 'prestacao_servicos';
export type ProjectStatus = 'draft' | 'proposed' | 'active' | 'finished' | 'canceled';

@Entity('extension_projects')
@Index('UQ_extension_projects_normalizedName', ['normalizedName'], { unique: true })
@Index('UQ_extension_projects_slug', ['slug'], { unique: true })
@Index('IDX_extension_projects_status_entity', ['status', 'entityId'])
export class ExtensionProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  kind: ProjectKind | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 160 })
  normalizedName: string;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'uuid', nullable: true })
  partnershipId: string | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  startsAt: string | null;

  @Column({ type: 'date', nullable: true })
  endsAt: string | null;

  @Column({ type: 'date', nullable: true })
  registrationStartsAt: string | null;

  @Column({ type: 'date', nullable: true })
  registrationEndsAt: string | null;

  @Column({ type: 'integer', nullable: true })
  odsPrimary: number | null;

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::integer[]' })
  odsSecondary: number[];

  @Column({ type: 'text', nullable: true })
  targetCommunity: string | null;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({ type: 'text', nullable: true })
  objective: string | null;

  @Column({ type: 'text', nullable: true })
  skillsDeveloped: string | null;

  @Column({ type: 'text', nullable: true })
  methodology: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: { to: (value: number | null) => value, from: (value: string | null) => value === null ? null : Number(value) } })
  totalHours: number | null;

  @Column({ type: 'jsonb', nullable: true })
  schedule: ScheduleItem[] | null;

  @Column({ type: 'integer', nullable: true })
  maxParticipants: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  supportPartners: Array<{ nome: string; cnpj?: string }>;

  @Column({ type: 'jsonb', nullable: true })
  budget: ProjectBudget | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments: string[];

  @Column({ type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ type: 'text', nullable: true })
  reportDiscussionUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
