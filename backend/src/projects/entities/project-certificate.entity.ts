import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ProjectCertificateKind = 'participant' | 'mentor_report';

@Entity('project_certificates')
@Index('UQ_project_certificates_code', ['code'], { unique: true })
@Index('UQ_project_certificates_project_member_kind', ['projectId', 'memberId', 'kind'], { unique: true })
export class ProjectCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'varchar', length: 24 })
  kind: ProjectCertificateKind;

  @Column({ type: 'varchar', length: 48 })
  code: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, transformer: { to: (value: number) => value, from: Number } })
  hoursAtIssue: number;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
