import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import { Account } from '../../ledger/entities/account.entity';

export enum TransferRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Solicitação de transferência entre contas do ledger.
 *
 * Criada por um finance-analyzer quando uma carteira comunitária não tem
 * saldo suficiente para cobrir um reembolso pendente.
 * Aprovada ou rejeitada pelo admin.
 *
 * Ao aprovar: cria uma transação no ledger (source → destination).
 */
@Entity('account_transfer_requests')
export class AccountTransferRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Solicitante ───────────────────────────────────────────────────────────
  @ManyToOne(() => Member, { eager: true })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: Member;

  @Column()
  requestedById: string;

  // ── Contas envolvidas ─────────────────────────────────────────────────────
  /** Conta de origem (ex: Tesouro Geral) */
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Account;

  @Column()
  sourceAccountId: string;

  /** Conta de destino (ex: carteira da comunidade com saldo insuficiente) */
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'destinationAccountId' })
  destinationAccount: Account;

  @Column()
  destinationAccountId: string;

  /** Valor em reais (ex: 75 = R$ 75,00) */
  @Column({ type: 'int' })
  amount: number;

  /** Justificativa da transferência */
  @Column({ type: 'text' })
  reason: string;

  // ── Revisão ───────────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: TransferRequestStatus,
    default: TransferRequestStatus.PENDING,
  })
  status: TransferRequestStatus;

  @ManyToOne(() => Member, { nullable: true, eager: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Member | null;

  @Column({ nullable: true })
  reviewedById: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
