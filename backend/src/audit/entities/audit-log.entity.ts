import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * TTL de retenção dos registros de auditoria.
 *
 * Valor padrão: 90 dias (atende à compliance atual).
 * Se a legislação mudar, basta alterar esta constante e rodar o cleanup.
 *
 * Referência legal: adequar conforme LGPD, Marco Civil da Internet,
 * ou norma interna da Associação Codaqui.
 */
export const AUDIT_RETENTION_DAYS = 90;

export enum AuditAction {
  // Auth
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',

  // Members
  ROLE_CHANGE = 'member.role_change',
  MEMBER_DEACTIVATE = 'member.deactivate',
  MEMBER_ACTIVATE = 'member.activate',

  // Ledger
  MANUAL_TRANSACTION = 'ledger.manual_transaction',
  ACCOUNT_CREATED = 'ledger.account_created',

  // Reimbursements
  REIMBURSEMENT_APPROVED = 'reimbursement.approved',
  REIMBURSEMENT_REJECTED = 'reimbursement.rejected',

  // Transfers
  TRANSFER_APPROVED = 'transfer.approved',
  TRANSFER_REJECTED = 'transfer.rejected',

  // Stripe
  SUBSCRIPTION_CANCELLED = 'stripe.subscription_cancelled',
}

@Entity('audit_logs')
@Index('IDX_audit_logs_createdAt', ['createdAt'])
@Index('IDX_audit_logs_actorId', ['actorId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ação realizada (enum legível) */
  @Column({ type: 'varchar', length: 64 })
  action: AuditAction;

  /** UUID do membro que executou a ação */
  @Column({ type: 'uuid' })
  actorId: string;

  /** Handle GitHub do ator (desnormalizado para consulta rápida) */
  @Column({ type: 'varchar', length: 64 })
  actorHandle: string;

  /** UUID do recurso afetado (membro, transação, reembolso, etc.) */
  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  /** Tipo do recurso afetado (member, transaction, reimbursement, transfer) */
  @Column({ type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  /** Detalhes da mudança em formato JSON livre */
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  /** IP do ator (quando disponível) */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
