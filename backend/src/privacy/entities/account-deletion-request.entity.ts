import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';

export type AccountDeletionRequestStatus = 'pending' | 'completed' | 'canceled';

@Entity('account_deletion_requests')
@Index('UQ_account_deletion_requests_pending_member', ['memberId'], {
  unique: true,
  where: '"status" = \'pending\'',
})
export class AccountDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'memberId' })
  member: Member;

  @Column({ type: 'varchar', default: 'pending' })
  status: AccountDeletionRequestStatus;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewedByMemberId: string | null;

  @ManyToOne(() => Member, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewedByMemberId' })
  reviewedBy: Member | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
