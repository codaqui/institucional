import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AnnouncementSeverity = 'info' | 'success' | 'warning' | 'error';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 280 })
  text: string;

  @Column({ type: 'varchar', length: 16 })
  severity: AnnouncementSeverity;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  linkUrl: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  linkLabel: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'uuid' })
  createdById: string;

  @Column({ type: 'uuid' })
  updatedById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
