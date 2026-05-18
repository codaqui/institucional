import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Raffle } from './raffle.entity';

export enum RaffleOwnerType {
  MEMBER = 'member',
  COMPANY = 'company',
}

/**
 * Inscrição de um membro ou empresa em um sorteio.
 * Cada owner pode entrar uma única vez por sorteio.
 */
@Entity('club_raffle_entries')
@Unique(['raffleId', 'ownerId', 'ownerType'])
export class RaffleEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Raffle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raffleId' })
  raffle: Raffle;

  @Column()
  raffleId: string;

  /** memberId (UUID) ou companyId (UUID) */
  @Column()
  ownerId: string;

  @Column({ type: 'enum', enum: RaffleOwnerType })
  ownerType: RaffleOwnerType;

  @Column({ type: 'int' })
  coinsSpent: number;

  @CreateDateColumn()
  enteredAt: Date;
}
