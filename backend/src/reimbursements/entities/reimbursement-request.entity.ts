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

export enum ReimbursementStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Solicitação de reembolso criada por um membro.
 *
 * Fluxo:
 *   1. Membro cria → status=pending, receiptUrl obrigatório (URL pública do comprovante)
 *   2. Finance-analyzer / admin revisa:
 *      - APPROVED: verifica saldo da conta → cria tx no ledger
 *                  internalReceiptUrl obrigatório (cópia no Drive: 1z8wP1XzfuTZs8Qp40mVm74UPBbHUWQUY)
 *      - REJECTED: nota de rejeição obrigatória
 *   3. Saldo insuficiente → finance-analyzer abre AccountTransferRequest para o admin
 */
@Entity('reimbursement_requests')
export class ReimbursementRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Solicitante ───────────────────────────────────────────────────────────
  @ManyToOne(() => Member, { eager: true })
  @JoinColumn({ name: 'memberId' })
  member: Member;

  @Column()
  memberId: string;

  // ── Conta a ser debitada ──────────────────────────────────────────────────
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  accountId: string;

  // ── Valores e descrição ───────────────────────────────────────────────────
  /** Valor em reais (ex: 75 = R$ 75,00) */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  // ── Comprovantes ──────────────────────────────────────────────────────────
  /** URL pública do comprovante original enviado pelo membro */
  @Column({ type: 'varchar' })
  receiptUrl: string;

  /**
   * URL interna do comprovante copiado pelo aprovador para o Google Drive.
   * Pasta: https://drive.google.com/drive/folders/1z8wP1XzfuTZs8Qp40mVm74UPBbHUWQUY
   * Preenchido apenas na aprovação.
   */
  @Column({ type: 'varchar', nullable: true })
  internalReceiptUrl: string | null;

  // ── Revisão ───────────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ReimbursementStatus,
    default: ReimbursementStatus.PENDING,
  })
  status: ReimbursementStatus;

  @ManyToOne(() => Member, { nullable: true, eager: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Member | null;

  @Column({ nullable: true })
  reviewedById: string | null;

  /** Nota do aprovador (obrigatória na rejeição, opcional na aprovação) */
  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
