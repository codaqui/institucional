import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type InstitutionType = 'empresa' | 'instituicao_ensino' | 'ong' | 'governo' | 'outro';

@Entity('entities')
@Index('UQ_entities_slug', ['slug'], { unique: true })
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  type: InstitutionType;

  @Column({ type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ type: 'text', nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ type: 'uuid' })
  registeredById: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
