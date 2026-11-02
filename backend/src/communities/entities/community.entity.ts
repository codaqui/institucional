import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CommunityLevel = 'parceira' | 'integrada';
export type CommunityStatus = 'proposed' | 'active' | 'suspended' | 'exited';
export type CommunitySealStatus = 'none' | 'applied' | 'sealed';

@Entity('communities')
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 16 })
  emoji: string;

  @Column({ type: 'text' })
  logoUrl: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Column({ type: 'integer', nullable: true })
  founded: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  links: Record<string, unknown>[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  socialProfiles: Record<string, unknown>[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  tags: string[];

  @Column({ type: 'varchar', length: 16, default: 'parceira' })
  level: CommunityLevel;

  @Column({ type: 'varchar', length: 16, default: 'proposed' })
  status: CommunityStatus;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  sealStatus: CommunitySealStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sealGrantedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  sealGrantedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sealValidUntil: Date | null;

  @Column({ type: 'text', nullable: true })
  sealNotes: string | null;

  @Column({ type: 'boolean', default: false })
  siteEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  siteDomain: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
