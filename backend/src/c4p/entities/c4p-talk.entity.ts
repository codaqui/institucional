import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type C4pTalkOrigin = 'public_form' | 'csv_import';

@Entity('c4p_talks')
export class C4pTalk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_c4p_talks_call')
  @Column({ type: 'uuid' })
  callId: string;

  @Column({ type: 'varchar', length: 160 })
  speakerName: string;

  @Column({ type: 'varchar', length: 160 })
  speakerEmail: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  speakerPhone: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  speakerRole: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin: string | null;

  @Column({ type: 'boolean', nullable: true })
  spokeBefore: boolean | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  level: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  track: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  extraNotes: string | null;

  @Column({ type: 'varchar', length: 16 })
  origin: C4pTalkOrigin;

  @Column({ type: 'timestamptz', nullable: true })
  consentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
