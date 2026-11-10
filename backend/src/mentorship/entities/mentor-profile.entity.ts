import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mentor_profiles')
export class MentorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  memberId: string;

  @Column({ type: 'text', array: true })
  areas: string[];

  @Column({ type: 'text', nullable: true })
  focus: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'uuid' })
  approvedById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  since: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
