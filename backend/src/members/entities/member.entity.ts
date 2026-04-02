import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum MemberRole {
  MEMBRO = 'membro',
  FINANCE_ANALYZER = 'finance-analyzer',
  ADMIN = 'admin',
}

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  githubId: string;

  @Column()
  githubHandle: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ default: '' })
  avatarUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string | null;

  @Column({ nullable: true, type: 'varchar' })
  linkedinUrl: string | null;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.MEMBRO })
  role: MemberRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  joinedAt: Date;
}
