import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ProjectParticipantRole = 'participant' | 'mentor';

@Entity('project_participants')
@Index('IDX_project_participants_project_role', ['projectId', 'role', 'leftAt'])
export class ProjectParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 16 })
  role: ProjectParticipantRole;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  joinedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  leftAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
