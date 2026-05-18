import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { RaffleOwnerType } from './raffle-entry.entity';

export enum RaffleStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  DRAWN = 'drawn',
  CANCELED = 'canceled',
}

/**
 * Sorteio criado por um admin.
 * Membros e empresas com sorteio ativo podem se inscrever usando SortCoins.
 */
@Entity('club_raffles')
export class Raffle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  /** Custo em SortCoins para participar */
  @Column({ type: 'int' })
  costInCoins: number;

  @Column({ type: 'enum', enum: RaffleStatus, default: RaffleStatus.OPEN })
  status: RaffleStatus;

  /** memberId ou companyId do vencedor */
  @Column({ nullable: true, type: 'varchar' })
  winnerId: string | null;

  @Column({
    nullable: true,
    type: 'enum',
    enum: RaffleOwnerType,
  })
  winnerType: RaffleOwnerType | null;

  @Column({ nullable: true, type: 'timestamp' })
  drawAt: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  drawSeed: string | null;

  @Column({ nullable: true, type: 'varchar' })
  drawAlgorithm: string | null;

  @Column()
  closesAt: Date;

  /** memberId do admin que criou */
  @Column()
  createdByMemberId: string;

  @CreateDateColumn()
  createdAt: Date;
}
