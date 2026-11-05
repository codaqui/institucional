import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('hour_statements')
@Index('IDX_hour_statements_member', ['memberId'])
export class HourStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  memberId: string;

  @Column({ type: 'timestamptz', nullable: true })
  from: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  to: Date | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, transformer: {
    to: (value: number) => value,
    from: (value: string) => Number(value),
  } })
  totalHours: number;

  @Column({ type: 'jsonb' })
  entries: Array<Record<string, unknown>>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
